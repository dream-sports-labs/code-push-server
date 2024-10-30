import { OAuth2Client, TokenPayload } from "google-auth-library";
import * as cookieSession from "cookie-session";
import { Request, Response, Router, RequestHandler } from "express";
import * as storage from "../storage/storage";
import rateLimit from "express-rate-limit";

// Replace with your actual Google Client ID (from Google Developer Console)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "<Your Google Client ID>";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface AuthenticationConfig {
  storage: storage.Storage;
}

export class Authentication {
  private _cookieSessionMiddleware: RequestHandler;
  private _serverUrl: string;
  private _storageInstance: storage.Storage;

  constructor(config: AuthenticationConfig) {
    this._serverUrl = process.env["SERVER_URL"];

    // Session middleware setup
    this._cookieSessionMiddleware = cookieSession({
      httpOnly: true,
      ttl: 3600000, // One hour in milliseconds
      name: "oauth.session",
      path: "/",
      signed: false,
      overwrite: true,
    });

    this._storageInstance = config.storage;
  }

  // Validate the Google ID token received from the client or web dashboard
  public async verifyGoogleToken(idToken: string): Promise<TokenPayload> {
    try {
      const ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: GOOGLE_CLIENT_ID, // Make sure this matches the client ID used in your app
      });

      const payload = ticket.getPayload();
      return payload; // Return the user info from Google token
    } catch (error) {
      throw new Error("Invalid Google token");
    }
  }

  public async getOrCreateUser(payload: TokenPayload): Promise<storage.Account> {
    try {
      return await this._storageInstance.getAccountByEmail(payload.email);
    } catch (e) {
      await this._storageInstance.addAccount({
        createdTime: Date.now(),
        email: payload.email,
        name: payload.name,
      });
      return await this._storageInstance.getAccountByEmail(payload.email);
    }
  }

  // Middleware to authenticate requests using Google ID token
  public async authenticate(req: Request, res: Response, next: (err?: Error) => void) {
    // Bypass authentication in development mode
    if (process.env.NODE_ENV === "development") {
      req.user = {
        id: "id_0",
        email: "localdev@example.com",
        name: "Local Developer",
      };
      return next();
    }

    // In production, validate the Google ID token
    try {
      const idToken = req.headers.authorization?.split("Bearer ")[1];
      if (!idToken) {
        return res.status(401).send("Missing Google ID token");
      }

      // Verify Google ID token
      const payload = await this.verifyGoogleToken(idToken);
      if (!payload) {
        return res.status(401).send("Invalid Google ID token");
      }

      // Check user exists in the storage
      const userEmail = payload.email;

      const user = await this.getOrCreateUser(payload);

      if (!user) {
        return res.status(401).send("User not found in the system");
      } else {
        // Update user info if it has changed
        if (user.name !== payload.name) {
          user.name = payload.name;
          await this._storageInstance.addAccount(user);
          //return this._storageInstance
          // .addAccount(newUser)
          // .then((accountId: string): Promise<void> => issueAccessKey(accountId));
        }
      }

      // Attach the user to the request object
      req.user = user;
      next();
    } catch (error) {
      res.status(401).send("Authentication failed");
    }
  }

  // Main router for handling requests
  public getRouter(): Router {
    const router: Router = Router();

    router.use(this._cookieSessionMiddleware);

    // Example protected route
    router.get(
      "/authenticated",
      rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }),
      this.authenticate.bind(this),
      (req: Request, res: Response) => {
        // req.user = {
        //   id: "id_0",
        //   email: "localdev@example.com",
        //   name: "Local Developer",
        // };
        res.send({ authenticated: true, user: req.user });
      }
    );

    return router;
  }
}
