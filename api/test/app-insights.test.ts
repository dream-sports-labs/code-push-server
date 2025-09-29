// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as express from "express";
import {AppInsights} from "../script/routes/app-insights";

enum ServiceResource {
    AccessKeys,
    AccessKeysWithId,
    Account,
    AppTransfer,
    Apps,
    AppsWithId,
    Collaborators,
    CollaboratorsWithEmail,
    DeploymentHistory,
    Deployments,
    DeploymentsWithId,
    LinkGitHub,
    LinkMicrosoft,
    LoginGitHub,
    LoginMicrosoft,
    Metrics,
    Other,
    Promote,
    RegisterGitHub,
    RegisterMicrosoft,
    Release,
    ReportStatusDeploy,
    ReportStatusDownload,
    Rollback,
    UpdateCheck,
}

const mockApplicationInsights = {
    setup: jest.fn().mockReturnThis(),
    setAutoCollectRequests: jest.fn().mockReturnThis(),
    setAutoCollectPerformance: jest.fn().mockReturnThis(),
    setAutoCollectExceptions: jest.fn().mockReturnThis(),
    start: jest.fn(),
    defaultClient: {
      trackRequest: jest.fn(),
      trackEvent: jest.fn(),
      trackException: jest.fn(),
    },
};
const mockReq = {
    url: "/reportStatus/deploy",
    originalUrl: "/reportStatus/deploy",
    method: "POST",
    body: {
      deploymentKey: "abc123",
      status: "DeploymentSucceeded",
    },
    query: {},
    params: {
        appName: "test-app",
        deploymentName: "staging",
    },
    cookies: {},
    fresh: true,
    ip: "127.0.0.1",
    protocol: "http",
    rawHeaders: [],
    sessionID: "123",
    signedCookies: {},
    xhr: false,
    user: { id: "user-id-123" },
    get: jest.fn(),
    rawBody: "raw request body",
} as unknown as express.Request;

const mockRes = {
    statusCode: 200,
    headersSent: false,
    sendStatus: jest.fn(),
    once: jest.fn((event, cb) => {
      if (event === "finish") {
        cb();
      }
    }),
    locals: {},
    fromCache: {},
} as unknown as express.Response;

const mockNext = jest.fn();

const mockError = new Error("CHECK ERROR MOCK");

jest.mock("applicationinsights", () => mockApplicationInsights);


