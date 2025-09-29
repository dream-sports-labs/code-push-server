
import { JsonStorage } from "../script/storage/json-storage";
import { Authentication } from "../script/routes/authentication";
import { TokenPayload } from "google-auth-library";
import * as express from "express";
import * as storage from "../script/storage/storage";
jest.mock('google-auth-library', () => {
    const __mockVerifyIdToken = jest.fn();
    const __mockGetPayload = jest.fn();
    
    return {
      OAuth2Client: jest.fn().mockImplementation(() => ({
        verifyIdToken: __mockVerifyIdToken.mockResolvedValue({
          getPayload: __mockGetPayload,
        }),
      })),
      mockVerifyIdToken: __mockVerifyIdToken,
      mockGetPayload: __mockGetPayload,
    };
});
jest.mock('../script/utils/tracer', () => {
    return {
        sendErrorToDatadog: jest.fn(),
    };
});

describe("Authentication", () => {
    let authentication: Authentication;

    beforeEach(() => {
        jest.clearAllMocks();
        
        authentication = new Authentication({
            storage: new JsonStorage()
        });
    });

    it("should get payload when token is valid", async () => {
        jest.requireMock('google-auth-library').mockGetPayload.mockReturnValue({
            sub: "1234567890",
            email: "test@example.com",
            email_verified: true,
            name: "Test User",
        });

        const result = await authentication.verifyGoogleToken("mock-token");
        
        expect(result).toStrictEqual({
            sub: "1234567890",
            email: "test@example.com",
            email_verified: true,
            name: "Test User",
        });
        
        expect(jest.requireMock('google-auth-library').mockVerifyIdToken).toHaveBeenCalledWith({
            idToken: "mock-token",
            audience: expect.any(String),
        });
    });
    it("should throw error when token is invalid", async () => {
        jest.requireMock('google-auth-library').mockVerifyIdToken.mockReturnValue(new Error("temp"));
        await expect(authentication.verifyGoogleToken("mock-token")).rejects.toThrow("Invalid Google token");
        expect(jest.requireMock('../script/utils/tracer').sendErrorToDatadog).toHaveBeenCalledWith(new Error("401: Unauthorised Invalid Google Token"));
    });
    it("should throw error when payload is not found", async () => {
        jest.requireMock('google-auth-library').mockGetPayload.mockReturnValue(null);
        await expect(authentication.verifyGoogleToken("mock-token")).rejects.toThrow("Invalid Google token");
        expect(jest.requireMock('../script/utils/tracer').sendErrorToDatadog).toHaveBeenCalledWith(new Error("401: Unauthorised Invalid Google Token"));
    });

    it("should get user by email if it exists", async () => {
        const createdTime = Date.now();
        const accountId = await (authentication as any)._storageInstance.addAccount({createdTime: createdTime, email: "test@example.com", name: "Test User"});
        const result = await authentication.getOrCreateUser({email: "test@example.com"} as TokenPayload);
        expect(result.email).toBe("test@example.com");
        expect(result.name).toBe("Test User");
        expect(result.createdTime).toBe(createdTime);
        expect(result.id).toBe(accountId);
    });
    it("should create user if it does not exist", async () => {
        await (authentication as any)._storageInstance.dropAll();
        const result = await authentication.getOrCreateUser({email: "test@example.com", name: "Test User"} as TokenPayload);
        expect(result.email).toBe("test@example.com");
        expect(result.name).toBe("Test User");
    });

    it("should get user by id if it exists", async () => {
        const createdTime = Date.now();
        const accountId = await(authentication as any)._storageInstance.addAccount({createdTime: createdTime, email: "test@example.com", name: "Test User"});
        const result = await authentication.getUserById(accountId);
        expect(result.email).toBe("test@example.com");
        expect(result.name).toBe("Test User");
        expect(result.createdTime).toBe(createdTime);
        expect(result.id).toBe(accountId);
    });
    it("should throw error if user does not exist", async () => {
        await expect(authentication.getUserById("non-existent-id")).rejects.toThrow("No User found");
        expect(jest.requireMock('../script/utils/tracer').sendErrorToDatadog).toHaveBeenCalledWith(new Error("403: User Not found"));
    });

    it("check authenticate user in development and test mode with user in body", async () => {
        process.env.NODE_ENV = "development";
        let req = {
            body: {
                user: undefined
            }
        } as any as express.Request;
        let res = {
            status: jest.fn(),
            send: jest.fn()
        } as any as express.Response;
        let next = jest.fn(); 
        await authentication.authenticate(req, res, next);
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe("id_0");
        expect(req.user.email).toBe("user1@example.com");
        expect(req.user.name).toBe("User One");
        expect(next).toHaveBeenCalled();
        process.env.NODE_ENV = "test";
        req = {
            body: {
                user: undefined
            }
        } as any as express.Request;
        res = {
            status: jest.fn(),
            send: jest.fn()
        } as any as express.Response;
        await authentication.authenticate(req, res, next);
        expect(req.user.id).toBe("id_0");
        expect(req.user.email).toBe("user1@example.com");
        expect(req.user.name).toBe("User One");
        expect(next).toHaveBeenCalled();

    });
    it("check authenticate user in development and test mode with user in headers", async () => {
        const router = authentication.getRouter();
        const routeLayer = router.stack.find(layer => {
            // console.log(layer);
            return layer.route && layer.route.path === '/authenticated'
        });
        // const routeHandler = routeLayer.handle;
        process.env.NODE_ENV = "development";
        let req = {
            headers: {
                userId: "id_0"
            },
            body: {
                user: "id_0"
            }
        } as any as express.Request;
        let res = {
            status: jest.fn(),
            send: jest.fn()
        } as any as express.Response;
        let next = jest.fn();
        const stacksize = routeLayer.route.stack.length;
        for(let i = 0; i < stacksize; i++) {
            const layer = routeLayer.route.stack[i];
            await layer.handle(req, res, next);
            if(i === stacksize - 1) break;
            expect(next).toHaveBeenCalled();
            next.mockClear();
        }
        expect(req.user).toBeDefined();
        expect(req.user).toBe("id_0");
        process.env.NODE_ENV = "test";
        req = {
            headers: {
                userId: "id_0"
            },
            body: {
                user: "id_0"
            }
        } as any as express.Request;
        res = {
            status: jest.fn(),
            send: jest.fn()
        } as any as express.Response;
        for(let i = 0; i < stacksize; i++) {
            const layer = routeLayer.route.stack[i];
            await layer.handle(req, res, next);
            if(i === stacksize - 1) break;
            expect(next).toHaveBeenCalled();
            next.mockClear();
        }
        expect(req.user).toBeDefined();
        expect(req.user).toBe("id_0");
    });
    it("check authenticate in production mode with no idtoken test 1", async () => {
        process.env.NODE_ENV = "production";
        // add a user to the storage
        const accountId = await (authentication as any)._storageInstance.addAccount({createdTime: Date.now(), email: "test@example.com", name: "Test User"});
        let req = {
            headers: {
                authorization: "nothing",
                userid: accountId
            },
        } as any as express.Request;
        let res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        } as any as express.Response;
        let next = jest.fn();
        await authentication.authenticate(req, res, next);
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe(accountId);
        expect(next).toHaveBeenCalled();
    });
    it("check authenticate in production mode with no idtoken test 2", async () => {
        process.env.NODE_ENV = "production";
        // add a user to the storage
        const accountId = await (authentication as any)._storageInstance.addAccount({createdTime: Date.now(), email: "test@example.com", name: "Test User"});
        let req = {
            headers: {
                authorization: "nothing",
                userid: [accountId]
            },
        } as any as express.Request;
        let res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        } as any as express.Response;
        let next = jest.fn();
        await authentication.authenticate(req, res, next);
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe(accountId);
        expect(next).toHaveBeenCalled();
    });
    it("check authenticate in production mode with no idtoken test 3", async () => {
        process.env.NODE_ENV = "production";
        let req = {
            headers: {
                authorization: "nothing",
                userid: ""
            },
        } as any as express.Request;
        let res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        } as any as express.Response;
        let next = jest.fn();
        await authentication.authenticate(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.send).toHaveBeenCalledWith("Missing Google ID token");
        expect(next).not.toHaveBeenCalled();
    });
    it("check authenticate in production mode with no idtoken test 4", async () => {
        process.env.NODE_ENV = "production";
        let req = {
            headers: {
                authorization: "nothing",
                userid: [""]
            },
        } as any as express.Request;
        let res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        } as any as express.Response;
        let next = jest.fn();
        await authentication.authenticate(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.send).toHaveBeenCalledWith("Missing Google ID token");
        expect(next).not.toHaveBeenCalled();
    });
    it("check authenticate in production with vaild idtoken starting with cli-", async () => {
        process.env.NODE_ENV = "production";
        // add a user to the storage
        const accountId = await (authentication as any)._storageInstance.addAccount({createdTime: Date.now(), email: "test@example.com", name: "Test User"});
        // add a access key to the storage
        let accessKey = {
            name: "test-access-key",
            createdTime: Date.now(),
            expires: Date.now() + 1000 * 60 * 60 * 24 * 30,
            createdBy: "test-machine",
            friendlyName: "test-access-key",
        } as any as storage.AccessKey;
        const accessKeyId = await (authentication as any)._storageInstance.addAccessKey(accountId, accessKey);
        let req = {
            headers: {
                authorization: "Bearer cli-" + accessKey.name
            },
        } as any as express.Request;
        let res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        } as any as express.Response;
        let next = jest.fn();
        await authentication.authenticate(req, res, next);
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe(accountId);
        expect(next).toHaveBeenCalled();
    });
    it("check authenticate in production with vaild idtoken not starting with cli-", async () => {
        process.env.NODE_ENV = "production";
        let req = {
            headers: {
                authorization: "Bearer mock-token"
            },
        } as any as express.Request;
        let res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        } as any as express.Response;
        let next = jest.fn();
        
        // Set up the mock to return a resolved promise
        jest.requireMock('google-auth-library').mockVerifyIdToken.mockResolvedValue({
            getPayload: jest.requireMock('google-auth-library').mockGetPayload
        });
        jest.requireMock('google-auth-library').mockGetPayload.mockReturnValue({
            sub: "1234567890",
            email: "test@example.com",
            email_verified: true,
            name: "Test User",
        });
        await authentication.authenticate(req, res, next);
        expect(req.user).toBeDefined();
        expect(req.user.email).toBe("test@example.com");
        expect(req.user.name).toBe("Test User");
        expect(next).toHaveBeenCalled();
    });
    it("check authenticate in production with vaild idtoken not starting with cli-", async () => {
        process.env.NODE_ENV = "production";
        let req = {
            headers: {
                authorization: "Bearer mock-token"
            },
        } as any as express.Request;
        let res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        } as any as express.Response;
        let next = jest.fn();
        
        // Set up the mock to return a resolved promise
        jest.requireMock('google-auth-library').mockVerifyIdToken.mockResolvedValue({
            getPayload: jest.requireMock('google-auth-library').mockGetPayload
        });
        jest.requireMock('google-auth-library').mockGetPayload.mockReturnValue({
            sub: "1234567890",
            email: "test@example.com",
            email_verified: true,
            name: "Test User",
        });
        // add the use to storage with different name
        const accountId = await (authentication as any)._storageInstance.addAccount({createdTime: Date.now(), email: "test@example.com", name: "Test User changed"});
        await authentication.authenticate(req, res, next);
        expect(req.user).toBeDefined();
        expect(req.user.email).toBe("test@example.com");
        expect(req.user.name).toBe("Test User changed");
        expect(next).toHaveBeenCalled();
    });


});