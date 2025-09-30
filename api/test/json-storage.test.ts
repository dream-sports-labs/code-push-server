import * as assert from "assert";
import * as shortid from "shortid";

import { AzureStorage } from "../script/storage/azure-storage";
import { JsonStorage } from "../script/storage/json-storage";
import * as storageTypes from "../script/storage/storage";
import * as utils from "./utils.test";

describe("JsonStorage Tests", () => {
  let storage: JsonStorage;

  beforeEach(() => {
    storage = new JsonStorage(true);
  });

  afterEach(async (): Promise<void> => {
    try {
      await storage.dropAll();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("checkHealth", () => {
        it("should be healthy if and only if running Azure storage", () => {
        return storage.checkHealth().then(
            /*returnedHealthy*/ () => {
            assert.equal(JsonStorage, AzureStorage, "Should only return healthy if running Azure storage");
            },
            /*returnedUnhealthy*/ () => {
            assert.equal(JsonStorage, JsonStorage, "Should only return unhealthy if running JSON storage");
            }
        );
        });
  });
  describe("Account", () => {

      describe("getAccount", () => {
          it("can get an account by accountId", () => {
              var account: storageTypes.Account = utils.makeAccount();
              account.name = "test 456";

              return storage
                .addAccount(account)
                .then((accountId: string) => {
                  return storage.getAccount(accountId);
                })
                .then((accountFromApi: storageTypes.Account) => {
                  assert.equal(accountFromApi.name, "test 456");
                });
          });

          it("will reject promise for a non-existent account by accountId", () => {
              return storage.getAccount("IdThatDoesNotExist").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
                assert.equal(error.code, storageTypes.ErrorCode.NotFound);
              });
            });
      });

      describe("getAccountByEmail", () => {
          it("can get an account by email", () => {
              var account: storageTypes.Account = utils.makeAccount();
              account.name = "test 789";

              return storage
                .addAccount(account)
                .then((accountId: string) => {
                  return storage.getAccountByEmail(account.email);
                })
                .then((accountFromApi: storageTypes.Account) => {
                  assert.equal(accountFromApi.name, account.name);
                });
            });
      });

      describe("updateAccount", () => {
          it("can update an account's provider details", () => {
              var account: storageTypes.Account = utils.makeAccount();

              return storage
                .addAccount(account)
                .then((accountId: string) => {
                  account.id = accountId;
                  var updates: any = { gitHubId: "2" };
                  return storage.updateAccount(account.email, updates);
                })
                .then(() => {
                  return storage.getAccount(account.id);
                })
                .then((updatedAccount: storageTypes.Account) => {
                  assert.equal(updatedAccount.name, account.name);
                  assert.equal(updatedAccount.email, account.email);
                  assert.equal(updatedAccount.gitHubId, "2");
                  assert(typeof updatedAccount.azureAdId === "undefined");
                  assert(typeof updatedAccount.microsoftId === "undefined");
                });
            });

          it("will throw error for null email in updateAccount", () => {
              var updates: any = { gitHubId: "test" };

              assert.throws(() => {
                storage.updateAccount(null, updates);
              }, (error: Error) => {
                assert.equal(error.message, "No account email");
                return true;
              });
          });
          it("will throw error for empty email in updateAccount", () => {
              var updates: any = { gitHubId: "test" };

              assert.throws(() => {
                storage.updateAccount("", updates);
              }, (error: Error) => {
                assert.equal(error.message, "No account email");
                return true;
              });
            });

          it("will throw error for undefined email in updateAccount", () => {
              var updates: any = { gitHubId: "test" };

              assert.throws(() => {
                storage.updateAccount(undefined, updates);
              }, (error: Error) => {
                assert.equal(error.message, "No account email");
                return true;
              });
          });

      });

      describe("addAccount", () => {
          it("can generate an id for a new account", () => {
              var account: storageTypes.Account = utils.makeAccount();

              return storage.addAccount(account).then((accountId: string) => {
                assert(accountId);
              });
          })

          it("addAccount(...) will not modify the account argument", () => {
              var account: storageTypes.Account = utils.makeAccount();
              var expectedResult: string = JSON.stringify(account);

              return storage.addAccount(account).then((accountId: string) => {
                var actualResult: string = JSON.stringify(account);

                assert.strictEqual(actualResult, expectedResult);
              });
            });

          it("addAccount(...) will not accept duplicate emails even if cased differently", () => {
              var account: storageTypes.Account = utils.makeAccount();
              var expectedResult: string = JSON.stringify(account);

              return storage
                .addAccount(account)
                .then((accountId: string) => {
                  var newAccount: storageTypes.Account = utils.makeAccount();
                  newAccount.email = account.email.toUpperCase();
                  return storage.addAccount(newAccount);
                })
                .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
                  assert.equal(error.code, storageTypes.ErrorCode.AlreadyExists);
                });
          });
      });

      describe("getAccountByEmail", () => {
          it("will reject promise for a non-existent email", () => {
              return storage.getAccountByEmail("non-existent-emaiL@test.com").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
                assert.equal(error.code, storageTypes.ErrorCode.NotFound);
              });
            });
      });

  })

  describe("Tenant", () => {
      var account: storageTypes.Account;
      var tenant: storageTypes.Organization;

      beforeEach(() => {
        account = utils.makeAccount();
        tenant = {
          id: "test-tenant-id",
          displayName: "Test Organization",
          createdBy: "test-user",
          createdTime: Date.now(),
          role: "Owner"
        };

        return storage.addAccount(account).then((accountId: string): void => {
          account.id = accountId;

          // Manually setup tenant data since there's no addTenant method visible
          const jsonStorage = storage as any;
          jsonStorage.tenants = jsonStorage.tenants || {};
          jsonStorage.accountToTenantsMap = jsonStorage.accountToTenantsMap || {};

          jsonStorage.tenants[tenant.id] = tenant;
          jsonStorage.accountToTenantsMap[account.id] = [tenant.id];
        });
      });
      describe("getTenants", () => {
          it("can get tenants for account", () => {
              return storage.getTenants(account.id).then((tenants: storageTypes.Organization[]) => {
                assert.equal(tenants.length, 1);
                assert.equal(tenants[0].id, tenant.id);
                assert.equal(tenants[0].displayName, tenant.displayName);
              });
          });

          it("will reject promise when account has no tenants in getTenants", () => {
              var emptyAccount: storageTypes.Account = utils.makeAccount();

              return storage
                .addAccount(emptyAccount)
                .then((accountId: string) => {
                emptyAccount.id = accountId;
                return storage.getTenants(emptyAccount.id);
              }).then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
                assert.equal(error.code, storageTypes.ErrorCode.NotFound);
              });
          });
      });

      describe("removeTenant", () => {
          it("can remove tenant successfully", () => {
              return storage.removeTenant(account.id, tenant.id).then(() => {
                const jsonStorage = storage as any;
                assert(!jsonStorage.tenants[tenant.id], "Tenant should be removed from tenants map");
                const accountTenants = jsonStorage.accountToTenantsMap[account.id];
                assert(accountTenants.indexOf(tenant.id) === -1, "Tenant should be removed from account mapping");
              });
          });

          it("will reject promise for non-existent account in removeTenant", () => {
          return storage.removeTenant("non-existent-account", tenant.id).then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
          });

          it("will reject promise for non-existent tenant in removeTenant", () => {
          return storage.removeTenant(account.id, "non-existent-tenant").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
          });

          it("will reject promise for both non-existent account and tenant in removeTenant", () => {
          return storage.removeTenant("non-existent-account", "non-existent-tenant").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
          });
      });

  });

  describe("Access Key", () => {
    var account: storageTypes.Account;

    beforeEach(() => {
      account = utils.makeAccount();
      return storage.addAccount(account).then((accountId: string): void => {
        account.id = accountId;
      });
    });

    describe("addAccessKey", () => {
      it("can generate an id for an access key", () => {
          var accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

          return storage.addAccessKey(account.id, accessKey).then((accessKeyId: string): void => {
            assert(accessKeyId);
          });
      });
      it("will return empty string when access key ID already exists", () => {
          var accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();
          const jsonStorage = storage as any;

          return storage
            .addAccessKey(account.id, accessKey)
            .then((accessKeyId: string) => {
            assert(accessKeyId);
            var duplicateAccessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();
            const originalNewId = jsonStorage.newId;
            jsonStorage.newId = () => accessKeyId;

            return storage.
            addAccessKey(account.id, duplicateAccessKey)
            .then((result: string) => {
              jsonStorage.newId = originalNewId;
              assert.equal(result, "");
            });
          });
      });
      it("will reject promise for null account in addAccessKey", () => {
          var accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();
          return storage
            .addAccessKey(null, accessKey)
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
      });

      it("addAccessKey(...) will not modify the accessKey argument", () => {
          var accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();
          var expectedResult: string = JSON.stringify(accessKey);

          return storage.addAccessKey(account.id, accessKey).then((accessKeyId: string): void => {
            var actualResult: string = JSON.stringify(accessKey);

            assert.strictEqual(actualResult, expectedResult);
          });
      });

      it("updateAccessKey(...) will not modify the accessKey argument", () => {
          var accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();
          var expectedResult: string;

          return storage
            .addAccessKey(account.id, accessKey)
            .then((addedAccessKeyId: string): Promise<void> => {
              accessKey.id = addedAccessKeyId;
              accessKey.friendlyName = "updated description";

              expectedResult = JSON.stringify(accessKey);

              return storage.updateAccessKey(account.id, accessKey);
            })
            .then((): void => {
              var actualResult: string = JSON.stringify(accessKey);

              assert.equal(actualResult, expectedResult);
            });
      });

    });

    describe("getAccessKey", () => {
      it("can retrieve an access key by id", () => {
          var accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

          return storage
          .addAccessKey(account.id, accessKey)
          .then((accessKeyId: string): Promise<storageTypes.AccessKey> => {
          return storage.getAccessKey(account.id, accessKeyId);
          })
          .then((retrievedAccessKey: storageTypes.AccessKey): void => {
          assert.equal(retrievedAccessKey.name, accessKey.name);
          assert.equal(retrievedAccessKey.friendlyName, accessKey.friendlyName);
          });
      });

      it("rejects promise for an invalid id", () => {
          var accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

          return storage
            .addAccessKey(account.id, accessKey)
            .then((accessKeyId: string): Promise<storageTypes.AccessKey> => {
              return storage.getAccessKey(account.id, "invalid");
            })
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            });
      });

      it("should reject promise when getting access keys for non-existent account in getAccessKeys", () => {
          const nonExistentAccountId = "non-existent-account-id";

          return storage.getAccessKeys(nonExistentAccountId)
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            });
      });

      it("should reject promise when account has no access keys in getAccessKeys", () => {
          const newAccount: storageTypes.Account = utils.makeAccount();

          return storage.addAccount(newAccount)
            .then((accountId: string) => {
              return storage.getAccessKeys(accountId);
            })
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            });
      });

      it("should successfully retrieve access keys when account has them (lines 692-697)", () => {
          var accessKey1: storageTypes.AccessKey = utils.makeStorageAccessKey();
          var accessKey2: storageTypes.AccessKey = utils.makeStorageAccessKey();
          accessKey1.name = "key1";
          accessKey2.name = "key2";

          return storage
            .addAccessKey(account.id, accessKey1)
            .then(() => {
              return storage.addAccessKey(account.id, accessKey2);
            })
            .then(() => {
              return storage.getAccessKeys(account.id);
            })
            .then((retrievedKeys: storageTypes.AccessKey[]) => {
              assert.equal(retrievedKeys.length, 2);
              assert(retrievedKeys.some(key => key.name === "key1"));
              assert(retrievedKeys.some(key => key.name === "key2"));
            });
      });
    });

    describe("getAccountIdFromAccessKey", () => {
      it("can retrieve the account id by the access key name", () => {
          var accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

          return storage
            .addAccessKey(account.id, accessKey)
            .then((accessKeyId: string): Promise<string> => {
              return storage.getAccountIdFromAccessKey(accessKey.name);
            })
            .then((retrievedAccountId: string): void => {
              assert.equal(retrievedAccountId, account.id);
            });
        });
    });

    describe("removeAccessKey", () => {
      it("can remove an access key", () => {
          var accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

          return storage
            .addAccessKey(account.id, accessKey)
            .then((accessKeyId: string): Promise<void> => {
              return storage.removeAccessKey(account.id, accessKeyId);
            })
            .then((): Promise<storageTypes.AccessKey> => {
              return storage.getAccessKey(account.id, accessKey.id);
            })
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            });
      });
      it("should reject promise when getting account id for non-exitent access key in removeAccessKey", () => {
          const nonExistentAccessKeyId = "non-existent-access-key-id";

          return storage.removeAccessKey(account.id, nonExistentAccessKeyId)
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            });
      });

      it("should reject promise when accesskey has no account id in removeAccessKey", () => {
          const accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

          return storage.removeAccessKey(account.id, accessKey.id)
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            });
      });
    });

    describe("updateAccessKey", () => {
      it("can update an access key", () => {
          var accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

          return storage
            .addAccessKey(account.id, accessKey)
            .then((addedAccessKeyId: string): Promise<void> => {
              accessKey.id = addedAccessKeyId;
              accessKey.friendlyName = "updated description";

              return storage.updateAccessKey(account.id, accessKey);
            })
            .then((): Promise<storageTypes.AccessKey> => {
              return storage.getAccessKey(account.id, accessKey.id);
            })
            .then((retrievedAccessKey: storageTypes.AccessKey): void => {
              assert.equal(retrievedAccessKey.friendlyName, "updated description");
            });
      });

      it("should reject promise when empty access key id in updateAccessKey", () => {
          const accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

          return storage.updateAccessKey(account.id, accessKey)
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            });
      });

      it("should reject promise when empty access key in updateAccessKey", () => {
          return storage.updateAccessKey(account.id, null)
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            });
      });
    });

    describe("getUserFromAccessKey", () => {
      it("can get user account from access key", () => {
          var accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

          return storage
            .addAccessKey(account.id, accessKey)
            .then((accessKeyId: string): Promise<storageTypes.Account> => {
              return storage.getUserFromAccessKey(accessKey.name);
            })
            .then((retrievedAccount: storageTypes.Account) => {
              assert.equal(retrievedAccount.id, account.id);
              assert.equal(retrievedAccount.email, account.email);
              assert.equal(retrievedAccount.name, account.name);
            });
      });
    });

    describe("getUserFromAccessToken", () => {
      it("can get user account from access token", () => {
          var accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();
          return storage
            .addAccessKey(account.id, accessKey)
            .then((accessKeyId: string): Promise<storageTypes.Account> => {
              return storage.getUserFromAccessToken(accessKey.name);
            })
            .then((retrievedAccount: storageTypes.Account) => {
              assert.equal(retrievedAccount.id, account.id);
              assert.equal(retrievedAccount.email, account.email);
              assert.equal(retrievedAccount.name, account.name);
            });
      });
      it("rejects promise for an invalid access token in getUserFromAccessToken", () => {
          return storage
            .getUserFromAccessToken("non")
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            });
      });

    });

    describe("getAccountIdFromAccessKey   ", () => {
      it("rejects promise for expired access key", () => {
          var expiredAccessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();
          expiredAccessKey.expires = new Date().getTime() - (60 * 60 * 1000);

          return storage
            .addAccessKey(account.id, expiredAccessKey)
            .then((accessKeyId: string): Promise<string> => {
              return storage.getAccountIdFromAccessKey(expiredAccessKey.name);
            })
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.Expired);
              assert.equal(error.message, "The access key has expired.");
            });
        });
    });



  });

  describe("App", () => {
    var account: storageTypes.Account;
    var collaboratorNotFoundMessage: string = "The specified e-mail address doesn't represent a registered user";

    beforeEach(() => {
      account = utils.makeAccount();

      return storage.addAccount(account).then((accountId: string) => {
        account.id = accountId;
      });
    });

    describe("addApp", () => {
      it("can add an app", () => {
          var app: storageTypes.App = utils.makeStorageApp();

          return storage.addApp(account.id, app).then((addedApp: storageTypes.App) => {
            assert(addedApp.id);
          });
      });

      it("rejects promise when adding to a non-existent account", () => {
      var app: storageTypes.App = utils.makeStorageApp();

      return storage.addApp("non-existent", app).then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
      });
      it("addApp(...) will not modify the app argument", () => {
          var app: storageTypes.App = utils.makeStorageApp();
          var expectedResult: string = JSON.stringify(app);

          return storage.addApp(account.id, app).then((addedApp: storageTypes.App) => {
            var actualResult: string = JSON.stringify(app);

            assert.strictEqual(actualResult, expectedResult);
          });
      });
    });

    describe("getApp", () => {
      it("can retrieve an app by id", () => {
          var app: storageTypes.App = utils.makeStorageApp();
          app.name = "my app";

          return storage
            .addApp(account.id, app)
            .then((addedApp: storageTypes.App) => {
              return storage.getApp(account.id, addedApp.id);
            })
            .then((retrievedApp: storageTypes.App) => {
              assert.equal(retrievedApp.name, "my app");
            });
      });

      it("rejects promise for an invalid id", () => {
      var app: storageTypes.App = utils.makeStorageApp();
      app.name = "my app";

      return storage
          .addApp(account.id, app)
          .then((addedApp: storageTypes.App) => {
          return storage.getApp(addedApp.id, "invalid");
          })
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
      });

      it("can retrieve apps for account", () => {
      var app: storageTypes.App = utils.makeStorageApp();
      app.name = "my app";

      return storage
          .addApp(account.id, app)
          .then((addedApp: storageTypes.App) => {
          return storage.getApps(account.id);
          })
          .then((apps: storageTypes.App[]) => {
          assert.equal(1, apps.length);
          assert.equal(apps[0].name, "my app");
          });
      });

      it("can retrieve empty app list for account", () => {
      return storage.getApps(account.id).then((apps: storageTypes.App[]) => {
          assert.equal(0, apps.length);
      });
      });

      it("rejects promise when retrieving by invalid account", () => {
      return storage.getApps("invalid").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
      });
    });

    describe("removeApp", () => {
      it("can remove an app", () => {
          var app: storageTypes.App = utils.makeStorageApp();
          var deployment: storageTypes.Deployment = utils.makeStorageDeployment();

          return storage
            .addApp(account.id, app)
            .then((addedApp: storageTypes.App) => {
              app.id = addedApp.id;
              return storage.addDeployment(account.id, app.id, deployment);
            })
            .then((deploymentId: string) => {
              deployment.id = deploymentId;
              return storage.removeApp(account.id, app.id);
            })
            .then(() => {
              return storage.getApp(account.id, app.id);
            })
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
              return storage.getDeployment(account.id, app.id, deployment.id);
            })
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
              return storage.getPackageHistoryFromDeploymentKey(deployment.key);
            })
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            });
      });

      it("rejects promise when removing a non-existent app", () => {
          return storage.removeApp(account.id, "invalid").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
      });

        it("will throw error when removing app with wrong account ID", () => {
          var app: storageTypes.App = utils.makeStorageApp();
          var wrongAccount: storageTypes.Account = utils.makeAccount();

          return storage
            .addAccount(wrongAccount)
            .then((wrongAccountId: string) => {
              wrongAccount.id = wrongAccountId;
              return storage.addApp(account.id, app);
            })
            .then((addedApp: storageTypes.App) => {
              app.id = addedApp.id;

              assert.throws(() => {
                storage.removeApp(wrongAccount.id, app.id);
              }, (error: Error) => {
                assert.equal(error.message, "Wrong accountId");
                return true;
              });
            });
      });
    });

    describe("updateApp", () => {
      it("can update an app", () => {
          var app: storageTypes.App = utils.makeStorageApp();
          var appId: string;

          return storage
            .addApp(account.id, app)
            .then((addedApp: storageTypes.App) => {
              appId = addedApp.id;
              var updatedApp: storageTypes.App = utils.makeStorageApp();
              updatedApp.id = appId;
              updatedApp.name = "updated name";
              return storage.updateApp(account.id, updatedApp);
            })
            .then(() => {
              return storage.getApp(account.id, appId);
            })
            .then((retrievedApp: storageTypes.App) => {
              assert.equal(retrievedApp.name, "updated name");
            });
      });

      it("will reject promise when updating non-existent entry", () => {
      var app: storageTypes.App = utils.makeStorageApp();
      app.id = "non-existent";

      return storage.updateApp(account.id, app).then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
      });
      it("updateApp(...) will not modify the app argument", () => {
          var app: storageTypes.App = utils.makeStorageApp();
          var appId: string;
          var updatedApp: storageTypes.App;
          var expectedResult: string;

          return storage
            .addApp(account.id, app)
            .then((addedApp: storageTypes.App) => {
              appId = addedApp.id;

              updatedApp = utils.makeStorageApp();
              updatedApp.id = appId;
              updatedApp.name = "updated name";

              expectedResult = JSON.stringify(updatedApp);

              return storage.updateApp(account.id, updatedApp);
            })
            .then(() => {
              var actualResult: string = JSON.stringify(updatedApp);

              assert.strictEqual(actualResult, expectedResult);
            });
      });
    });

    describe("Transfer App", () => {
      var account2: storageTypes.Account;
      var account3: storageTypes.Account;
      var appToTransfer: storageTypes.App;

      beforeEach(() => {
        account2 = utils.makeAccount();
        return storage
          .addAccount(account2)
          .then((accountId: string) => {
            account2.id = accountId;
          })
          .then(() => {
            account3 = utils.makeAccount();
            return storage.addAccount(account3);
          })
          .then((accountId: string) => {
            account3.id = accountId;
          })
          .then(() => {
            appToTransfer = utils.makeStorageApp();
            return storage.addApp(account2.id, appToTransfer);
          })
          .then((addedApp: storageTypes.App) => {
            appToTransfer.id = addedApp.id;
          });
      });

      it("will reject promise when transferring to non-existent account", () => {
        return storage
          .transferApp(account2.id, appToTransfer.id, "nonexistent@email.com")
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            assert.equal(error.message, collaboratorNotFoundMessage);
          });
      });

      it("will reject promise when transferring to own account", () => {
        return storage
          .transferApp(account2.id, appToTransfer.id, account2.email)
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.AlreadyExists);
          });
      });

      it("will reject promise when transferring with prototype pollution key", () => {
        return storage
          .transferApp(account2.id, appToTransfer.id, "__proto__")
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.Invalid);
            assert.equal(error.message, "Invalid email parameter");
          });
      });

      it("will successfully transfer app to new account", () => {
        return storage
          .getApps(account3.id)
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
            return storage.transferApp(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getApps(account2.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
          });
      });

      it("will successfully transfer app to existing collaborator", () => {
        return storage
          .getApps(account3.id)
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
            return storage.addCollaborator(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal("Owner", apps[0].collaborators[account2.email].permission);
            assert.equal("Collaborator", apps[0].collaborators[account3.email].permission);
            assert.equal(1, apps.length);
            return storage.transferApp(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            assert.equal("Owner", apps[0].collaborators[account3.email].permission);
            return storage.getApps(account2.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            assert.equal("Collaborator", apps[0].collaborators[account2.email].permission);
          });
      });

      it("will successfully transfer app and not remove any collaborators for app", () => {
        return storage
          .getApps(account3.id)
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
            return storage.addCollaborator(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.addCollaborator(account2.id, appToTransfer.id, account.email);
          })
          .then(() => {
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            assert.equal(3, Object.keys(apps[0].collaborators).length);
            assert.equal("Owner", apps[0].collaborators[account2.email].permission);
            assert.equal("Collaborator", apps[0].collaborators[account3.email].permission);
            assert.equal("Collaborator", apps[0].collaborators[account.email].permission);
            return storage.transferApp(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            assert.equal(3, Object.keys(apps[0].collaborators).length);
            assert.equal("Collaborator", apps[0].collaborators[account2.email].permission);
            assert.equal("Owner", apps[0].collaborators[account3.email].permission);
            assert.equal("Collaborator", apps[0].collaborators[account.email].permission);
          });
      });
    });

    describe("Collaborator", () => {
      var account2: storageTypes.Account;
      var account3: storageTypes.Account;
      var appToTransfer: storageTypes.App;

      beforeEach(() => {
        account2 = utils.makeAccount();
        return storage
          .addAccount(account2)
          .then((accountId: string) => {
            account2.id = accountId;
          })
          .then(() => {
            account3 = utils.makeAccount();
            return storage.addAccount(account3);
          })
          .then((accountId: string) => {
            account3.id = accountId;
          })
          .then(() => {
            appToTransfer = utils.makeStorageApp();
            return storage.addApp(account2.id, appToTransfer);
          })
          .then((addedApp: storageTypes.App) => {
            appToTransfer.id = addedApp.id;
          });
      });

      it("add collaborator successfully", () => {
        return storage
          .getApps(account3.id)
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
            return storage.addCollaborator(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            assert.equal(2, Object.keys(apps[0].collaborators).length);
          });
      });

      it("will reject promise when adding existing collaborator", () => {
        return storage
          .getApps(account3.id)
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
            return storage.addCollaborator(account2.id, appToTransfer.id, account2.email);
          })
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.AlreadyExists);
          });
      });

      it("will reject promise when adding invalid collaborator account", () => {
        return storage
          .getApps(account3.id)
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
            return storage.addCollaborator(account2.id, appToTransfer.id, "nonexistent@email.com");
          })
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            assert.equal(error.message, collaboratorNotFoundMessage);
          });
      });

      it("will reject promise when adding collaborator with __proto__ key", () => {
        return storage
          .addCollaborator(account2.id, appToTransfer.id, "__proto__")
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.Invalid);
            assert.equal(error.message, "Invalid email parameter");
          });
      });
      it("get list of collaborators succesfully", () => {
        return storage
          .addCollaborator(account2.id, appToTransfer.id, account3.email)
          .then(() => {
            return storage.getCollaborators(account2.id, appToTransfer.id);
          })
          .then((collaboratorList: storageTypes.CollaboratorMap) => {
            var keys: string[] = Object.keys(collaboratorList);
            assert.equal(2, keys.length);
            assert.equal(account2.email, keys[0]);
            assert.equal(account3.email, keys[1]);
          });
      });

      it("remove collaborator successfully", () => {
        return storage
          .addCollaborator(account2.id, appToTransfer.id, account3.email)
          .then(() => {
            return storage.getCollaborators(account2.id, appToTransfer.id);
          })
          .then((collaboratorList: storageTypes.CollaboratorMap) => {
            assert.equal(2, Object.keys(collaboratorList).length);
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            return storage.removeCollaborator(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getCollaborators(account2.id, appToTransfer.id);
          })
          .then((collaboratorList: storageTypes.CollaboratorMap) => {
            assert.equal(1, Object.keys(collaboratorList).length);
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
          });
      });

      it("will allow collaborator to remove themselves successfully", () => {
        return storage
          .addCollaborator(account2.id, appToTransfer.id, account3.email)
          .then(() => {
            return storage.getCollaborators(account2.id, appToTransfer.id);
          })
          .then((collaboratorList: storageTypes.CollaboratorMap) => {
            assert.equal(2, Object.keys(collaboratorList).length);
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            return storage.removeCollaborator(account3.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getCollaborators(account2.id, appToTransfer.id);
          })
          .then((collaboratorList: storageTypes.CollaboratorMap) => {
            assert.equal(1, Object.keys(collaboratorList).length);
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
          });
      });

        it("will reject promise when trying to remove app owner as collaborator", () => {
          return storage
            .removeCollaborator(account2.id, appToTransfer.id, account2.email)
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.AlreadyExists);
            });
        });

        it("will reject promise when trying to remove non-existent collaborator", () => {
          return storage
            .removeCollaborator(account2.id, appToTransfer.id, "nonexistent@email.com")
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            });
        });

        it("will reject promise when trying to remove collaborator that was never added", () => {
          return storage
            .removeCollaborator(account2.id, appToTransfer.id, account3.email)
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            });
        });

        it("update collaborators successfully", () => {
          return storage
            .updateCollaborators(account2.id, appToTransfer.id, account3.email, storageTypes.Permissions.Collaborator)
            .then(() => {
              return storage.getCollaborators(account2.id, appToTransfer.id);
            })
        });

        it("will reject promise when trying to update collaborator to Owner", () => {
          return storage
            .updateCollaborators(account2.id, appToTransfer.id, account3.email, storageTypes.Permissions.Owner)
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.Invalid);
            });
        });

        it("can test isAccountIdCollaborator private method", () => {
          const jsonStorage = storage as any;

          // Create a mock collaborator map
          const collaboratorMap: storageTypes.CollaboratorMap = {
            "user1@test.com": {
              accountId: "account-123",
              permission: storageTypes.Permissions.Collaborator
            },
            "user2@test.com": {
              accountId: "account-456",
              permission: storageTypes.Permissions.Owner
            }
          };
          const result1 = jsonStorage.isAccountIdCollaborator(collaboratorMap, "account-123");
          assert.equal(result1, true);
          const result2 = jsonStorage.isAccountIdCollaborator(collaboratorMap, "account-456");
          assert.equal(result2, true);
          const result3 = jsonStorage.isAccountIdCollaborator(collaboratorMap, "non-existent-account");
          assert.equal(result3, false);
          const result4 = jsonStorage.isAccountIdCollaborator({}, "account-123");
          assert.equal(result4, false);
        });

    });
  });


  describe("Deployment", () => {
    var account: storageTypes.Account;
    var app: storageTypes.App;

    beforeEach(() => {
      account = utils.makeAccount();
      app = utils.makeStorageApp();
      return storage
        .addAccount(account)
        .then((accountId: string) => {
          account.id = accountId;
          return storage.addApp(account.id, app);
        })
        .then((addedApp: storageTypes.App) => {
          app.id = addedApp.id;
        });
    });

    describe("addDeployment", () => {
      it("can add a deployment", () => {
          var deployment: storageTypes.Deployment = utils.makeStorageDeployment();

          return storage.addDeployment(account.id, app.id, deployment).then((deploymentId: string) => {
            assert(deploymentId);
          });
        });

        it("add deployment creates empty package history", () => {
          var deployment: storageTypes.Deployment = utils.makeStorageDeployment();

          return storage
            .addDeployment(account.id, app.id, deployment)
            .then((deploymentId: string) => {
              assert(deploymentId);
              return storage.getPackageHistory(account.id, app.id, deploymentId);
            })
            .then((history: storageTypes.Package[]) => {
              assert.equal(history.length, 0);
            });
        });

        it("rejects promise when adding to a non-existent app", () => {
          var deployment: storageTypes.Deployment = utils.makeStorageDeployment();

          return storage
            .addDeployment(account.id, "non-existent", deployment)
            .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            });
        });
        it("addDeployment(...) will not modify the deployment argument", () => {
          var deployment: storageTypes.Deployment = utils.makeStorageDeployment();
          var expectedResult: string = JSON.stringify(deployment);

          return storage.addDeployment(account.id, app.id, deployment).then((deploymentId: string) => {
            var actualResult: string = JSON.stringify(deployment);

            assert.strictEqual(actualResult, expectedResult);
          });
        });
    });

    describe("getDeployment", () => {
      it("rejects promise with an invalid deploymentId", () => {
          return storage.getDeployment(account.id, app.id, "invalid").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
      });

      it("can get a deployment with an account id & deployment id", () => {
          var deployment: storageTypes.Deployment = utils.makeStorageDeployment();
          deployment.name = "deployment123";

          return storage
          .addDeployment(account.id, app.id, deployment)
          .then((deploymentId: string) => {
              return storage.getDeployment(account.id, app.id, deploymentId);
          })
          .then((deployment: storageTypes.Deployment) => {
              assert.equal(deployment.name, "deployment123");
          });
      });

      it("can retrieve deployments for account id & app id", () => {
          var deployment: storageTypes.Deployment = utils.makeStorageDeployment();
          deployment.name = "deployment123";

          return storage
          .addDeployment(account.id, app.id, deployment)
          .then((deploymentId: string) => {
              return storage.getDeployments(account.id, app.id);
          })
          .then((deployments: storageTypes.Deployment[]) => {
              assert.equal(deployments.length, 1);
              assert.equal("deployment123", deployments[0].name);
          });
      });

      it("can retrieve empty deployment list for account", () => {
          var deployment: storageTypes.Deployment = utils.makeStorageDeployment();
          deployment.name = "deployment123";

          return storage.getDeployments(account.id, app.id).then((deployments: storageTypes.Deployment[]) => {
          assert.equal(0, deployments.length);
          });
      });

      it("rejects promise when retrieving by invalid app", () => {
          var deployment: storageTypes.Deployment = utils.makeStorageDeployment();
          deployment.name = "deployment123";

          return storage.getDeployments(account.id, "invalid").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
      });
    });

    describe("removeDeployment", () => {

      it("can remove a deployment", () => {
          var deployment: storageTypes.Deployment = utils.makeStorageDeployment();

          return storage
          .addDeployment(account.id, app.id, deployment)
          .then((deploymentId: string) => {
              deployment.id = deploymentId;
              return storage.removeDeployment(account.id, app.id, deployment.id);
          })
          .then(() => {
              return storage.getDeployment(account.id, app.id, deployment.id);
          })
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
              return storage.getPackageHistoryFromDeploymentKey(deployment.key);
          })
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
              return storage.getPackageHistory(account.id, app.id, deployment.id);
          })
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
              return storage.getApp(account.id, app.id);
          })
          .then((returnedApp: storageTypes.App) => {
              assert.equal(app.name, returnedApp.name);
          });
      });

      it("rejects promise when removing a non-existent deployment", () => {
          return storage.removeDeployment(account.id, app.id, "invalid").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
      });

      it("throws error when removing deployment with wrong app id", () => {
          const wrongApp: storageTypes.App = utils.makeStorageApp();
          let deploymentId: string;

          return storage
          .addDeployment(account.id, app.id, utils.makeStorageDeployment())
          .then((id: string) => {
              deploymentId = id;
              return storage.addApp(account.id, wrongApp);
          })
          .then((addedApp: storageTypes.App) => {
              return storage.removeDeployment(account.id, addedApp.id, deploymentId);
          })
          .then(failOnCallSucceeded, (error: Error) => {
              assert.equal(error.message, "Wrong appId");
          });
      });
    });

    describe("updateDeployment", () => {

      it("can update a deployment", () => {
          var deployment: storageTypes.Deployment = utils.makeStorageDeployment();
          var deploymentId: string;

          return storage
          .addDeployment(account.id, app.id, deployment)
          .then((addedDeploymentId: string) => {
              deploymentId = addedDeploymentId;
              var updatedDeployment: storageTypes.Deployment = utils.makeStorageDeployment();
              updatedDeployment.id = deploymentId;
              updatedDeployment.name = "updated name";
              return storage.updateDeployment(account.id, app.id, updatedDeployment);
          })
          .then(() => {
              return storage.getDeployment(account.id, app.id, deploymentId);
          })
          .then((retrievedDeployment: storageTypes.Deployment) => {
              assert.equal(retrievedDeployment.name, "updated name");
          });
      });

      it("will reject promise when updating non-existent entry", () => {
          var deployment: storageTypes.Deployment = utils.makeStorageDeployment();
          deployment.id = "non-existent";

          return storage.updateDeployment(account.id, app.id, deployment).then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
      });

      it("updateDeployment(...) will not modify the deployment argument", () => {
          var deployment: storageTypes.Deployment = utils.makeStorageDeployment();
          var deploymentId: string;
          var updatedDeployment: storageTypes.Deployment;
          var expectedResult: string;

          return storage
            .addDeployment(account.id, app.id, deployment)
            .then((addedDeploymentId: string) => {
              deploymentId = addedDeploymentId;

              updatedDeployment = utils.makeStorageDeployment();
              updatedDeployment.id = deploymentId;
              updatedDeployment.name = "updated name";

              expectedResult = JSON.stringify(updatedDeployment);

              return storage.updateDeployment(account.id, app.id, updatedDeployment);
            })
            .then((): void => {
              var actualResult: string = JSON.stringify(updatedDeployment);

              assert.strictEqual(actualResult, expectedResult);
            });
      });
      });
  });

  describe("DeploymentInfo", () => {
    var account: storageTypes.Account;
    var app: storageTypes.App;
    var deployment: storageTypes.Deployment;

    beforeEach(() => {
      account = utils.makeAccount();
      app = utils.makeStorageApp();

      return storage
        .addAccount(account)
        .then((accountId: string): Promise<storageTypes.App> => {
          account.id = accountId;

          return storage.addApp(account.id, app);
        })
        .then((addedApp: storageTypes.App): Promise<string> => {
          app.id = addedApp.id;
          deployment = utils.makeStorageDeployment();

          return storage.addDeployment(account.id, app.id, deployment);
        })
        .then((deploymentId: string): void => {
          deployment.id = deploymentId;
        });
    });

    it("can get app and deployment ID's", () => {
      return storage.getDeploymentInfo(deployment.key).then((deploymentInfo: storageTypes.DeploymentInfo): void => {
        assert(deploymentInfo);
        assert.equal(deploymentInfo.appId, app.id);
        assert.equal(deploymentInfo.deploymentId, deployment.id);
      });
    });

    it("will reject promise for invalid deployment key in getDeploymentInfo", () => {
      return storage.getDeploymentInfo("invalid-deployment-key").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
    });

      it("will reject promise for invalid app id in getDeploymentInfo", () => {
        var deployment: storageTypes.Deployment = utils.makeStorageDeployment();

        return storage
          .addDeployment(account.id, app.id, deployment)
          .then((deploymentId: string) => {
            deployment.id = deploymentId;
            const jsonStorage = storage as any;
            delete jsonStorage.deploymentToAppMap[deployment.id];
            return storage.getDeploymentInfo(deployment.key);
          })
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
      });
  });

  describe("Package", () => {
    var account: storageTypes.Account;
    var app: storageTypes.App;
    var deployment: storageTypes.Deployment;
    var blobId: string;
    var blobUrl: string;

    beforeEach(() => {
      account = utils.makeAccount();
      return storage
        .addAccount(account)
        .then((accountId: string) => {
          account.id = accountId;
          app = utils.makeStorageApp();
          return storage.addApp(account.id, app);
        })
        .then((addedApp: storageTypes.App) => {
          app.id = addedApp.id;
          deployment = utils.makeStorageDeployment();
          return storage.addDeployment(account.id, app.id, deployment);
        })
        .then((deploymentId: string) => {
          deployment.id = deploymentId;
          var fileContents = "test blob";
          return storage.addBlob(shortid.generate(), utils.makeStreamFromString(fileContents), fileContents.length);
        })
        .then((savedBlobId: string) => {
          blobId = savedBlobId;
          return storage.getBlobUrl(blobId);
        })
        .then((savedBlobUrl: string) => {
          blobUrl = savedBlobUrl;
        });
    });

    it("can get empty package", () => {
      return storage.getDeployment(account.id, app.id, deployment.id).then((deployment: storageTypes.Deployment) => {
        assert.equal(deployment.package, null);
      });
    });

    describe("getPackageHistoryFromDeploymentKey", () => {
      it("can add and get a package", () => {
          var storagePackage: storageTypes.Package = utils.makePackage();
          storagePackage.blobUrl = blobUrl;
          storagePackage.description = "description123";

          return storage
          .commitPackage(account.id, app.id, deployment.id, storagePackage)
          .then(() => {
              return storage.getPackageHistoryFromDeploymentKey(deployment.key);
          })
          .then((deploymentPackages: storageTypes.Package[]) => {
              assert.equal("description123", deploymentPackages[deploymentPackages.length - 1].description);
          });
      });

      it("rejects promise with a non-existent deploymentKey", () => {
          return storage
          .getPackageHistoryFromDeploymentKey("NonExistentDeploymentKey")
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
              assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
      });

      it("transferApp still returns history from deploymentKey", () => {
          var storagePackage: storageTypes.Package = utils.makePackage();
          var account2: storageTypes.Account = utils.makeAccount();
          storagePackage.blobUrl = blobUrl;
          storagePackage.description = "description123";

          return storage
          .commitPackage(account.id, app.id, deployment.id, storagePackage)
          .then(() => {
              return storage.getPackageHistoryFromDeploymentKey(deployment.key);
          })
          .then((deploymentPackages: storageTypes.Package[]) => {
              assert.equal("description123", deploymentPackages[deploymentPackages.length - 1].description);
              return storage.addAccount(account2);
          })
          .then((accountId: string) => {
              account2.id = accountId;
              return storage.transferApp(account.id, app.id, account2.email);
          })
          .then(() => {
              return storage.removeCollaborator(account.id, app.id, account.email);
          })
          .then(() => {
              return storage.getPackageHistoryFromDeploymentKey(deployment.key);
          })
          .then((deploymentPackages: storageTypes.Package[]) => {
              assert.equal("description123", deploymentPackages[deploymentPackages.length - 1].description);
          });
      });

    if (storage instanceof AzureStorage) {
      it("raises error on uncaught injection attempt", () => {
        assert.throws(() => {
          storage.getPackageHistoryFromDeploymentKey("possible injection attempt");
        });
      });
    }
    });

    describe("commitPackage", () => {
      it("will throw error for null package in commitPackage", () => {
          assert.throws(() => {
          storage.commitPackage(account.id, app.id, deployment.id, null);
          }, (error: Error) => {
          assert.equal(error.message, "No package specified");
          return true;
          });
      });

      it("will reject promise for invalid account in commitPackage", () => {
          var storagePackage: storageTypes.Package = utils.makePackage();
          storagePackage.blobUrl = blobUrl;

          return storage.commitPackage("invalid-account", app.id, deployment.id, storagePackage).then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
      });

      it("will reject promise for invalid app in commitPackage", () => {
          var storagePackage: storageTypes.Package = utils.makePackage();
          storagePackage.blobUrl = blobUrl;

          return storage.commitPackage(account.id, "invalid-app", deployment.id, storagePackage).then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          });
      });

      it("will reject promise for invalid deployment in commitPackage", () => {
        var storagePackage: storageTypes.Package = utils.makePackage();
        storagePackage.blobUrl = blobUrl;

        return storage.commitPackage(account.id, app.id, "invalid-deployment", storagePackage).then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
        });
      });

      it("commitPackage(...) will not modify the appPackage argument", () => {
          var storagePackage: storageTypes.Package = utils.makePackage();

          storagePackage.blobUrl = blobUrl;
          storagePackage.description = "description123";

          var expectedResult: string = JSON.stringify(storagePackage);

          return storage.commitPackage(account.id, app.id, deployment.id, storagePackage).then((): void => {
            var actualResult: string = JSON.stringify(storagePackage);

            assert.strictEqual(actualResult, expectedResult);
          });
      });
    });

    describe("clearPackageHistory", () => {

      it("can clear package history successfully", () => {
        var storagePackage: storageTypes.Package = utils.makePackage();
        storagePackage.blobUrl = blobUrl;
        storagePackage.description = "test package";

        return storage
          .commitPackage(account.id, app.id, deployment.id, storagePackage)
          .then(() => {
            return storage.getPackageHistory(account.id, app.id, deployment.id);
          })
          .then((packages: storageTypes.Package[]) => {
            assert.equal(packages.length, 1);
            return storage.clearPackageHistory(account.id, app.id, deployment.id);
          })
          .then(() => {
            return storage.getPackageHistory(account.id, app.id, deployment.id);
          })
          .then((packages: storageTypes.Package[]) => {
            assert.equal(packages.length, 0);
          });
      });

      it("will reject promise for non-existent deployment in clearPackageHistory", () => {
        return storage.clearPackageHistory(account.id, app.id, "non-existent-deployment").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
        });
      });
    });

    describe("Package history", () => {
      var expectedPackageHistory: storageTypes.Package[];

      beforeEach(() => {
        expectedPackageHistory = [];
        var promiseChain: Promise<void> = Promise.resolve(<void>(null));
        var packageNumber = 1;
        for (var i = 1; i <= 3; i++) {
          promiseChain = promiseChain
            .then(() => {
              var newPackage: storageTypes.Package = utils.makePackage();
              newPackage.blobUrl = blobUrl;
              newPackage.description = shortid.generate();
              expectedPackageHistory.push(newPackage);
              return storage.commitPackage(account.id, app.id, deployment.id, newPackage);
            })
            .then((committedPackage: storageTypes.Package) => {
              var lastPackage: storageTypes.Package = expectedPackageHistory[expectedPackageHistory.length - 1];
              lastPackage.label = "v" + packageNumber++;
              lastPackage.releasedBy = committedPackage.releasedBy;
            });
        }

        return promiseChain;
      });

      it("can get package history", () => {
        return storage.getPackageHistory(account.id, app.id, deployment.id).then((actualPackageHistory: storageTypes.Package[]) => {
          assert.equal(JSON.stringify(actualPackageHistory), JSON.stringify(expectedPackageHistory));
        });
      });

      it("can update package history", () => {
        return storage
          .getPackageHistory(account.id, app.id, deployment.id)
          .then((actualPackageHistory: storageTypes.Package[]) => {
            assert.equal(JSON.stringify(actualPackageHistory), JSON.stringify(expectedPackageHistory));
            expectedPackageHistory[0].description = "new description for v1";
            expectedPackageHistory[1].isMandatory = true;
            expectedPackageHistory[2].description = "new description for v3";
            expectedPackageHistory[2].isMandatory = false;
            expectedPackageHistory[2].isDisabled = true;
            return storage.updatePackageHistory(account.id, app.id, deployment.id, expectedPackageHistory);
          })
          .then(() => {
            return storage.getPackageHistory(account.id, app.id, deployment.id);
          })
          .then((actualPackageHistory: storageTypes.Package[]) => {
            assert.equal(JSON.stringify(actualPackageHistory), JSON.stringify(expectedPackageHistory));
          });
      });

      it("updatePackageHistory does not clear package history", () => {
        return storage
          .getPackageHistory(account.id, app.id, deployment.id)
          .then((actualPackageHistory: storageTypes.Package[]) => {
            assert.equal(JSON.stringify(actualPackageHistory), JSON.stringify(expectedPackageHistory));
            return storage.updatePackageHistory(account.id, app.id, deployment.id, /*history*/ null);
          })
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.Invalid);
            return storage.getPackageHistory(account.id, app.id, deployment.id);
          })
          .then((actualPackageHistory: storageTypes.Package[]) => {
            assert.equal(JSON.stringify(actualPackageHistory), JSON.stringify(expectedPackageHistory));
          });
      });

      it("reject promise for null deployment in updatePackageHistory", () => {
        return storage.updatePackageHistory(account.id, app.id, "null-deployment", expectedPackageHistory).then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
        });
      });


    });
  });

  describe("Blob", () => {
    describe("addBlob", () => {
      it("can add a blob", () => {
          var fileContents = "test stream";
          return storage
            .addBlob(shortid.generate(), utils.makeStreamFromString(fileContents), fileContents.length)
            .then((blobId: string) => {
              assert(blobId);
            });
        });
    });

    describe("getBlobUrl", () => {


      it("can get a blob url", () => {
          var fileContents = "test stream";
          return storage
          .addBlob(shortid.generate(), utils.makeStreamFromString(fileContents), fileContents.length)
          .then((blobId: string) => {
              return storage.getBlobUrl(blobId);
          })
          .then((blobUrl: string) => {
              assert(blobUrl);
              assert(blobUrl.includes("http://"));
          });
      });

      it("can handle string address format in getBlobUrl", () => {
          var fileContents = "test stream";
          const jsonStorage = storage as any;

          return storage
          .addBlob(shortid.generate(), utils.makeStreamFromString(fileContents), fileContents.length)
          .then((blobId: string) => {
              const originalGetBlobServer = jsonStorage.getBlobServer;
              jsonStorage.getBlobServer = () => {
              return Promise.resolve({
                  address: () => "http://custom-server.com"
              });
              };

              return storage.getBlobUrl(blobId).then((url: string) => {
              jsonStorage.getBlobServer = originalGetBlobServer;
              assert.equal(url, `http://custom-server.com/${blobId}`);
              });
          });
      });

      it("will throw error for invalid address format in getBlobUrl", () => {
          var fileContents = "test stream";
          const jsonStorage = storage as any;

          return storage
          .addBlob(shortid.generate(), utils.makeStreamFromString(fileContents), fileContents.length)
          .then((blobId: string) => {
              const originalGetBlobServer = jsonStorage.getBlobServer;
              jsonStorage.getBlobServer = () => {
              return Promise.resolve({
                  address: () => null
              });
              };

              return storage.getBlobUrl(blobId).then(
              () => {
                  jsonStorage.getBlobServer = originalGetBlobServer;
                  throw new Error("Expected getBlobUrl to throw, but it succeeded");
              },
              (error: Error) => {
                  jsonStorage.getBlobServer = originalGetBlobServer;
                  assert.equal(error.message, "Invalid server address format");
              }
              );
          });
      });

      it("should handle IPv6 address :: and convert to 127.0.0.1 (line 634 first branch)", () => {
          var fileContents = "test stream";
          const jsonStorage = storage as any;

          return storage
          .addBlob(shortid.generate(), utils.makeStreamFromString(fileContents), fileContents.length)
          .then((blobId: string) => {
              const originalGetBlobServer = jsonStorage.getBlobServer;
              jsonStorage.getBlobServer = () => {
              return Promise.resolve({
                  address: () => ({
                  address: "::",
                  port: 3000
                  })
              });
              };

              return storage.getBlobUrl(blobId).then((url: string) => {
              jsonStorage.getBlobServer = originalGetBlobServer;
              assert.equal(url, `http://127.0.0.1:3000/${blobId}`);
              });
          });
      });

      it("should handle regular IP address without conversion (line 634 second branch)", () => {
          var fileContents = "test stream";
          const jsonStorage = storage as any;

          return storage
          .addBlob(shortid.generate(), utils.makeStreamFromString(fileContents), fileContents.length)
          .then((blobId: string) => {
              const originalGetBlobServer = jsonStorage.getBlobServer;
              jsonStorage.getBlobServer = () => {
              return Promise.resolve({
                  address: () => ({
                  address: "192.168.1.100",
                  port: 3000
                  })
              });
              };

              return storage.getBlobUrl(blobId).then((url: string) => {
              jsonStorage.getBlobServer = originalGetBlobServer;
              assert.equal(url, `http://192.168.1.100:3000/${blobId}`);
              });
          });
      });
    });


    describe("removeBlob", () => {


    it("can remove a blob", () => {
      var fileContents = "test stream";
      var blobId: string;
      return storage
        .addBlob(shortid.generate(), utils.makeStreamFromString(fileContents), fileContents.length)
        .then((id: string) => {
          blobId = id;
          return storage.removeBlob(blobId);
        })
        .then(() => {
          return storage.getBlobUrl(blobId);
        })
        .then((blobUrl: string) => {
          if (!blobUrl) {
            return null;
          }

          return utils.retrieveStringContentsFromUrl(blobUrl);
        })
        .then((result) => timeout(Promise.resolve(result), 1000, "timeout"))
        .then(
          (retrievedContents: string) => {
            assert.equal(null, retrievedContents);
          },
          (error: any) => {
            if (error instanceof Error) {
              assert.equal(error.message, "timeout");
            } else {
              throw error;
            }
          }
        );
    });
    });

  });

  describe("JsonStorage getBlobServer private method", () => {
    const request = require("supertest");
    let jsonStorage: JsonStorage;
    let testServer: any;

    beforeEach(() => {
      jsonStorage = new JsonStorage();
      (jsonStorage as any)._blobServerPromise = null;
    });

    afterEach((done) => {
      if (testServer) {
        testServer.close(() => {
          testServer = null;
          done();
        });
      } else {
        done();
      }
    });

    it("should return a server instance", async () => {
      testServer = await (jsonStorage as any)["getBlobServer"]();
      assert(testServer, "Server should exist");
      assert(typeof testServer.listen === "function", "Should be HTTP server");
    });


    it("should serve blob content if blob exists", async () => {
      const testBlobId = "test-blob-123";
      const testBlobContent = "test blob content";

      (jsonStorage as any).blobs[testBlobId] = testBlobContent;

      testServer = await (jsonStorage as any)["getBlobServer"]();

      const res = await request(testServer).get(`/${testBlobId}`);
      assert.equal(res.status, 200);
      assert.equal(res.text, testBlobContent);
    });

    it("should return 404 for non-existent blob", async () => {
      const nonExistentBlobId = "non-existent-blob";

      testServer = await (jsonStorage as any)["getBlobServer"]();

      const res = await request(testServer).get(`/${nonExistentBlobId}`);
      assert.equal(res.status, 404);
    });
  });

  describe("private loadStateAsync method", () => {
    const fs = require("fs");
    let originalExists: any;
    let originalReadFile: any;
    let originalAccess: any;
    let jsonStorage: JsonStorage;

    beforeEach(() => {
      originalExists = fs.exists;
      originalReadFile = fs.readFile;
      originalAccess = fs.access;

      jsonStorage = Object.create(JsonStorage.prototype);
      jsonStorage.disablePersistence = false;
      jsonStorage.accounts = {};
      jsonStorage.apps = {};
      jsonStorage.tenants = {};
      jsonStorage.deployments = {};
      jsonStorage.blobs = {};
      jsonStorage.accessKeys = {};
      jsonStorage.accountToAppsMap = {};
      jsonStorage.appToAccountMap = {};
      jsonStorage.emailToAccountMap = {};
      jsonStorage.accountToTenantsMap = {};
      jsonStorage.appToDeploymentsMap = {};
      jsonStorage.deploymentToAppMap = {};
      jsonStorage.deploymentKeyToDeploymentMap = {};
      jsonStorage.accountToAccessKeysMap = {};
      jsonStorage.accessKeyToAccountMap = {};
      jsonStorage.accessKeyNameToAccountIdMap = {};
    });

    afterEach(() => {
      fs.exists = originalExists;
      fs.readFile = originalReadFile;
      fs.access = originalAccess;
    });

    it("should return early when disablePersistence is true", async () => {
      jsonStorage.disablePersistence = true;
      let accessCalled = false;
      fs.access = () => { accessCalled = true; };

      await (jsonStorage as any).loadStateAsync();
      assert.equal(accessCalled, false);
    });

    it("should handle case when JsonStorage.json file does not exist", async () => {
      fs.access = (_, __, callback) => callback(new Error("File does not exist"));
      fs.exists = (_, callback) => callback(false);
      let readFileCalled = false;
      fs.readFile = () => { readFileCalled = true; };

      await (jsonStorage as any).loadStateAsync();

      assert.equal(readFileCalled, false);
      assert.deepEqual(jsonStorage.accounts, {});
      assert.deepEqual(jsonStorage.apps, {});
    });

    it("should load state successfully when valid JsonStorage.json file exists", async () => {
      const mockData = {
        NextIdNumber: 100,
        accounts: { "acc1": { id: "acc1", email: "test@test.com", name: "Test User" } },
        apps: { "app1": { id: "app1", name: "Test App" } },
        tenants: { "tenant1": { id: "tenant1", displayName: "Test Tenant" } },
        deployments: { "dep1": { id: "dep1", name: "Test Deployment" } },
        blobs: { "blob1": "test blob content" },
        accountToAppsMap: { "acc1": ["app1"] },
        appToAccountMap: { "app1": "acc1" },
        emailToAccountMap: { "test@test.com": "acc1" },
        appToDeploymentsMap: { "app1": ["dep1"] },
        deploymentToAppMap: { "app1": ["dep1"] },
        deploymentKeyToDeploymentMap: { "key1": "dep1" },
        accessKeys: { "key1": { id: "key1", name: "Test Key" } },
        accessKeyToAccountMap: { "key1": "acc1" },
        accountToAccessKeysMap: { "acc1": ["key1"] },
        accessKeyNameToAccountIdMap: { "testkey": { accountId: "acc1", expires: 123456789 } }
      };

      fs.access = (_, __, callback) => callback();
      fs.exists = (_, callback) => callback(true);
      fs.readFile = (_, callback) => callback(null, JSON.stringify(mockData));

      await (jsonStorage as any).loadStateAsync();

      assert.equal(JsonStorage.NextIdNumber, 100);
      assert.deepEqual(jsonStorage.accounts, mockData.accounts);
      assert.deepEqual(jsonStorage.apps, mockData.apps);
      assert.deepEqual(jsonStorage.tenants, mockData.tenants);
      assert.deepEqual(jsonStorage.deployments, mockData.deployments);
      assert.deepEqual(jsonStorage.blobs, mockData.blobs);
      assert.deepEqual(jsonStorage.accountToAppsMap, mockData.accountToAppsMap);
      assert.deepEqual(jsonStorage.appToAccountMap, mockData.appToAccountMap);
      assert.deepEqual(jsonStorage.emailToAccountMap, mockData.emailToAccountMap);
      assert.deepEqual(jsonStorage.appToDeploymentsMap, mockData.appToDeploymentsMap);
      assert.deepEqual(jsonStorage.deploymentToAppMap, mockData.deploymentToAppMap);
      assert.deepEqual(jsonStorage.deploymentKeyToDeploymentMap, mockData.deploymentKeyToDeploymentMap);
      assert.deepEqual(jsonStorage.accessKeys, mockData.accessKeys);
      assert.deepEqual(jsonStorage.accessKeyToAccountMap, mockData.accessKeyToAccountMap);
      assert.deepEqual(jsonStorage.accountToAccessKeysMap, mockData.accountToAccessKeysMap);
      assert.deepEqual(jsonStorage.accessKeyNameToAccountIdMap, mockData.accessKeyNameToAccountIdMap);
    });

    it("should verify that fs.access is called with correct parameters", async () => {
      let accessCalledWithPath = false;
      let accessCalledWithMode = false;

      fs.access = (pathName, mode, callback) => {
        if (pathName.endsWith("/JsonStorage.json")) accessCalledWithPath = true;
        if (mode === fs.constants.F_OK) accessCalledWithMode = true;
        callback();
      };
      fs.exists = (_, callback) => callback(false);

      await (jsonStorage as any).loadStateAsync();

      assert.equal(accessCalledWithPath, true);
      assert.equal(accessCalledWithMode, true);
    });

    it("should handle empty JSON file and set default values", async () => {
      fs.access = (_, __, callback) => callback();
      fs.exists = (_, callback) => callback(true);
      fs.readFile = (_, callback) => callback(null, JSON.stringify({}));

      await (jsonStorage as any).loadStateAsync();

      assert.equal(JsonStorage.NextIdNumber, 0);
      assert.deepEqual(jsonStorage.accounts, {});
      assert.deepEqual(jsonStorage.apps, {});
      assert.deepEqual(jsonStorage.tenants, {});
      assert.deepEqual(jsonStorage.deployments, {});
      assert.deepEqual(jsonStorage.blobs, {});
      assert.deepEqual(jsonStorage.accountToAppsMap, {});
      assert.deepEqual(jsonStorage.appToAccountMap, {});
      assert.deepEqual(jsonStorage.emailToAccountMap, {});
    });

    it("should use default values when properties are missing from loaded JSON", async () => {
      const partialMockData = {
        NextIdNumber: 50,
        accounts: { "acc1": { id: "acc1", email: "test@test.com" } }
      };

      fs.access = (_, __, callback) => callback();
      fs.exists = (_, callback) => callback(true);
      fs.readFile = (_, callback) => callback(null, JSON.stringify(partialMockData));

      await (jsonStorage as any).loadStateAsync();

      assert.equal(JsonStorage.NextIdNumber, 50);
      assert.deepEqual(jsonStorage.accounts, partialMockData.accounts);
      assert.deepEqual(jsonStorage.apps, {});
      assert.deepEqual(jsonStorage.tenants, {});
      assert.deepEqual(jsonStorage.deployments, {});
      assert.deepEqual(jsonStorage.blobs, {});
      assert.deepEqual(jsonStorage.accountToAppsMap, {});
      assert.deepEqual(jsonStorage.appToAccountMap, {});
      assert.deepEqual(jsonStorage.emailToAccountMap, {});
    });

    it("should handle error in fs.readFile and log it (line 85)", async () => {
      let loggedError: any;
      const testError = new Error("Read file error");
      const originalConsoleLog = console.log;

      console.log = (err: any) => {
        loggedError = err;
      };

      fs.access = (_, __, callback) => callback();
      fs.exists = (_, callback) => callback(true);
      fs.readFile = (_, callback) => {
        callback(testError, JSON.stringify({}));
      };

      await (jsonStorage as any).loadStateAsync();

      console.log = originalConsoleLog;
      assert.equal(loggedError, testError, "Error should be logged on line 85");
    });
  });

  describe("dropAll method", () => {
    let storage: JsonStorage;

    beforeEach(() => {
      storage = new JsonStorage(true);
    });

    it("should reject promise when server.close fails (line 751)", async () => {
      const testError = new Error("Server close failed");

      const mockServer = {
        close: (callback: (err?: Error) => void) => {
          callback(testError);
        }
      };

      (storage as any)._blobServerPromise = Promise.resolve(mockServer);

      try {
        await storage.dropAll();
        assert.fail("Expected dropAll to throw, but it succeeded");
      } catch (error) {
        assert.equal(error, testError, "Should reject with the server close error");
      }
    });

    it("should resolve successfully when server.close succeeds", async () => {
      const mockServer = {
        close: (callback: (err?: Error) => void) => {
          callback();
        }
      };

      (storage as any)._blobServerPromise = Promise.resolve(mockServer);

      await storage.dropAll();
    });

    it("should resolve immediately when no blob server exists", async () => {
      await storage.dropAll();
    });
  });

  describe("private saveStateAsync method ", () => {
    const fs = require("fs");
    let storage: JsonStorage;
    let originalWriteFile: any;
    let originalStringify: any;
    let originalConsoleLog: any;

    beforeEach(() => {
      storage = new JsonStorage(true);
      storage.disablePersistence = false;

      originalWriteFile = fs.writeFile;
      originalStringify = JSON.stringify;
      originalConsoleLog = console.log;
    });

    afterEach(() => {
      fs.writeFile = originalWriteFile;
      JSON.stringify = originalStringify;
      console.log = originalConsoleLog;
    });

    it("should create object with correct structure (lines 116-131)", () => {
      let capturedObj: any;

      JSON.stringify = (obj: any) => {
        capturedObj = obj;
        return "test-string";
      };

      fs.writeFile = () => {};

      storage["saveStateAsync"]();

      assert(capturedObj, "Object should be captured");
      assert.equal(capturedObj.hasOwnProperty('NextIdNumber'), true);
      assert.equal(capturedObj.hasOwnProperty('accounts'), true);
      assert.equal(capturedObj.hasOwnProperty('apps'), true);
      assert.equal(capturedObj.hasOwnProperty('deployments'), true);
      assert.equal(capturedObj.hasOwnProperty('blobs'), true);
      assert.equal(capturedObj.hasOwnProperty('accountToAppsMap'), true);
      assert.equal(capturedObj.hasOwnProperty('appToAccountMap'), true);
      assert.equal(capturedObj.hasOwnProperty('appToDeploymentsMap'), true);
      assert.equal(capturedObj.hasOwnProperty('deploymentToAppMap'), true);
      assert.equal(capturedObj.hasOwnProperty('deploymentKeyToDeploymentMap'), true);
      assert.equal(capturedObj.hasOwnProperty('accessKeys'), true);
      assert.equal(capturedObj.hasOwnProperty('accessKeyToAccountMap'), true);
      assert.equal(capturedObj.hasOwnProperty('accountToAccessKeysMap'), true);
      assert.equal(capturedObj.hasOwnProperty('accessKeyNameToAccountIdMap'), true);
    });

    it("should call JSON.stringify (line 133)", () => {
      let stringifyCalled = false;

      JSON.stringify = () => {
        stringifyCalled = true;
        return "test-string";
      };

      fs.writeFile = () => {};

      storage["saveStateAsync"]();

      assert.equal(stringifyCalled, true, "JSON.stringify should be called");
    });

    it("should call fs.writeFile with correct parameters (line 134)", () => {
      let writeFileParams: any;

      JSON.stringify = () => "stringified-data";

      fs.writeFile = (filename: string, data: string, callback: Function) => {
        writeFileParams = { filename, data, callback: typeof callback };
      };

      storage["saveStateAsync"]();

      assert(writeFileParams, "fs.writeFile should be called");
      assert.equal(writeFileParams.filename, "JsonStorage.json");
      assert.equal(writeFileParams.data, "stringified-data");
      assert.equal(writeFileParams.callback, "function");
    });

    it("should log error in callback when fs.writeFile fails (line 135)", () => {
      let loggedError: any;
      const testError = new Error("Write failed");

      console.log = (err: any) => {
        loggedError = err;
      };

      JSON.stringify = () => "test";
      fs.writeFile = (filename: string, data: string, callback: Function) => {
        callback(testError); // Simulate error
      };

      storage["saveStateAsync"]();

      assert.equal(loggedError, testError, "Error should be logged on line 135");
    });
  });


});

function failOnCallSucceeded(result: any): any {
throw new Error("Expected the promise to be rejected, but it succeeded with value " + (result ? JSON.stringify(result) : result));
}

function timeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(message)), ms)
      )
]);
}