describe("AppInsights", () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        jest.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.resetModules();
        jest.restoreAllMocks();
    });
    describe("constructor", () => {
        it("should call mock applicationinsights when INSTRUMENTATION_KEY is set", () => {
            process.env.APP_INSIGHTS_INSTRUMENTATION_KEY = "test";
            jest.resetModules();
            const { AppInsights } = require("../script/routes/app-insights");
            new AppInsights();
            expect(mockApplicationInsights.setup).toHaveBeenCalledWith("test");
            expect(mockApplicationInsights.setAutoCollectRequests).toHaveBeenCalledWith(false);
            expect(mockApplicationInsights.setAutoCollectPerformance).toHaveBeenCalledWith(false);
            expect(mockApplicationInsights.setAutoCollectExceptions).toHaveBeenCalledWith(true);
            expect(mockApplicationInsights.start).toHaveBeenCalled();
            expect(mockApplicationInsights.defaultClient.trackRequest).not.toHaveBeenCalled();
            expect(mockApplicationInsights.defaultClient.trackEvent).not.toHaveBeenCalled();
            expect(mockApplicationInsights.defaultClient.trackException).not.toHaveBeenCalled();
        });
        it("should not call mock applicationinsights when INSTRUMENTATION_KEY is not set", () => {
            delete process.env.APP_INSIGHTS_INSTRUMENTATION_KEY;
            jest.resetModules();
            const { AppInsights } = require("../script/routes/app-insights");
            new AppInsights();
            expect(mockApplicationInsights.setup).not.toHaveBeenCalled();
            expect(mockApplicationInsights.setAutoCollectRequests).not.toHaveBeenCalled();
            expect(mockApplicationInsights.setAutoCollectPerformance).not.toHaveBeenCalled();
            expect(mockApplicationInsights.setAutoCollectExceptions).not.toHaveBeenCalled();
            expect(mockApplicationInsights.start).not.toHaveBeenCalled();
            expect(mockApplicationInsights.defaultClient.trackRequest).not.toHaveBeenCalled();
            expect(mockApplicationInsights.defaultClient.trackEvent).not.toHaveBeenCalled();
            expect(mockApplicationInsights.defaultClient.trackException).not.toHaveBeenCalled();
        });
    });
    describe("isAppInsightsInstrumented", () => {
        it("should return true if INSTRUMENTATION_KEY is set", () => {
            process.env.APP_INSIGHTS_INSTRUMENTATION_KEY = "test";
            jest.resetModules();
            const { AppInsights } = require("../script/routes/app-insights");
            expect(AppInsights.isAppInsightsInstrumented()).toBe(true);
        });

        it("should return false if INSTRUMENTATION_KEY is not set", () => {
            delete process.env.APP_INSIGHTS_INSTRUMENTATION_KEY;
            jest.resetModules();
            const { AppInsights } = require("../script/routes/app-insights");
            expect(AppInsights.isAppInsightsInstrumented()).toBe(false);
        });
    });
    describe("errorHandler", () => {
        let tempmockReq: express.Request;
        let tempmockRes: express.Response;
        let tempmockNext: jest.Mock;
        let tempmockError: Error;
        let appInsights:AppInsights;
        beforeEach(() => {
            jest.clearAllMocks();
            tempmockReq = mockReq;
            tempmockRes = mockRes;
            tempmockNext = mockNext;
            tempmockError = mockError;
            process.env.APP_INSIGHTS_INSTRUMENTATION_KEY = "test";
            jest.resetModules();
            const { AppInsights } = require("../script/routes/app-insights");
            appInsights = new AppInsights();
            jest.spyOn(appInsights, "trackException").mockImplementation(jest.fn());
        });
        afterEach(() => {
            delete process.env.APP_INSIGHTS_INSTRUMENTATION_KEY;
            jest.restoreAllMocks();
        });
        it("calls trackException with err only if req is missing and INSTRUMENTATION_KEY is set", () => {
            appInsights.errorHandler(tempmockError, null, tempmockRes, tempmockNext);
        
            expect(appInsights.trackException).toHaveBeenCalledWith(tempmockError);
            expect(tempmockRes.sendStatus).not.toHaveBeenCalled();
            expect(tempmockNext).not.toHaveBeenCalled();
        });
    
        it("calls trackException with detailed context and sends 500 if headers not sent", () => {
            appInsights.errorHandler(tempmockError, tempmockReq, tempmockRes, tempmockNext);
        
            expect(appInsights.trackException).toHaveBeenCalledWith(
                tempmockError,
                expect.objectContaining({
                    URL: tempmockReq.originalUrl,
                    Request: JSON.stringify(tempmockReq, [
                      "cookies",
                      "fresh",
                      "ip",
                      "method",
                      "originalUrl",
                      "protocol",
                      "rawHeaders",
                      "sessionID",
                      "signedCookies",
                      "url",
                      "xhr",
                    ]),
                    Response: JSON.stringify(tempmockRes, ["headersSent", "locals", "fromCache"]),
                    Error: JSON.stringify(tempmockError.message),
                })
            );
            expect(tempmockRes.sendStatus).toHaveBeenCalledWith(500);
            expect(tempmockNext).not.toHaveBeenCalled();
        });
        it("does not send response if headers already sent", () => {
            tempmockRes.headersSent = true;
            appInsights.errorHandler(tempmockError, tempmockReq, tempmockRes, tempmockNext);
        
            expect(appInsights.trackException).toHaveBeenCalledWith(
                tempmockError,
                expect.objectContaining({
                    URL: tempmockReq.originalUrl,
                    Request: JSON.stringify(tempmockReq, [
                      "cookies",
                      "fresh",
                      "ip",
                      "method",
                      "originalUrl",
                      "protocol",
                      "rawHeaders",
                      "sessionID",
                      "signedCookies",
                      "url",
                      "xhr",
                    ]),
                    Response: JSON.stringify(tempmockRes, ["headersSent", "locals", "fromCache"]),
                    Error: JSON.stringify(tempmockError.message),
                })
            );
            expect(tempmockRes.sendStatus).not.toHaveBeenCalled();
            expect(tempmockNext).not.toHaveBeenCalled();
        });
        it("calls next(err) if no instrumentation key", () => {
            delete process.env.APP_INSIGHTS_INSTRUMENTATION_KEY;
            jest.resetModules();
            const { AppInsights } = require("../script/routes/app-insights");
            const newAppInsights = new AppInsights();
            jest.spyOn(newAppInsights, "trackException").mockImplementation(jest.fn());
            newAppInsights.errorHandler(tempmockError, tempmockReq, tempmockRes, tempmockNext);
            expect(newAppInsights.trackException).not.toHaveBeenCalled();
            expect(tempmockRes.sendStatus).not.toHaveBeenCalled();
            expect(tempmockNext).toHaveBeenCalledWith(tempmockError);
        });
        it("calls next(err) if error is null", () => {
            appInsights.errorHandler(null, tempmockReq, tempmockRes, tempmockNext);
            expect(process.env.APP_INSIGHTS_INSTRUMENTATION_KEY).toBe("test");
            expect(appInsights.trackException).not.toHaveBeenCalled();
            expect(tempmockRes.sendStatus).not.toHaveBeenCalled();
            expect(tempmockNext).toHaveBeenCalledWith(null);
        });
    });
    describe("AppInsights.getRouter middle where check with instrumentation key", () => {
        let tempmockReq: express.Request;
        let tempmockRes: express.Response;
        let tempmockNext: jest.Mock;
        let tempmockError: Error;
        let appInsights:AppInsights;
        beforeEach(() => {
            jest.clearAllMocks();
            tempmockReq = mockReq;
            tempmockRes = mockRes;
            tempmockNext = mockNext;
            tempmockError = mockError;
            process.env.APP_INSIGHTS_INSTRUMENTATION_KEY = "test";
            jest.resetModules();
            const { AppInsights } = require("../script/routes/app-insights");
            appInsights = new AppInsights();
        });
        afterEach(() => {
            delete process.env.APP_INSIGHTS_INSTRUMENTATION_KEY;
            jest.restoreAllMocks();
        });
        it("should call next() and skip tracking for /health route", async () => {
            const getServiceResourceSpy = jest.spyOn(appInsights as any, "getServiceResource").mockImplementation(jest.fn());
            const getTagPropertySpy = jest.spyOn(appInsights as any, "getTagProperty").mockImplementation(jest.fn());
            const getTagSpy = jest.spyOn(appInsights as any, "getTag").mockImplementation(jest.fn());
            const reportStatusSpy = jest.spyOn(appInsights as any, "reportStatus").mockImplementation(jest.fn());
            const router = appInsights.getRouter();
            const middlewareFn = router.stack[0].handle;
            tempmockReq.url = "/health";
          
            await middlewareFn(tempmockReq,tempmockRes,tempmockNext);
            expect(tempmockNext).toHaveBeenCalled();
            expect(reportStatusSpy).not.toHaveBeenCalled();
            expect(getServiceResourceSpy).not.toHaveBeenCalled();
            expect(getTagSpy).not.toHaveBeenCalled();
            expect(getTagPropertySpy).not.toHaveBeenCalled();
        });
        it("should handle updateCheck request", async () => {
            const getServiceResourceSpy = jest
            .spyOn(appInsights as any, "getServiceResource")
            .mockReturnValue(ServiceResource.UpdateCheck);
        
            const getTagPropertySpy = jest
                .spyOn(appInsights as any, "getTagProperty")
                .mockReturnValue("UpdateCheck");
        
            const getTagSpy = jest
                .spyOn(appInsights as any, "getTag")
                .mockImplementation((resource) => {
                if (resource === ServiceResource.UpdateCheck) return "UpdateCheck";
                return "Other";
                });
            const reportStatusSpy = jest.spyOn(appInsights as any, "reportStatus").mockImplementation(jest.fn());
            tempmockReq.url = "/updateCheck";
            const router = appInsights.getRouter();
            const middlewareFn = router.stack[0].handle;
            await middlewareFn(tempmockReq,tempmockRes,tempmockNext);
            expect(getServiceResourceSpy).toHaveBeenCalledWith(tempmockReq.url);
            expect(getTagPropertySpy).toHaveBeenCalledWith(tempmockReq.method, tempmockReq.url, tempmockRes.statusCode, ServiceResource.UpdateCheck);
            expect(getTagSpy).toHaveBeenCalledWith(ServiceResource.UpdateCheck);
            expect(reportStatusSpy).not.toHaveBeenCalled();
            expect(tempmockNext).toHaveBeenCalled();
        });
        it("should handle ReportStatusDownload request", async () => {
            const getServiceResourceSpy = jest
            .spyOn(appInsights as any, "getServiceResource")
            .mockReturnValue(ServiceResource.ReportStatusDownload);
        
            const getTagPropertySpy = jest
                .spyOn(appInsights as any, "getTagProperty")
                .mockReturnValue("ReportStatusDownload");
        
            const getTagSpy = jest
                .spyOn(appInsights as any, "getTag")
                .mockImplementation((resource) => {
                if (resource === ServiceResource.ReportStatusDownload) return "ReportStatusDownload";
                return "Other";
                });
            const reportStatusSpy = jest.spyOn(appInsights as any, "reportStatus").mockImplementation(jest.fn());
            tempmockReq.url = "/reportStatus/download";
            const router = appInsights.getRouter();
            const middlewareFn = router.stack[0].handle;
            await middlewareFn(tempmockReq,tempmockRes,tempmockNext);
            expect(getServiceResourceSpy).toHaveBeenCalledWith(tempmockReq.url);
            expect(getTagPropertySpy).toHaveBeenCalledWith(tempmockReq.method, tempmockReq.url, tempmockRes.statusCode, ServiceResource.ReportStatusDownload);
            expect(getTagSpy).toHaveBeenCalledWith(ServiceResource.ReportStatusDownload);
            expect(reportStatusSpy).toHaveBeenCalledWith(
                expect.any(Object),
                "Downloaded",
                tempmockReq.body.deploymentKey,
              );
            expect(tempmockNext).toHaveBeenCalled();
        });
        it("should handle ReportStatusDeploy request", async () => {
            const getServiceResourceSpy = jest
            .spyOn(appInsights as any, "getServiceResource")
            .mockReturnValue(ServiceResource.ReportStatusDeploy);
        
            const getTagPropertySpy = jest
                .spyOn(appInsights as any, "getTagProperty")
                .mockReturnValue("ReportStatusDeploy");
        
            const getTagSpy = jest
                .spyOn(appInsights as any, "getTag")
                .mockImplementation((resource) => {
                if (resource === ServiceResource.ReportStatusDeploy) return "ReportStatusDeploy";
                return "Other";
                });
            const reportStatusSpy = jest.spyOn(appInsights as any, "reportStatus").mockImplementation(jest.fn());
            tempmockReq.url = "/reportStatus/deploy";
            const router = appInsights.getRouter();
            const middlewareFn = router.stack[0].handle;
            await middlewareFn(tempmockReq,tempmockRes,tempmockNext);
            expect(getServiceResourceSpy).toHaveBeenCalledWith(tempmockReq.url);
            expect(getTagPropertySpy).toHaveBeenCalledWith(tempmockReq.method, tempmockReq.url, tempmockRes.statusCode, ServiceResource.ReportStatusDeploy);
            expect(getTagSpy).toHaveBeenCalledWith(ServiceResource.ReportStatusDeploy);
            expect(reportStatusSpy).toHaveBeenCalledWith(
                expect.any(Object),
                tempmockReq.body.status,
                tempmockReq.body.deploymentKey,
              );
            expect(tempmockNext).toHaveBeenCalled();
        });
        it("should handle Promote request", async () => {
            const getServiceResourceSpy = jest
            .spyOn(appInsights as any, "getServiceResource")
            .mockReturnValue(ServiceResource.Promote);
            const getTagPropertySpy = jest
                .spyOn(appInsights as any, "getTagProperty")
                .mockReturnValue("Promote");
            const getTagSpy = jest
                .spyOn(appInsights as any, "getTag")
                .mockImplementation((resource) => {
                if (resource === ServiceResource.Promote) return "Promote";
                return "Other";
                });
            const reportStatusSpy = jest.spyOn(appInsights as any, "reportStatus").mockImplementation(jest.fn());
            tempmockReq.url = "/promote";
            const router = appInsights.getRouter();
            const middlewareFn = router.stack[0].handle;
            await middlewareFn(tempmockReq,tempmockRes,tempmockNext);
            expect(getServiceResourceSpy).toHaveBeenCalledWith(tempmockReq.url);
            expect(getTagPropertySpy).toHaveBeenCalledWith(tempmockReq.method, tempmockReq.url, tempmockRes.statusCode, ServiceResource.Promote);
            expect(reportStatusSpy).not.toHaveBeenCalled();
            expect(tempmockNext).toHaveBeenCalled();
        });
        it("should handle Release request", async () => {
            const getServiceResourceSpy = jest
            .spyOn(appInsights as any, "getServiceResource")
            .mockReturnValue(ServiceResource.Release);
            const getTagPropertySpy = jest
                .spyOn(appInsights as any, "getTagProperty")
                .mockReturnValue("Release");
            const getTagSpy = jest
                .spyOn(appInsights as any, "getTag")
                .mockImplementation((resource) => {
                if (resource === ServiceResource.Release) return "Release";
                return "Other";
                });
            const reportStatusSpy = jest.spyOn(appInsights as any, "reportStatus").mockImplementation(jest.fn());
            tempmockReq.url = "/release";
            const router = appInsights.getRouter();
            const middlewareFn = router.stack[0].handle;
            await middlewareFn(tempmockReq,tempmockRes,tempmockNext);
            expect(getServiceResourceSpy).toHaveBeenCalledWith(tempmockReq.url);
            expect(getTagPropertySpy).toHaveBeenCalledWith(tempmockReq.method, tempmockReq.url, tempmockRes.statusCode, ServiceResource.Release);
            expect(reportStatusSpy).not.toHaveBeenCalled();
            expect(tempmockNext).toHaveBeenCalled();
        });
        it("should call trackevent if res.statuscode >= 400 for non /health ", async () => {
            const trackEventSpy = jest.spyOn(appInsights as any, "trackEvent").mockImplementation(jest.fn());
            tempmockRes.statusCode = 500;
            tempmockReq.url = "/apps/abc123/deployments/xyz123/release";
            const router = appInsights.getRouter();
            const middlewareFn = router.stack[0].handle;
            await middlewareFn(tempmockReq,tempmockRes,tempmockNext);
            expect(trackEventSpy).toHaveBeenCalledWith("Error response", expect.any(Object));
            expect(tempmockNext).toHaveBeenCalled();
        });
        it("should track user activity for authenticated user with regular route", () => {
            const router = appInsights.getRouter();
            const middlewareFn = router.stack[0].handle;
            const trackEventSpy = jest.spyOn(appInsights as any, "trackEvent").mockImplementation(jest.fn());
            middlewareFn(tempmockReq, tempmockRes, tempmockNext);
            expect(trackEventSpy).toHaveBeenCalledWith("User activity", {
                url: tempmockReq.url,
                method: tempmockReq.method,
                statusCode: tempmockRes.statusCode.toString(),
                userId: tempmockReq.user.id,
                appName: tempmockReq.params.appName,
                deploymentName: tempmockReq.params.deploymentName
            });
        });
        it("should track user activity for auth callback route with providerId", () => {
            const router = appInsights.getRouter();
            const middlewareFn = router.stack[0].handle;
            const trackEventSpy = jest.spyOn(appInsights as any, "trackEvent").mockImplementation(jest.fn());
            tempmockReq.url = "/auth/callback/github";
            middlewareFn(tempmockReq, tempmockRes, tempmockNext);
            expect(trackEventSpy).toHaveBeenCalledWith("User activity", {
                url: tempmockReq.url,
                method: tempmockReq.method,
                statusCode: tempmockRes.statusCode.toString(),
                providerId: tempmockReq.user.id,
                appName: tempmockReq.params.appName,
                deploymentName: tempmockReq.params.deploymentName
            });
        });
        it("checking with status code 400 and req.user is null", () => {
            const router = appInsights.getRouter();
            const middlewareFn = router.stack[0].handle;
            const trackEventSpy = jest.spyOn(appInsights as any, "trackEvent").mockImplementation(jest.fn());
            tempmockReq.user = null;
            tempmockRes.statusCode = 400;
            const propertytag = (appInsights as any).getTagProperty(tempmockReq.method, tempmockReq.url, tempmockRes.statusCode, ServiceResource.ReportStatusDeploy);
            middlewareFn(tempmockReq, tempmockRes, tempmockNext);
            console.log(propertytag);
            expect(trackEventSpy).toHaveBeenCalledWith("Error response", {
                url: tempmockReq.url,
                method: tempmockReq.method,
                statusCode: tempmockRes.statusCode.toString(),
                tag: propertytag,
            });
        });
    });
    describe("private methods getServiceResource, getTagProperty, getTag, reportStatus", () => {
        let appInsights:AppInsights;
        const allurls: {url: string, resource: ServiceResource}[] = [
            {url: "/accessKeys", resource: ServiceResource.AccessKeys},
            {url: "/accessKeys/def123", resource: ServiceResource.AccessKeysWithId},
            {url: "/account", resource: ServiceResource.Account},
            {url: "/apps/abc123/transfer/foo@bar.com", resource: ServiceResource.AppTransfer},
            {url: "/apps", resource: ServiceResource.Apps},
            {url: "/apps/abc123", resource: ServiceResource.AppsWithId},
            {url: "/apps/abc123/collaborators", resource: ServiceResource.Collaborators},
            {url: "/apps/abc123/collaborators/foo@bar.com", resource: ServiceResource.CollaboratorsWithEmail},
            {url: "/apps/abc123/deployments/xyz123/history", resource: ServiceResource.DeploymentHistory},
            {url: "/apps/abc123/deployments", resource: ServiceResource.Deployments},
            {url: "/apps/abc123/deployments/xyz123", resource: ServiceResource.DeploymentsWithId},
            {url: "/auth/link/github", resource: ServiceResource.LinkGitHub},
            {url: "/auth/link/microsoft", resource: ServiceResource.LinkMicrosoft},
            {url: "/auth/login/github", resource: ServiceResource.LoginGitHub},
            {url: "/auth/login/microsoft", resource: ServiceResource.LoginMicrosoft},
            {url: "/apps/abc123/deployments/xyz123/metrics", resource: ServiceResource.Metrics},
            {url: "/apps/abc123/deployments/xyz123/promote/def123", resource: ServiceResource.Promote},
            {url: "/auth/register/github", resource: ServiceResource.RegisterGitHub},
            {url: "/auth/register/microsoft", resource: ServiceResource.RegisterMicrosoft},
            {url: "/apps/abc123/deployments/xyz123/release", resource: ServiceResource.Release},
            {url: "/reportStatus/deploy", resource: ServiceResource.ReportStatusDeploy},
            {url: "/reportStatus/download", resource: ServiceResource.ReportStatusDownload},
            {url: "/apps/abc123/deployments/xyz123/rollback", resource: ServiceResource.Rollback},
            {url: "/apps/abc123/deployments/xyz123/rollback/v4", resource: ServiceResource.Rollback},
            {url: "/updateCheck", resource: ServiceResource.UpdateCheck},
            {url: "/health", resource: ServiceResource.Other},
        ];
        beforeEach(() => {
            jest.clearAllMocks();
            jest.resetModules();
            const { AppInsights } = require("../script/routes/app-insights");
            appInsights = new AppInsights();
        });
        afterEach(() => {
            jest.restoreAllMocks();
        });
        it("getserviceresource check for all routes", () => {
            for (const url of allurls) {
                const result = (appInsights as any).getServiceResource(url.url);
                expect(result).toBe(url.resource);
            }
        });
        it("should return 'Package Released' for POST /release with status 200", () => {
            const result = (appInsights as any).getTagProperty("POST", "/apps/abc123/deployments/xyz/release", 200, ServiceResource.Release);
            expect(result).toBe("Package Released");
        });
        
        it("should return 'Package Released Failed' for POST /release with status 500", () => {
            const result = (appInsights as any).getTagProperty("POST", "/apps/abc123/deployments/xyz/release", 500, ServiceResource.Release);
            expect(result).toBe("Package Released Failed");
        });
    
        it("should return null for POST with unknown resource", () => {
            const result = (appInsights as any).getTagProperty("POST", "/some-url", 200, ServiceResource.Other);
            expect(result).toBe(null);
        });
    
        it("should return null if status code is missing", () => {
            const result = (appInsights as any).getTagProperty("POST", "/some-url", null, ServiceResource.Release);
            expect(result).toBeNull();
        });
    
        it("should return 'UpdateCheck' (just tag) for GET /updateCheck", () => {
            const result = (appInsights as any).getTagProperty("GET", "/updateCheck", 200, ServiceResource.UpdateCheck);
            expect(result).toBe("UpdateCheck");
        });
    
        it("should return null for DELETE with status 400", () => {
            const result = (appInsights as any).getTagProperty("DELETE", "/some-url", 400, ServiceResource.Other);
            expect(result).toBeNull();
        });
    
        it("should return 'Get Package' for GET resource other than UpdateCheck", () => {
            const result = (appInsights as any).getTagProperty("GET", "/some-url", 200, ServiceResource.Release);
            expect(result).toBe("Get Package");
        });

        // POST method tests
        it("should return 'App transfer' for POST AppTransfer", () => {
            const result = (appInsights as any).getTagProperty("POST", "/apps/abc123/transfer/foo@bar.com", 200, ServiceResource.AppTransfer);
            expect(result).toBe("App transfer");
        });

        it("should return 'Collaborator Added' for POST CollaboratorsWithEmail", () => {
            const result = (appInsights as any).getTagProperty("POST", "/apps/abc123/collaborators/foo@bar.com", 200, ServiceResource.CollaboratorsWithEmail);
            expect(result).toBe("Collaborator Added");
        });

        it("should return 'Package Promoted' for POST Promote", () => {
            const result = (appInsights as any).getTagProperty("POST", "/apps/abc123/deployments/xyz123/promote/def123", 200, ServiceResource.Promote);
            expect(result).toBe("Package Promoted");
        });

        it("should return 'ReportStatusDeploy' for POST ReportStatusDeploy", () => {
            const result = (appInsights as any).getTagProperty("POST", "/reportStatus/deploy", 200, ServiceResource.ReportStatusDeploy);
            expect(result).toBe("ReportStatusDeploy");
        });

        it("should return 'ReportStatusDownload' for POST ReportStatusDownload", () => {
            const result = (appInsights as any).getTagProperty("POST", "/reportStatus/download", 200, ServiceResource.ReportStatusDownload);
            expect(result).toBe("ReportStatusDownload");
        });

        it("should return 'Package Rolled Back' for POST Rollback", () => {
            const result = (appInsights as any).getTagProperty("POST", "/apps/abc123/deployments/xyz123/rollback", 200, ServiceResource.Rollback);
            expect(result).toBe("Package Rolled Back");
        });

        it("should return 'AccessKeys Created' for POST AccessKeys", () => {
            const result = (appInsights as any).getTagProperty("POST", "/accessKeys", 200, ServiceResource.AccessKeys);
            expect(result).toBe("AccessKeys Created");
        });

        it("should return 'App Created' for POST Apps", () => {
            const result = (appInsights as any).getTagProperty("POST", "/apps", 200, ServiceResource.Apps);
            expect(result).toBe("Apps Created");
        });

        it("should return 'Deployments Created' for POST Deployments", () => {
            const result = (appInsights as any).getTagProperty("POST", "/apps/abc123/deployments", 200, ServiceResource.Deployments);
            expect(result).toBe("Deployments Created");
        });

        // PATCH method tests
        it("should return 'Package Modified' for PATCH Release", () => {
            const result = (appInsights as any).getTagProperty("PATCH", "/apps/abc123/deployments/xyz123/release", 200, ServiceResource.Release);
            expect(result).toBe("Package Modified");
        });

        it("should return 'AccessKeys Modified' for PATCH AccessKeys", () => {
            const result = (appInsights as any).getTagProperty("PATCH", "/accessKeys", 200, ServiceResource.AccessKeys);
            expect(result).toBe("AccessKeys Modified");
        });

        it("should return 'App Modified' for PATCH AppsWithId", () => {
            const result = (appInsights as any).getTagProperty("PATCH", "/apps/abc123", 200, ServiceResource.AppsWithId);
            expect(result).toBe("App Modified");
        });

        // DELETE method tests
        it("should return 'Collaborator Removed' for DELETE CollaboratorsWithEmail", () => {
            const result = (appInsights as any).getTagProperty("DELETE", "/apps/abc123/collaborators/foo@bar.com", 200, ServiceResource.CollaboratorsWithEmail);
            expect(result).toBe("Collaborator Removed");
        });

        it("should return 'AccessKeys Deleted' for DELETE AccessKeys", () => {
            const result = (appInsights as any).getTagProperty("DELETE", "/accessKeys", 200, ServiceResource.AccessKeys);
            expect(result).toBe("AccessKeys Deleted");
        });

        it("should return 'App Deleted' for DELETE AppsWithId", () => {
            const result = (appInsights as any).getTagProperty("DELETE", "/apps/abc123", 200, ServiceResource.AppsWithId);
            expect(result).toBe("App Deleted");
        });

        it("should return 'Deployment Deleted' for DELETE DeploymentsWithId", () => {
            const result = (appInsights as any).getTagProperty("DELETE", "/apps/abc123/deployments/xyz123", 200, ServiceResource.DeploymentsWithId);
            expect(result).toBe("Deployment Deleted");
        });

        // Failure status code tests (status >= 400)
        it("should return 'Package Released Failed' for POST Release with status 400", () => {
            const result = (appInsights as any).getTagProperty("POST", "/apps/abc123/deployments/xyz123/release", 400, ServiceResource.Release);
            expect(result).toBe("Package Released Failed");
        });

        it("should return 'Package Promoted Failed' for POST Promote with status 500", () => {
            const result = (appInsights as any).getTagProperty("POST", "/apps/abc123/deployments/xyz123/promote/def123", 500, ServiceResource.Promote);
            expect(result).toBe("Package Promoted Failed");
        });

        it("should return 'Collaborator Added Failed' for POST CollaboratorsWithEmail with status 400", () => {
            const result = (appInsights as any).getTagProperty("POST", "/apps/abc123/collaborators/foo@bar.com", 400, ServiceResource.CollaboratorsWithEmail);
            expect(result).toBe("Collaborator Added Failed");
        });

        it("should return 'Package Rolled Back Failed' for POST Rollback with status 500", () => {
            const result = (appInsights as any).getTagProperty("POST", "/apps/abc123/deployments/xyz123/rollback", 500, ServiceResource.Rollback);
            expect(result).toBe("Package Rolled Back Failed");
        });

        it("should return 'AccessKeys Created Failed' for POST AccessKeys with status 400", () => {
            const result = (appInsights as any).getTagProperty("POST", "/accessKeys", 400, ServiceResource.AccessKeys);
            expect(result).toBe("AccessKeys Created Failed");
        });

        it("should return 'Package Modified Failed' for PATCH Release with status 500", () => {
            const result = (appInsights as any).getTagProperty("PATCH", "/apps/abc123/deployments/xyz123/release", 500, ServiceResource.Release);
            expect(result).toBe("Package Modified Failed");
        });

        it("should return 'Collaborator Removed Failed' for DELETE CollaboratorsWithEmail with status 400", () => {
            const result = (appInsights as any).getTagProperty("DELETE", "/apps/abc123/collaborators/foo@bar.com", 400, ServiceResource.CollaboratorsWithEmail);
            expect(result).toBe("Collaborator Removed Failed");
        });

        it("should return 'AccessKeys Deleted Failed' for DELETE AccessKeys with status 500", () => {
            const result = (appInsights as any).getTagProperty("DELETE", "/accessKeys", 500, ServiceResource.AccessKeys);
            expect(result).toBe("AccessKeys Deleted Failed");
        });

        // Special cases for auth resources (should return just the tag)
        it("should return 'Login with GitHub' for POST LoginGitHub", () => {
            const result = (appInsights as any).getTagProperty("POST", "/auth/login/github", 200, ServiceResource.LoginGitHub);
            expect(result).toBe("Login with GitHub");
        });

        it("should return 'Login with Microsoft' for POST LoginMicrosoft", () => {
            const result = (appInsights as any).getTagProperty("POST", "/auth/login/microsoft", 200, ServiceResource.LoginMicrosoft);
            expect(result).toBe("Login with Microsoft");
        });

        it("should return 'Register with GitHub' for POST RegisterGitHub", () => {
            const result = (appInsights as any).getTagProperty("POST", "/auth/register/github", 200, ServiceResource.RegisterGitHub);
            expect(result).toBe("Register with GitHub");
        });

        it("should return 'Register with Microsoft' for POST RegisterMicrosoft", () => {
            const result = (appInsights as any).getTagProperty("POST", "/auth/register/microsoft", 200, ServiceResource.RegisterMicrosoft);
            expect(result).toBe("Register with Microsoft");
        });

        it("should return 'Link GitHub account' for POST LinkGitHub", () => {
            const result = (appInsights as any).getTagProperty("POST", "/auth/link/github", 200, ServiceResource.LinkGitHub);
            expect(result).toBe("Link GitHub account");
        });

        it("should return 'Link Microsoft account' for POST LinkMicrosoft", () => {
            const result = (appInsights as any).getTagProperty("POST", "/auth/link/microsoft", 200, ServiceResource.LinkMicrosoft);
            expect(result).toBe("Link Microsoft account");
        });

        // Additional GET tests for different resources
        it("should return 'Get AccessKeys' for GET AccessKeys", () => {
            const result = (appInsights as any).getTagProperty("GET", "/accessKeys", 200, ServiceResource.AccessKeys);
            expect(result).toBe("Get AccessKeys");
        });

        it("should return 'Get App' for GET AppsWithId", () => {
            const result = (appInsights as any).getTagProperty("GET", "/apps/abc123", 200, ServiceResource.AppsWithId);
            expect(result).toBe("Get App");
        });

        it("should return 'Get Deployments' for GET Deployments", () => {
            const result = (appInsights as any).getTagProperty("GET", "/apps/abc123/deployments", 200, ServiceResource.Deployments);
            expect(result).toBe("Get Deployments");
        });

        it("should return 'Get Deployment' for GET DeploymentsWithId", () => {
            const result = (appInsights as any).getTagProperty("GET", "/apps/abc123/deployments/xyz123", 200, ServiceResource.DeploymentsWithId);
            expect(result).toBe("Get Deployment");
        });

        it("should return 'Get Collaborators' for GET Collaborators", () => {
            const result = (appInsights as any).getTagProperty("GET", "/apps/abc123/collaborators", 200, ServiceResource.Collaborators);
            expect(result).toBe("Get Collaborators");
        });

        it("should return 'Get Deployment Metrics' for GET Metrics", () => {
            const result = (appInsights as any).getTagProperty("GET", "/apps/abc123/deployments/xyz123/metrics", 200, ServiceResource.Metrics);
            expect(result).toBe("Get Deployment Metrics");
        });

        it("should return 'Get DeploymentHistory' for GET DeploymentHistory", () => {
            const result = (appInsights as any).getTagProperty("GET", "/apps/abc123/deployments/xyz123/history", 200, ServiceResource.DeploymentHistory);
            expect(result).toBe("Get DeploymentHistory");
        });

        // Test for unknown method
        it("should return null for unknown HTTP method", () => {
            const result = (appInsights as any).getTagProperty("PUT", "/some-url", 200, ServiceResource.Release);
            expect(result).toBeNull();
        });

        // Test for Other resource type
        it("should return null for Other resource type", () => {
            const result = (appInsights as any).getTagProperty("GET", "/some-unknown-url", 200, ServiceResource.Other);
            expect(result).toBeNull();
        });

        it("private method reportStatus should set the deployment key and status", () => {
            let tagProperties = {};
            const result = (appInsights as any).reportStatus(tagProperties, "DeploymentSucceeded", "abc123");
            expect(tagProperties).toStrictEqual({
                "Deployment Key": "abc123",
                "Deployment status": "DeploymentSucceeded",
            });
            expect(result).toBeUndefined();
        });
    });
    describe("trackexception", () => {
        let appInsights:AppInsights;
        beforeEach(() => {
            jest.clearAllMocks();
            process.env.APP_INSIGHTS_INSTRUMENTATION_KEY = "test";
            jest.resetModules();
            const { AppInsights } = require("../script/routes/app-insights");
            appInsights = new AppInsights();
        });
        afterEach(() => {
            jest.restoreAllMocks();
        });
        it("trackexception should not call trackException if err is null", () => {
            (appInsights as any).trackException(null);
            expect(mockApplicationInsights.defaultClient.trackException).not.toHaveBeenCalled();
        });
        it("trackexception should call trackException if err is not null", () => {
            (appInsights as any).trackException(new Error("test"));
            const { AppInsights } = require("../script/routes/app-insights");
            expect(AppInsights.isAppInsightsInstrumented()).toBe(true);
            expect(mockApplicationInsights.defaultClient.trackException).toHaveBeenCalledWith({ exception: new Error("test") });
        });
        it("trackexception should not call trackException if INSTRUMENTATION_KEY is not set", () => {
            delete process.env.APP_INSIGHTS_INSTRUMENTATION_KEY;
            jest.resetModules();
            const { AppInsights } = require("../script/routes/app-insights");
            expect(AppInsights.isAppInsightsInstrumented()).toBe(false);
            appInsights = new AppInsights();
            (appInsights as any).trackException(new Error("test"));
            expect(mockApplicationInsights.defaultClient.trackException).not.toHaveBeenCalled();
        });
    });
});
  