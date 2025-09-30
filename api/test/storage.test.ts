// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as shortid from "shortid";

import { AzureStorage } from "../script/storage/azure-storage";
import { JsonStorage } from "../script/storage/json-storage";
import * as storageTypes from "../script/storage/storage";
import { AppCreationRequest } from "../script/types/rest-definitions";
import * as utils from "./utils.test";


describe("Storage Utility Functions", () => {
  describe("function: clone", () => {
    describe("when source is null", () => {
      it("should return null", () => {
        const source = null;
        const result = storageTypes.clone(source);
        assert.equal(result, null);
      });
    });

    describe("when source is undefined", () => {
      it("should return undefined", () => {
        const source = undefined;
        const result = storageTypes.clone(source);
        assert.equal(result, undefined);
      });
    });

    describe("when source is an object", () => {
      it("should return a deep copy of the object", () => {
        const source = { a: 1, b: 2 };
        const result = storageTypes.clone(source);
        assert.equal(result.a, 1);
        assert.equal(result.b, 2);
      });
    });
  })

    describe("isOwnedByCurrentUser", () => {

      it("should return true when app is owned by current user", () => {
        const app = {
          collaborators: {
            "owner@test.com": {
              accountId: "owner-id",
              permission: storageTypes.Permissions.Owner,
              isCurrentAccount: true } },
          createdTime: Date.now(),
          name: "Test App"
        } as storageTypes.App;
        const result = storageTypes.isOwnedByCurrentUser(app);
        assert.equal(result, true);
      });

      it("should return false when app is not owned by current user", () => {
      const app = {
        collaborators: {
          "owner@test.com": {
            accountId: "owner-id",
            permission: storageTypes.Permissions.Owner,
            isCurrentAccount: false } },
        createdTime: Date.now(),
        name: "Test App"
      } as storageTypes.App;
        const result = storageTypes.isOwnedByCurrentUser(app);
        assert.equal(result, false);
      });
    });

  describe("getOwnerEmail function", () => {
    it("should return owner email when current user is owner", () => {
      const app: storageTypes.App = {
        id: "test-app",
        name: "Test App",
        createdTime: Date.now(),
        collaborators: {
          "owner@test.com": {
            accountId: "owner-id",
            permission: storageTypes.Permissions.Owner,
            isCurrentAccount: true
          }
        }
      };

      assert.equal(storageTypes.getOwnerEmail(app), "owner@test.com");
    });

    it("should return null when no owner exists", () => {
      const app: storageTypes.App = {
        id: "test-app",
        name: "Test App",
        createdTime: Date.now(),
        collaborators: {
          "collaborator@test.com": {
            accountId: "collab-id",
            permission: storageTypes.Permissions.Collaborator,
            isCurrentAccount: true
          }
        }
      };

      assert.equal(storageTypes.getOwnerEmail(app), null);
    });
  });

  describe("isPrototypePollutionKey function", () => {
    it("should return true for dangerous prototype pollution keys", () => {
      assert.equal(storageTypes.isPrototypePollutionKey("__proto__"), true);
      assert.equal(storageTypes.isPrototypePollutionKey("constructor"), true);
      assert.equal(storageTypes.isPrototypePollutionKey("prototype"), true);
    });
  });


  describe("NameResolver functions", () => {

    describe("isDuplicate", () => {
    it("should return true when name matches and current user is owner in isDuplicate", () => {
      const app: storageTypes.App = {
        id: "test-app",
        name: "Test App",
        createdTime: Date.now(),
        collaborators: {
          "owner@test.com": {
            accountId: "owner-id",
            permission: storageTypes.Permissions.Owner,
            isCurrentAccount: true
          }
        }
      };

      const apps = [app];

      assert.equal(storageTypes.NameResolver.isDuplicate(apps, "Test App"), true);
    });

    it("should return false when array is empty in isDuplicate", () => {
      const apps: storageTypes.App[] = [];
      assert.equal(storageTypes.NameResolver.isDuplicate(apps, "Any Name"), false);
    });

    it("should return false when name matches but current user is not owner in isDuplicate", () => {
      const app: storageTypes.App = {
        id: "test-app",
        name: "Test App",
        createdTime: Date.now(),
        collaborators: {
          "owner@test.com": {
            accountId: "owner-id",
            permission: storageTypes.Permissions.Owner,
            isCurrentAccount: false
          }
        }
      };
      const apps = [app];
      assert.equal(storageTypes.NameResolver.isDuplicate(apps, "Test App"), false);
    });

    it("should return false when current user is owner but name doesn't match in isDuplicate", () => {
      const app: storageTypes.App = {
        id: "test-app",
        name: "Test App",
        createdTime: Date.now(),
        collaborators: {
          "owner@test.com": {
            accountId: "owner-id",
            permission: storageTypes.Permissions.Owner,
            isCurrentAccount: true
          }
        }
      };
      const apps = [app];
      assert.equal(storageTypes.NameResolver.isDuplicate(apps, "Different Name"), false);
    });

    it("should use general overload for non-App items ", () => {
      // Create items without collaborators (like AccessKey)
      const accessKeys = [
        { name: "key1", friendlyName: "Key 1" },
        { name: "key2", friendlyName: "Key 2" }
      ];

      assert.equal(storageTypes.NameResolver.isDuplicate(accessKeys, "key1"), true);
      assert.equal(storageTypes.NameResolver.isDuplicate(accessKeys, "key3"), false);
    });
    });
    describe("isDuplicateApp", () => {
      it("should return true when name matches and current user is owner and app's tenantId matches the requested organisation's tenantId in isDuplicateApp",() => {
        const app: storageTypes.App = {
          id: "test-app-id",
          tenantId: "test-app",
          name: "Test App",
          createdTime: Date.now(),
          collaborators: {
            "owner@test.com": { accountId: "owner-id", permission: storageTypes.Permissions.Owner, isCurrentAccount: true }
          }
        };
        const appRequest: AppCreationRequest = {
          name: "Test App",
          organisation: { orgId: "test-app" }
        };
        const apps = [app];
        assert.equal(storageTypes.NameResolver.isDuplicateApp(apps, appRequest), true);
      })



      it("should return false when name does not matches and current user is owner and app's tenantId matches the requested organisation's tenantId in isDuplicateApp",() => {
        const app: storageTypes.App = {
          id: "test-app-id",
          tenantId: "test-app",
          name: "Test App",
          createdTime: Date.now(),
          collaborators: {
            "owner@test.com": { accountId: "owner-id", permission: storageTypes.Permissions.Owner, isCurrentAccount: true }
          }
        };
        const appRequest: AppCreationRequest = {
          name: "Test",
          organisation: { orgId: "test-app" }
        };
        const apps = [app];
        assert.equal(storageTypes.NameResolver.isDuplicateApp(apps, appRequest), false);
      })

      it("should return false when name matches and current user is not owner and app's tenantId matches the requested organisation's tenantId in isDuplicateApp",() => {
        const app: storageTypes.App = {
          id: "test-app-id",
          tenantId: "test-app",
          name: "Test App",
          createdTime: Date.now(),
          collaborators: {
            "owner@test.com": { accountId: "owner-id", permission: storageTypes.Permissions.Owner, isCurrentAccount: false }
          }
        };
        const appRequest: AppCreationRequest = {
          name: "Test App",
          organisation: { orgId: "test-app" }
        };
        const apps = [app];
        assert.equal(storageTypes.NameResolver.isDuplicateApp(apps, appRequest), false);
      })

      it("should return false when name matches and current user is owner and app's tenantId  does notmatches the requested organisation's tenantId  in isDuplicateApp",() => {
        const app: storageTypes.App = {
          id: "test-app-id",
          tenantId: "test-app",
          name: "Test App",
          createdTime: Date.now(),
          collaborators: {
            "owner@test.com": { accountId: "owner-id", permission: storageTypes.Permissions.Owner, isCurrentAccount: true }
          }
        };
        const appRequest: AppCreationRequest = {
          name: "Test App",
          organisation: { orgId: "test-org" }
        };
        const apps = [app];
        assert.equal(storageTypes.NameResolver.isDuplicateApp(apps, appRequest), false);
      })

      it("should return false when array is empty in isDuplicateApp", () => {
        const apps: storageTypes.App[] = [];
        const appRequest: AppCreationRequest = {
          name: "Test App",
          organisation: { orgId: "test-app" }
        };
        assert.equal(storageTypes.NameResolver.isDuplicateApp(apps, appRequest), false);
      });

      it("should use general overload in isDuplicateApp", () => {
        const accessKeys = [
          { name: "key1", friendlyName: "Key 1" },
          { name: "key2", friendlyName: "Key 2" }
        ];
        const appRequest: AppCreationRequest = {
          name: "key1",
          organisation: { orgId: "test-app" }
        };
        assert.equal(storageTypes.NameResolver.isDuplicateApp(accessKeys, appRequest), true);
      });
      });
    describe("findByTentantId", () => {
      it("should return true when organisation in appRequest is empty in findByTentantId", () => {
        const app: storageTypes.App = {
          id: "test-app-id",
          tenantId: "test-app",
          name: "Test App",
          createdTime: Date.now(),
          collaborators: {
            "owner@test.com": { accountId: "owner-id", permission: storageTypes.Permissions.Owner, isCurrentAccount: true }
          }
        };
        const appRequest: AppCreationRequest = {
          name: "Test App"

        };
        assert.equal(storageTypes.NameResolver.findByTentantId(app, appRequest), true);
      })

      it("should return false when tenantId is empty in findByTentantId", () => {
        const app: storageTypes.App = {
          id: "test-app-id",
          name: "Test App",
          tenantId: "",
          createdTime: Date.now(),
          collaborators: {
            "owner@test.com": { accountId: "owner-id", permission: storageTypes.Permissions.Owner, isCurrentAccount: true }
          }
        };
        const appRequest: AppCreationRequest = {
          name: "Test App",
          organisation: { orgId: "test-app" }
        };
        assert.equal(storageTypes.NameResolver.findByTentantId(app, appRequest), false);

      })
      });
    describe("findByName", () => {
    it("should  return false when array is empty in findByName", () => {
      const accessKeys = [];
      assert.equal(storageTypes.NameResolver.findByName(accessKeys, "key1"), null);
    });
    it("should use app overload in findByName", () => {
      const apps = [
        { name: "app1", email: "owner@test.com", collaborators: { "owner@test.com": { accountId: "owner-id", permission: storageTypes.Permissions.Owner, isCurrentAccount: true } } },
        { name: "app2", email: "owner@test.com", collaborators: { "owner@test.com": { accountId: "owner-id", permission: storageTypes.Permissions.Owner, isCurrentAccount: true } } },
        { name: "app2", email: "owner@test.com", collaborators: { "owner@test.com": { accountId: "owner-id", permission: storageTypes.Permissions.Owner, isCurrentAccount: true } } }
      ];
      assert.equal(storageTypes.NameResolver.findByName(apps, "owner@test.com:app1"), apps[0]);
      assert.equal(storageTypes.NameResolver.findByName(apps, "app2"), apps[1]);
      assert.equal(storageTypes.NameResolver.findByName(apps, "owner@test.com:app1:app2"), null);
    });
    });
    describe("findAppByName", () => {
    it("should return null when no current user owns duplicate apps in findappbyname", () => {
      const apps = [
        { name: "app2", collaborators: { "user1@test.com": { accountId: "user1-id", permission: storageTypes.Permissions.Owner, isCurrentAccount: false } } },
        { name: "app2", collaborators: { "user2@test.com": { accountId: "user2-id", permission: storageTypes.Permissions.Owner, isCurrentAccount: false } } }
      ];

      assert.equal(storageTypes.NameResolver.findByName(apps, "app2"), null);
    });
    it("should return app when only one app is present in findAppbyname", () => {
      const apps = [
        { name: "app2", collaborators: { "user1@test.com": { accountId: "user1-id", permission: storageTypes.Permissions.Owner, isCurrentAccount: false } } },
      ];

      assert.equal(storageTypes.NameResolver.findByName(apps, "app2"), apps[0]);
    });
    });
    describe("findAppByTenantId", () => {
    it("should return null when app length is empty in findappbytenantid", () => {
      const apps = [];
      assert.equal(storageTypes.NameResolver.findAppByTenantId(apps, "test-app", "Test App"), null);
    });

    it("should return null when tenaantid and name does not match in findappbytenantid", () => {
      const apps = [
        { name: "Test App", tenantId: "test-app" ,createdTime: Date.now()},
        { name: "Test App", tenantId: "test-app" ,createdTime: Date.now() }
      ];
      assert.equal(storageTypes.NameResolver.findAppByTenantId(apps, "app", "App"), null);
    });
    });
  });
  describe("resolve functions", () => {

    describe("resolveAccessKey", () => {
    it("should find access key by name in resolveAccessKey", async () => {
      const storage = new JsonStorage(true);
      const nameResolver = new storageTypes.NameResolver(storage);

      const account: storageTypes.Account = {
        name: "Test Account",
        createdTime: Date.now(),
        email: "test@test.com",
      };
      const accessKey: storageTypes.AccessKey = {
        name: "test-access-key",
        friendlyName: "Test Access Key",
        createdTime: Date.now(),
        createdBy: "test machine",
        expires: Date.now() + 1000,
      };
      const accountId = await storage.addAccount(account);
      await storage.addAccessKey(accountId, accessKey);

      const resolvedKey = await nameResolver.resolveAccessKey(accountId, accessKey.name);
      assert.equal(resolvedKey.name, accessKey.name);
      assert.equal(resolvedKey.friendlyName, accessKey.friendlyName);
    });

    it("should throw error when access key is not found in resolveAccessKey", async () => {
      const storage = new JsonStorage(true);
      const nameResolver = new storageTypes.NameResolver(storage);

      const account: storageTypes.Account = {
        name: "Test Account",
        createdTime: Date.now(),
        email: "test@test.com",
      };
      const accountId = await storage.addAccount(account);

      const existingKey: storageTypes.AccessKey = {
        name: "existing-key",
        friendlyName: "Existing Key",
        createdTime: Date.now(),
        createdBy: "test machine",
        expires: Date.now() + 1000,
      };
      await storage.addAccessKey(accountId, existingKey);

      try {
        await nameResolver.resolveAccessKey(accountId, "non-existent-key");
        assert.fail("Expected resolveAccessKey to throw an error, but it didn't");
      } catch (error: any) {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
        assert.equal(error.message, 'Access key "non-existent-key" does not exist.');
      }
    });
    });

    describe("resolveApp", () => {
    it("should find app by name in resolveApp", async () => {
      const storage = new JsonStorage(true);
      const nameResolver = new storageTypes.NameResolver(storage);

      const account: storageTypes.Account = {
        name: "Test Account",
        createdTime: Date.now(),
        email: "test@test.com",
      };
      const accountId = await storage.addAccount(account);
      const app: storageTypes.App = {
        name: "Test App",
        tenantId: "some-tenant-id",  // Add tenantId to match the search
        createdTime: Date.now(),
      };
      const addedApp = await storage.addApp(accountId, app);

      const resolvedApp = await nameResolver.resolveApp(accountId, "Test App", "some-tenant-id");
      assert.equal(resolvedApp.name, app.name);
      assert.equal(resolvedApp.id, addedApp.id);
    });

    it("should throw error when app is not found in resolveApp ", async () => {
      const storage = new JsonStorage(true);
      const nameResolver = new storageTypes.NameResolver(storage);

      const account: storageTypes.Account = {
        name: "Test Account",
        createdTime: Date.now(),
        email: "test@test.com",
      };
      const accountId = await storage.addAccount(account);
      try {
        await nameResolver.resolveApp(accountId, "non-existent-app");
        assert.fail("Expected resolveApp to throw an error, but it didn't");
      } catch (error: any) {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
        assert.equal(error.message, 'App "non-existent-app" does not exist.');
      }
    });
    });

    describe("resolveDeployment", () => {
    it("should find deployment by name in resolveDeployment", async () => {
      const storage = new JsonStorage(true);
      const nameResolver = new storageTypes.NameResolver(storage);

      const account: storageTypes.Account = {
        name: "Test Account",
        createdTime: Date.now(),
        email: "test@test.com",
      };
      const accountId = await storage.addAccount(account);
      const app: storageTypes.App = {
        name: "Test App",
        createdTime: Date.now(),
      };
      const addedApp = await storage.addApp(accountId, app);
      const deployment: storageTypes.Deployment = {
        name: "Test Deployment",
        key: "test-deployment-key",
        createdTime: Date.now(),
      };
      const deploymentId = await storage.addDeployment(accountId, addedApp.id, deployment);
      const resolvedDeployment = await nameResolver.resolveDeployment(accountId, addedApp.id, "Test Deployment");
      assert.equal(resolvedDeployment.name, deployment.name);
      assert.equal(resolvedDeployment.id, deploymentId);
    });

    it("should throw error when deployment is not found in resolveDeployment", async () => {
      const storage = new JsonStorage(true);
      const nameResolver = new storageTypes.NameResolver(storage);

      const account: storageTypes.Account = {
        name: "Test Account",
        createdTime: Date.now(),
        email: "test@test.com",
      };
      const accountId = await storage.addAccount(account);
      const app: storageTypes.App = {
        name: "Test App",
        createdTime: Date.now(),
      };
      const addedApp = await storage.addApp(accountId, app);
      try {
        await nameResolver.resolveDeployment(accountId, addedApp.id, "non-existent-deployment");
        assert.fail("Expected resolveDeployment to throw an error, but it didn't");
      } catch (error: any) {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
        assert.equal(error.message, 'Deployment "non-existent-deployment" does not exist.');
      }
    });
    });
  });

});