// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as api from "./api";
import { S3 } from "aws-sdk"; // Amazon S3
import { secretManager } from "aws-sdk";
import * as awsRDS from "aws-sdk/clients/rds";
import { AzureStorage } from "./storage/azure-storage";
import { fileUploadMiddleware } from "./file-upload-manager";
import { JsonStorage } from "./storage/json-storage";
import { RedisManager } from "./redis-manager";
import { Storage } from "./storage/storage";
import { Response } from "express";
// const { DefaultAzureCredential } = require("@azure/identity");
// const { SecretClient } = require("@azure/keyvault-secrets");
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "<your-s3-bucket-name>";
const RDS_DB_INSTANCE_IDENTIFIER = process.env.RDS_DB_INSTANCE_IDENTIFIER || "<your-rds-instance>";
const SECRETS_MANAGER_SECRET_ID = process.env.SECRETS_MANAGER_SECRET_ID || "<your-secret-id>";

const s3 = new S3(); // Create an S3 instance
const secretsManager = new SecretsManager(); // Secrets Manager instance for fetching credentials

import * as bodyParser from "body-parser";
const domain = require("express-domain-middleware");
import * as express from "express";
import * as q from "q";

interface Secret {
  id: string;
  value: string;
}

function bodyParserErrorHandler(err: any, req: express.Request, res: express.Response, next: Function): void {
  if (err) {
    if (err.message === "invalid json" || (err.name === "SyntaxError" && ~err.stack.indexOf("body-parser"))) {
      req.body = null;
      next();
    } else {
      next(err);
    }
  } else {
    next();
  }
}

export function start(done: (err?: any, server?: express.Express, storage?: Storage) => void, useJsonStorage?: boolean): void {
  let storage: Storage;
  let isSecretsManagerConfigured: boolean;
  let secretValue: any;

  let storageProvider = process.env.STORAGE_PROVIDER || 'json'; // default to 'json' storage


  q<void>(null)
    .then(async () => {
    switch (storageProvider) {
      case 'aws':
        try {
          const secretData = await secretsManager.getSecretValue({ SecretId: SECRETS_MANAGER_SECRET_ID }).promise();
          secretValue = JSON.parse(secretData.SecretString || "{}");
          isSecretsManagerConfigured = true;
          // Set up AWS S3 storage
          storage = new AwsS3Storage(secretValue);
        } catch (error) {
          console.error("Failed to fetch secrets from AWS Secrets Manager", error);
          throw error;
        }
        break;

      case 'gcp':
        try {
          // Initialize GCP storage
          storage = new GcpStorage();
        } catch (error) {
          console.error("Failed to initialize GCP storage", error);
          throw error;
        }
        break;

      case 'local':
      default:
        // Fallback to JsonStorage if no provider is specified
        storage = new JsonStorage();
        break;
      }
    })
    .then(() => {
      const app = express();
      const auth = api.auth({ storage: storage });
      const redisManager = new RedisManager();

      // First, to wrap all requests and catch all exceptions.
      app.use(domain);

      // Monkey-patch res.send and res.setHeader to no-op after the first call and prevent "already sent" errors.
      app.use((req: express.Request, res: express.Response, next: (err?: any) => void): any => {
        const originalSend = res.send;
        const originalSetHeader = res.setHeader;
        res.setHeader = (name: string, value: string | number | readonly string[]): Response => {
          if (!res.headersSent) {
            originalSetHeader.apply(res, [name, value]);
          }

          return {} as Response;
        };

        res.send = (body: any) => {
          if (res.headersSent) {
            return res;
          }

          return originalSend.apply(res, [body]);
        };

        next();
      });

      if (process.env.LOGGING) {
        app.use((req: express.Request, res: express.Response, next: (err?: any) => void): any => {
          console.log(); // Newline to mark new request
          console.log(`[REST] Received ${req.method} request at ${req.originalUrl}`);
          next();
        });
      }

      // Enforce a timeout on all requests.
      app.use(api.requestTimeoutHandler());

      // Before other middleware which may use request data that this middleware modifies.
      app.use(api.inputSanitizer());

      // body-parser must be before the Application Insights router.
      app.use(bodyParser.urlencoded({ extended: true }));
      const jsonOptions: any = { limit: "10kb", strict: true };
      if (process.env.LOG_INVALID_JSON_REQUESTS === "true") {
        jsonOptions.verify = (req: express.Request, res: express.Response, buf: Buffer, encoding: string) => {
          if (buf && buf.length) {
            (<any>req).rawBody = buf.toString();
          }
        };
      }

      app.use(bodyParser.json(jsonOptions));

      // If body-parser throws an error, catch it and set the request body to null.
      app.use(bodyParserErrorHandler);

      // Before all other middleware to ensure all requests are tracked.
      // app.use(appInsights.router());

      app.get("/", (req: express.Request, res: express.Response, next: (err?: Error) => void): any => {
        res.send("Welcome to the CodePush REST API!");
      });

      app.set("etag", false);
      app.set("views", __dirname + "/views");
      app.set("view engine", "ejs");
      app.use("/auth/images/", express.static(__dirname + "/views/images"));
      app.use(api.headers({ origin: process.env.CORS_ORIGIN || "http://localhost:4000" }));
      app.use(api.health({ storage: storage, redisManager: redisManager }));

      if (process.env.DISABLE_ACQUISITION !== "true") {
        app.use(api.acquisition({ storage: storage, redisManager: redisManager }));
      }

      if (process.env.DISABLE_MANAGEMENT !== "true") {
        if (process.env.DEBUG_DISABLE_AUTH === "true") {
          app.use((req, res, next) => {
            let userId: string = "default";
            if (process.env.DEBUG_USER_ID) {
              userId = process.env.DEBUG_USER_ID;
            } else {
              console.log("No DEBUG_USER_ID environment variable configured. Using 'default' as user id");
            }

            req.user = {
              id: userId,
            };

            next();
          });
        } else {
          app.use(auth.router());
        }
        app.use(fileUploadMiddleware, api.management({ storage: storage, redisManager: redisManager }));
      } else {
        app.use(auth.router());
      }

      // Error handler needs to be the last middleware so that it can catch all unhandled exceptions
      // app.use(appInsights.errorHandler);

      // AWS Secrets Manager - Refresh credentials if necessary
      if (false) {
        setInterval(async () => {
          try {
            const secretData = await secretsManager.getSecretValue({ SecretId: SECRETS_MANAGER_SECRET_ID }).promise();
            const updatedSecret = JSON.parse(secretData.SecretString || "{}");

            // Update any configuration that relies on the secret
            //storage.reinitialize(updatedSecret); // This is a hypothetical method depending on your storage interface
          } catch (error) {
            console.error("Failed to refresh credentials from AWS Secrets Manager", error);
            //appInsights.errorHandler(error); // Assuming appInsights is used for error tracking
          }
        }, Number(process.env.REFRESH_CREDENTIALS_INTERVAL) || 24 * 60 * 60 * 1000); // Daily refresh
      }

      done(null, app, storage);
    })
    .done();
}
