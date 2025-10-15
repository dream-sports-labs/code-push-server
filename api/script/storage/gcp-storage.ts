import * as storage from "./storage";
import { Storage as GCSStorage } from '@google-cloud/storage';
import * as stream from "stream";
import { Sequelize, DataTypes } from "sequelize";
import * as shortid from "shortid";
import * as utils from "../utils/common";
import * as mysql from "mysql2/promise";
import * as security from "../utils/security";
import { DB_HOST, DB_PASS, GCS_BUCKET_NAME, GCS_CONFIG, SEQUELIZE_CONFIG } from "./gcp-storage.constants";
// For Node.js 18+ fetch is built-in, for older versions we might need node-fetch
const fetch = globalThis.fetch;

//Creating Access Key
export function createAccessKey(sequelize: Sequelize) {
    return sequelize.define("accessKey", {
        createdBy: { type: DataTypes.STRING, allowNull: false },
        createdTime: { type: DataTypes.FLOAT, allowNull: false },
        expires: { type: DataTypes.FLOAT, allowNull: false },
        description: { type: DataTypes.STRING, allowNull: true },
        friendlyName: { type: DataTypes.STRING, allowNull: false},
        name: { type: DataTypes.STRING, allowNull: false},
        id: { type: DataTypes.STRING, allowNull: false, primaryKey: true},
        isSession: { type: DataTypes.BOOLEAN, allowNull: true},
        scope: {
          type: DataTypes.ENUM({
              values: ["All", "Write", "Read"]
          }),
          allowNull:true
        },
        accountId: { type: DataTypes.STRING, allowNull: false, references: {
            model: sequelize.models["account"],
            key: 'id',
          },},
    })
}

//Creating Account Type
export function createAccount(sequelize: Sequelize) {
  return sequelize.define("account", {
    createdTime: { type: DataTypes.FLOAT, allowNull: false, defaultValue: () => new Date().getTime() },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
  });
}

//Creating App
export function createApp(sequelize: Sequelize) {
    return sequelize.define("apps", {
        createdTime: { type: DataTypes.FLOAT, allowNull: false },
        name: { type: DataTypes.STRING, allowNull: false },
        id: { type: DataTypes.STRING, allowNull: false, primaryKey:true},
        accountId: { type: DataTypes.STRING, allowNull: false, references: {
            model: sequelize.models["account"],
            key: 'id',
          },
        },
        tenantId: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'tenants',
            key: 'id',
          },
        },
    })
}

//Creating Tenants/Orgs
export function createTenant(sequelize: Sequelize) {
  return sequelize.define("tenant", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'accounts',
        key: 'id',
      },
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });
}

//Create Collaborators
export function createCollaborators(sequelize: Sequelize) {
    return sequelize.define("collaborator", {
        email: {type: DataTypes.STRING, allowNull: false},
        accountId: { type: DataTypes.STRING, allowNull: false },
        appId: { type: DataTypes.STRING, allowNull: false },
        permission: {
            type: DataTypes.ENUM({
                values: ["Collaborator", "Owner"]
            }),
            allowNull:true
        },
    })
}

//Create TermsAcceptance
export function createTermsAcceptance(sequelize: Sequelize) {
    return sequelize.define("termsAcceptance", {
        id: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
        accountId: { 
            type: DataTypes.STRING, 
            allowNull: false, 
            unique: true,
            references: {
                model: 'accounts',
                key: 'id',
            }
        },
        email: { type: DataTypes.STRING, allowNull: false },
        termsVersion: { type: DataTypes.STRING, allowNull: false },
        acceptedTime: { type: DataTypes.BIGINT, allowNull: false },
    })
}

//Create Deployment
export function createDeployment(sequelize: Sequelize) {
  return sequelize.define("deployment", {
      id: { type: DataTypes.STRING, allowNull: true, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      key: { type: DataTypes.STRING, allowNull: false },
      packageId: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
              model: sequelize.models["package"],
              key: 'id',
          },
      },
      appId: {
          type: DataTypes.STRING,
          allowNull: false,
          references: {
              model: sequelize.models["apps"],
              key: 'id',
          },
      },
      createdTime: { type: DataTypes.FLOAT, allowNull: true },
  });
}

//Create Package
export function createPackage(sequelize: Sequelize) {
  return sequelize.define("package", {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, primaryKey: true },
      appVersion: { type: DataTypes.STRING, allowNull: false },
      blobUrl: { type: DataTypes.STRING },
      description: { type: DataTypes.STRING },
      diffPackageMap: { type: DataTypes.JSON, allowNull: true },
      isDisabled: DataTypes.BOOLEAN,
      isMandatory: DataTypes.BOOLEAN,
      label: { type: DataTypes.STRING, allowNull: true },
      manifestBlobUrl: { type: DataTypes.STRING, allowNull: true },
      originalDeployment: { type: DataTypes.STRING, allowNull: true },
      originalLabel: { type: DataTypes.STRING, allowNull: true },
      packageHash: { type: DataTypes.STRING, allowNull: false },
      releasedBy: { type: DataTypes.STRING, allowNull: true },
      releaseMethod: {
          type: DataTypes.ENUM({
              values: ["Upload", "Promote", "Rollback"],
          }),
      },
      rollout: { type: DataTypes.FLOAT, allowNull: true },
      size: { type: DataTypes.FLOAT, allowNull: false },
      uploadTime: { type: DataTypes.BIGINT, allowNull: false },
      deploymentId: {
        type: DataTypes.STRING,
        allowNull: true,
        references: {
          model: sequelize.models["deployment"],
          key: 'id',
        },
      },
  });
}

//create App Pointer
export function createAppPointer(sequelize: Sequelize) {
    return sequelize.define("AppPointer", {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
        },
        accountId: {
          type: DataTypes.STRING,
          allowNull: false,
          references: {
            model: 'accounts',
            key: 'id',
          },
        },
        appId: {
          type: DataTypes.STRING,
          allowNull: false,
          references: {
            model: 'apps',
            key: 'id',
          },
        },
        partitionKeyPointer: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        rowKeyPointer: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      });
}

export function createModels(sequelize: Sequelize) {
  // Create models and register them
  const Tenant = createTenant(sequelize);
  const Package = createPackage(sequelize);
  const Deployment = createDeployment(sequelize);
  const Account = createAccount(sequelize);
  const AccessKey = createAccessKey(sequelize);
  const AppPointer = createAppPointer(sequelize);
  const Collaborator = createCollaborators(sequelize);
  const App = createApp(sequelize);
  const TermsAcceptance = createTermsAcceptance(sequelize);

  // Define associations
  // Account and App
  Account.hasMany(App, { foreignKey: 'accountId' });
  App.belongsTo(Account, { foreignKey: 'accountId' });

  // Account and Tenant
  Account.hasMany(Tenant, { foreignKey: 'createdBy' });
  Tenant.belongsTo(Account, { foreignKey: 'createdBy' });

  // Tenant and App (One Tenant can have many Apps)
  Tenant.hasMany(App, { foreignKey: 'tenantId' });
  App.belongsTo(Tenant, { foreignKey: 'tenantId' });

  // App and Deployment (One App can have many Deployments)
  App.hasMany(Deployment, { foreignKey: 'appId' });
  Deployment.belongsTo(App, { foreignKey: 'appId' });

  // Deployment and Package (One Package can be linked to many Deployments)
  Deployment.hasMany(Package, { foreignKey: 'deploymentId', as: 'packageHistory' });
  Package.belongsTo(Deployment, { foreignKey: 'deploymentId' });
  Deployment.belongsTo(Package, { foreignKey: 'packageId', as: 'packageDetails' });

  // Collaborator associations (Collaborators belong to both Account and App)
  Collaborator.belongsTo(Account, { foreignKey: 'accountId' });
  Collaborator.belongsTo(App, { foreignKey: 'appId' });

  // Return all models for convenience
  return {
    Tenant,
    Package,
    Deployment,
    Account,
    AccessKey,
    AppPointer,
    Collaborator,
    App,
    TermsAcceptance,
  };
}

//function to mimic defer function in q package
export function defer<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export const MODELS = {
  COLLABORATOR : "collaborator",
  DEPLOYMENT : "deployment",
  APPS : "apps",
  PACKAGE : "package",
  ACCESSKEY : "accessKey",
  ACCOUNT : "account",
  APPPOINTER: "AppPointer",
  TENANT : "tenant",
  TERMS_ACCEPTANCE : "termsAcceptance"
}

export class GCPStorage implements storage.Storage {
    private gcsClient: GCSStorage;
    private bucketName: string = process.env.GCS_BUCKET_NAME || GCS_BUCKET_NAME;
    private gcsSetupDone = false;
    private sequelizeSetupDone = false;
    private sequelize: Sequelize;
    private setupPromise: Promise<null | Error>;

    public constructor() {
        shortid.characters("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-");

        this.setupPromise = new Promise(async (resolve, reject) => {
          try {
            // Ensure database exists before initializing Sequelize
            const dbExists = await GCPStorage.createDatabaseIfNotExists();
            if (!dbExists) {
              throw new Error("[GCPStorage] constructor() database setup failed");
            }

            // Setup GCS client and bucket
            if (!this.gcsSetupDone) {
              await this.setupGCS();
              this.gcsSetupDone = true;
            }

            // Setup Sequelize
            if (!this.sequelizeSetupDone) {
              await this.setupSequelize();
              this.sequelizeSetupDone = true;
            }

            console.log("[GCPStorage] constructor() setup complete");
            resolve(null);
          } catch (error) {
            console.error("[GCPStorage] constructor() setup failed", error);
            reject(error);
          }
        });
    }

    private static async createDatabaseIfNotExists(): Promise<boolean> {
      try {
          const connection = await mysql.createConnection({
              host: process.env.DB_HOST || DB_HOST,
              user: process.env.DB_USER,
              password: process.env.DB_PASS || DB_PASS,
          });

          await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
          console.log(`[GCPStorage] createDatabaseIfNotExists "${process.env.DB_NAME}" ensured.`);
          await connection.end();

          return true;
      } catch (error) {
          console.error("[GCPStorage] createDatabaseIfNotExists error creating database:", error);
          return false;
      }
    }

    private async setupGCS(): Promise<void> {
      console.log("[GCPStorage] setupGCS() invoked with GCS config", JSON.stringify(GCS_CONFIG, null, 2));
      
      this.gcsClient = new GCSStorage(GCS_CONFIG);
      
      try {
        // For development with fake-gcs-server, we need to handle bucket operations differently
        if (process.env.NODE_ENV === 'development' && process.env.STORAGE_EMULATOR_HOST) {
          console.log(`[GCPStorage] setupGCS() Using fake-gcs-server, skipping bucket existence check`);
          
          // Try to create bucket using direct HTTP call to fake-gcs-server
          try {
            const response = await fetch(`${process.env.STORAGE_EMULATOR_HOST}/storage/v1/b`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: GCS_BUCKET_NAME,
                project: process.env.GCP_PROJECT_ID || 'codepush-local-dev'
              })
            });
            
            if (response.ok) {
              console.log(`[GCPStorage] setupGCS() Bucket ${GCS_BUCKET_NAME} created successfully via HTTP`);
            } else if (response.status === 409) {
              console.log(`[GCPStorage] setupGCS() Bucket ${GCS_BUCKET_NAME} already exists`);
            } else {
              console.log(`[GCPStorage] setupGCS() Bucket creation response: ${response.status} ${response.statusText}`);
            }
          } catch (fetchError) {
            console.log(`[GCPStorage] setupGCS() Direct HTTP bucket creation failed, continuing anyway:`, fetchError.message);
          }
          
        } else {
          // Production: Use proper GCS API
          const bucket = this.gcsClient.bucket(GCS_BUCKET_NAME);
          const [exists] = await bucket.exists();
          
          if (!exists) {
            console.log(`[GCPStorage] setupGCS() Bucket ${GCS_BUCKET_NAME} does not exist, creating it...`);
            await this.gcsClient.createBucket(GCS_BUCKET_NAME);
            console.log(`[GCPStorage] setupGCS() Bucket ${GCS_BUCKET_NAME} created successfully`);
          } else {
            console.log(`[GCPStorage] setupGCS() Bucket ${GCS_BUCKET_NAME} already exists`);
          }
        }
      } catch (error) {
        console.error('[GCPStorage] setupGCS() Error with bucket operations:', error.message);
        
        // For development, we can continue without bucket setup
        if (process.env.NODE_ENV === 'development') {
          console.log('[GCPStorage] setupGCS() Continuing in development mode despite bucket error');
        } else {
          throw error;
        }
      }
    }

    private async setupSequelize(): Promise<void> {
      this.sequelize = new Sequelize(SEQUELIZE_CONFIG);
      console.log("[GCPStorage] Sequelize initialized", JSON.stringify(SEQUELIZE_CONFIG, null, 2));

      console.log("[GCPStorage] Sequelize authenticate");
      await this.sequelize.authenticate();

      createModels(this.sequelize);
      console.log("[GCPStorage] Sequelize models registered");
      
      // await this.sequelize.sync();
      // console.log("[GCPStorage] Sequelize models synced");
    }

    public async cleanup(): Promise<void> {
      if (this.sequelize) {
        await this.sequelize.close();
      }
    }

    public reinitialize(): Promise<void> {
      console.log("Re-initializing GCP storage");
      return this.setupGCS().then(() => this.setupSequelize());
    }

    public checkHealth(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        this.setupPromise
          .then(() => {
            return Promise.all([this.sequelize.authenticate()]);
          })
          .then(() => {
            resolve();
          })
          .catch(reject);
      });
    }

    // Account Management Methods (identical to AWS storage)
    public addAccount(account: storage.Account): Promise<string> {
        account = storage.clone(account); // pass by value
        account.id = shortid.generate();
        return this.setupPromise
          .then(() => {
            return this.sequelize.models[MODELS.ACCOUNT].findOrCreate({where: {id :account.id}, defaults: {
              ...account
            }}); // Successfully fails if duplicate email
          })
          .then(() => {
            return account.id;
          })
          .catch(GCPStorage.storageErrorHandler);
    }

    public getAccount(accountId: string): Promise<storage.Account> {
      console.log("Fetching account for accountId:", accountId); // Debug log
      return this.setupPromise
        .then(() => {
          return this.sequelize.models[MODELS.ACCOUNT].findByPk(accountId)
        })
        .then((account) => {
          console.log("Fetched account:", account.dataValues); // Debug log
          return account.dataValues
        })
        .catch((error) => {
          console.error("Error fetching account:", error.message);
          throw GCPStorage.storageErrorHandler(error);
        });
    }

    public getAccountByEmail(email: string): Promise<storage.Account> {
        return this.setupPromise
            .then(async () => {
              const account = await this.sequelize.models[MODELS.ACCOUNT].findOne({where: {email : email}})
              //Fix this error code
              return account !== null ? Promise.resolve(account.dataValues) : Promise.reject({code: 1})
            })
    }

    public updateAccount(email: string, updateProperties: storage.Account): Promise<void> {
      if (!email) throw new Error("No account email");

      return this.setupPromise
        .then(() => {
          this.sequelize.models[MODELS.ACCOUNT].update({
              ...updateProperties
            },{
            where: {"email" : email},
          },)
        })
        .catch(GCPStorage.storageErrorHandler);
    }

    public getAppOwnershipCount(accountId: string): Promise<number> {
        return this.setupPromise
            .then(() => {
                // Direct query to collaborators table
                return this.sequelize.models[MODELS.COLLABORATOR].count({
                    where: {
                        accountId: accountId,
                        permission: 'Owner'
                    }
                });
            })
            .catch(GCPStorage.storageErrorHandler);
    }

    // Terms acceptance methods (identical to AWS storage)
    public getTermsAcceptance(accountId: string): Promise<storage.TermsAcceptance> {
        return this.setupPromise
            .then(() => {
                return this.sequelize.models[MODELS.TERMS_ACCEPTANCE].findOne({
                    where: { accountId: accountId }
                });
            })
            .then((result: any) => {
                if (!result) {
                    throw storage.storageError(
                        storage.ErrorCode.NotFound,
                        `Terms acceptance record not found for account ${accountId}`
                    );
                }
                return {
                    id: result.id,
                    accountId: result.accountId,
                    email: result.email,
                    termsVersion: result.termsVersion,
                    acceptedTime: result.acceptedTime
                };
            })
            .catch(GCPStorage.storageErrorHandler);
    }

    public addOrUpdateTermsAcceptance(termsAcceptance: storage.TermsAcceptance): Promise<storage.TermsAcceptance> {
        return this.setupPromise
            .then(() => {
                const termsData = {
                    id: termsAcceptance.id || security.generateSecureKey(termsAcceptance.accountId),
                    accountId: termsAcceptance.accountId,
                    email: termsAcceptance.email,
                    termsVersion: termsAcceptance.termsVersion,
                    acceptedTime: termsAcceptance.acceptedTime
                    // createdAt and updatedAt handled by Sequelize defaults
                };

                // Use upsert (INSERT ... ON DUPLICATE KEY UPDATE)
                return this.sequelize.models[MODELS.TERMS_ACCEPTANCE].upsert(termsData, {
                    returning: true
                });
            })
            .then(() => {
                // After upsert, fetch the record to return it
                return this.sequelize.models[MODELS.TERMS_ACCEPTANCE].findOne({
                    where: { accountId: termsAcceptance.accountId }
                });
            })
            .then((result: any) => {
                return {
                    id: result.id,
                    accountId: result.accountId,
                    email: result.email,
                    termsVersion: result.termsVersion,
                    acceptedTime: result.acceptedTime
                };
            })
            .catch(GCPStorage.storageErrorHandler);
    }

    public getAccountIdFromAccessKey(accessKey: string): Promise<string> {
      return this.setupPromise
        .then(() => {
          return this.sequelize.models[MODELS.ACCESSKEY].findOne({
            where: {"name" : accessKey}
          })
        })
        .then((accessKey) => {
          if (new Date().getTime() >= accessKey.dataValues["expires"]) {
            throw storage.storageError(storage.ErrorCode.Expired, "The access key has expired.");
          }

          return accessKey.dataValues["accountId"];
        })
        .catch(GCPStorage.storageErrorHandler);
    }

    // Access Key Management Methods (identical to AWS storage)
    public addAccessKey(accountId: string, accessKey: storage.AccessKey): Promise<string> {
        accessKey.id = shortid.generate();
        return this.setupPromise
          .then(() => {
            // Insert the access key into the database
            return this.sequelize.models[MODELS.ACCESSKEY].create({ ...accessKey, accountId });
          })
          .then(() => {
            return accessKey.id;
          });
    }

    public getUserFromAccessKey(accessKey: string): Promise<storage.Account> {
        return this.setupPromise
        .then(() => {
          return this.sequelize.models[MODELS.ACCESSKEY].findOne({ where: { friendlyName: accessKey } });
        }).then(async (accessKey: any) => {    
          if (!accessKey) {
            throw new Error("Access key not found");
          }
          return this.getAccount(accessKey.accountId);
        }).catch((error: any) => {
          console.error("Error retrieving account:", error);
          throw error;
        });
    }

    public getUserFromAccessToken(accessToken: string): Promise<storage.Account> {
      return this.setupPromise
        .then(() => {
          return this.sequelize.models[MODELS.ACCESSKEY].findOne({ where: { name: accessToken } });
        }).then(async (accessKey: any) => {    
          if (!accessKey) {
            throw new Error("Access key not found");
          }
          return this.getAccount(accessKey.accountId);
        }).catch((error: any) => {
          console.error("Error retrieving account:", error);
          throw error;
        });
    }

    public getAccessKey(accountId: string, accessKeyId: string): Promise<storage.AccessKey> {
        return this.setupPromise
          .then(() => {
            // Find the access key in the database using Sequelize
            return this.sequelize.models[MODELS.ACCESSKEY].findOne({
              where: {
                accountId: accountId,
                id: accessKeyId,
              },
            });
          })
          .then((accessKey: any) => {
            if (!accessKey) {
              throw new Error("Access key not found");
            }
            return accessKey.dataValues; // Return the access key data
          })
          .catch((error: any) => {
            console.error("Error retrieving access key:", error);
            throw error;
          });
    }

    public removeAccessKey(accountId: string, accessKeyId: string): Promise<void> {
        return this.setupPromise
          .then(() => {
            // First, retrieve the access key
            return this.getAccessKey(accountId, accessKeyId);
          })
          .then((accessKey) => {
            if (!accessKey) {
              throw new Error("Access key not found");
            }
    
            // Remove the access key from the database
            return this.sequelize.models[MODELS.ACCESSKEY].destroy({
              where: {
                accountId: accountId,
                id: accessKeyId,
              },
            });
          })
          .then(() => {
            console.log("Access key removed successfully");
          })
          .catch((error: any) => {
            console.error("Error removing access key:", error);
            throw error;
          });
    }

    public updateAccessKey(accountId: string, accessKey: storage.AccessKey): Promise<void> {
        if (!accessKey) {
          throw new Error("No access key provided");
        }
    
        if (!accessKey.id) {
          throw new Error("No access key ID provided");
        }
    
        return this.setupPromise
          .then(() => {
            // Update the access key in the database
            return this.sequelize.models[MODELS.ACCESSKEY].update(accessKey, {
              where: {
                accountId: accountId,
                id: accessKey.id,
              },
            });
          })
          .then(() => {
            console.log("Access key updated successfully");
          })
          .catch((error: any) => {
            console.error("Error updating access key:", error);
            throw error;
          });
    }

    public getAccessKeys(accountId: string): Promise<storage.AccessKey[]> {
        return this.setupPromise
          .then(() => {
            // Retrieve all access keys for the account
            return this.sequelize.models[MODELS.ACCESSKEY].findAll({ where: { accountId } });
          })
          .then((accessKeys: any[]) => {
            return accessKeys.map((accessKey: any) => accessKey.dataValues);
          });
    }

    // App Management Methods (identical to AWS storage)
    public addApp(accountId: string, app: storage.App): Promise<storage.App> {
      app = storage.clone(app); // Clone the app data to avoid mutating the original
      app.id = shortid.generate();
    
      return this.setupPromise
        .then(() => this.getAccount(accountId)) // Fetch account details to check permissions
        .then(async (account: storage.Account) => {
          // Set initial tenantId and tenantName from app data
          let tenantId = app.tenantId;
          let tenantName = app.tenantName;
    
          // Check if a tenantId is provided, and if so, verify or create tenant
          if (tenantId) {
            // Attempt to find the tenant by tenantId and tenantName
            const tenant = await this.sequelize.models[MODELS.TENANT].findOne({
              where: { id: tenantId },
            });
    
            // If tenant is not found or tenantName doesn't match, create a new tenant
            if (!tenant) {
              console.log(`Specified tenant (ID: ${tenantId}, Name: ${tenantName}) does not exist. Creating a new tenant.`);
    
              const idTogenerate = shortid.generate();
              // Create a new tenant with the specified tenantName, owned by the accountId
              const newTenant = await this.sequelize.models[MODELS.TENANT].create({
                id: idTogenerate,
                displayName: tenantName,
                createdBy: accountId,
              });
    
              tenantId = idTogenerate;
            } else {
              // Verify if the user has admin permissions for the existing tenant
              const isAdmin = tenant.dataValues.createdBy === accountId;
              if (!isAdmin) {
                throw new Error("User does not have admin permissions for the specified tenant.");
              }
            }
          } else if(tenantName) {
            //MARK Fix: Check if tenantName does not exist
            const tenant = await this.sequelize.models[MODELS.TENANT].findOne({
              where: { displayName: tenantName },
            });

            if(tenant) {
              throw new Error("An organization or user of this name already exists. Please select a different name.")
            } else {
            // If no tenantId is provided, set tenantId to NULL (app is standalone/personal)
              const idTogenerate = shortid.generate();
              // Create a new tenant with the specified tenantName, owned by the accountId
              const newTenant = await this.sequelize.models[MODELS.TENANT].create({
                id: idTogenerate,
                displayName: tenantName,
                createdBy: accountId,
              });
              tenantId = idTogenerate;
            }
          }
    
          // Set the tenantId on the app object
          app.tenantId = tenantId;
    
          // Add the App with accountId and tenantId
          const addedApp = await this.sequelize.models[MODELS.APPS].create({
            ...app,
            accountId,
          });
    
          // Add a Collaborator entry for the app owner
          const collabMap = {
            email: account.email,
            accountId,
            permission: storage.Permissions.Owner,
            appId: app.id,
          };
          await this.sequelize.models[MODELS.COLLABORATOR].findOrCreate({
            where: { appId: app.id, email: account.email },
            defaults: collabMap,
          });
    
          return addedApp;
        })
        .then(() => app) // Return the app object
        .catch((error) => {
          console.error("Error adding app:", error.message);
          throw GCPStorage.storageErrorHandler(error);
        });
    }

    public getApps(accountId: string): Promise<storage.App[]> {
      return this.setupPromise
        .then(() => {
        // Fetch all tenants where the account is a collaborator
        return this.sequelize.models[MODELS.COLLABORATOR].findAll({
            where: { accountId: accountId },
        });
      }).then((collaborators) => {
          const appIds = collaborators.map((collaborator) => {
              const collaboratorModel = collaborator.dataValues;
              return collaboratorModel.appId;
          });
          return this.sequelize.models[MODELS.APPS].findAll({
              where: {
                  id: appIds, // Match app IDs
              }
          });
      })
        .then(async (flatAppsModel) => {
          const flatApps = flatAppsModel.map((val) => val.dataValues);
          const apps = [];
          for (let i = 0; i < flatApps.length; i++) {
            const updatedApp = await this.getCollabrators(flatApps[i], accountId);
            apps.push(updatedApp);
          }
          return apps;
        })
        .catch(GCPStorage.storageErrorHandler);
    }
    
    public getTenants(accountId: string): Promise<storage.Organization[]> {
      //first get all tenants
      //get apps for each tenant
      //check if user is owner or collaborator of one of that app
      //if yes then serve that tenant
      return this.setupPromise
        .then(() => {
          // Fetch all tenants where the account is a collaborator
          return this.sequelize.models[MODELS.COLLABORATOR].findAll({
            where: { accountId: accountId },
          });
        }).then((collaborators) => {
          const appIds = collaborators.map((collaborator) => {
            const collaboratorModel = collaborator.dataValues;
            return collaboratorModel.appId
          });
          return this.sequelize.models[MODELS.APPS].findAll({
            where: {
              id: appIds, // Match app IDs
            }
          });
        }).then((apps) => {
          const tenantIds = apps.map((app) => app.dataValues.tenantId);
          return this.sequelize.models[MODELS.TENANT].findAll({
            where: {
              id: tenantIds, // Match tenant IDs
            }
          });
        })
        .then((tenantsModel) => {
          // Format tenants into the desired response structure
          const tenants = tenantsModel.map((tenantModel) => {
            const tenant = tenantModel.dataValues;
            const permission = tenant.createdBy === accountId ? "Owner" : "Collaborator";
            //permission could be modified if user account does not belong to Collabrator to any other app of that tenant.
            return {
              id: tenant.id,
              displayName: tenant.displayName, // Assuming `displayName` in Tenant model holds org name
              role: permission,
            };
          });
    
          return tenants;
        })
        .catch(GCPStorage.storageErrorHandler);
    }

    public removeTenant(accountId: string, tenantId: string): Promise<void> {
      return this.setupPromise
        .then( async () => {
          // Remove all apps under the tenant
          //Remove all collaborators from that apps
          //check permission whether user is owner or not
          const tenant = await this.sequelize.models[MODELS.TENANT].findOne({
            where: { id: tenantId },
          });

          if(!tenant) {
            throw storage.storageError(storage.ErrorCode.NotFound, "Specified Organisation does not exist.");
          }

          if(tenant.dataValues.createdBy !== accountId) {
            throw storage.storageError(storage.ErrorCode.Invalid, "User does not have admin permissions for the specified tenant.");
          }

          const apps = await this.sequelize.models[MODELS.APPS].findAll({
            where: { tenantId },
          });
    
          // Iterate over each app and take appropriate action
          for (const app of apps) {
            const appOwnerId = app.dataValues.accountId;
    
            if (appOwnerId === accountId) {
              // If the app is owned by the user, remove it
              await this.removeApp(accountId, app.dataValues.id);
            } else {
              // If the app is not owned by the user, set tenantId to null
              await this.sequelize.models[MODELS.APPS].update(
                { tenantId: null },
                { where: { id: app.dataValues.id } }
              );
            }
          }
        
        })
        .then(() => {
          // Remove the tenant entry
          return this.sequelize.models[MODELS.TENANT].destroy({
            where: { id: tenantId, createdBy: accountId },
          });
        })
        .catch(GCPStorage.storageErrorHandler);
    }
    
    public getApp(accountId: string, appId: string, keepCollaboratorIds: boolean = false): Promise<storage.App> {
      return this.setupPromise
        .then(() => {
          return this.sequelize.models[MODELS.APPS].findByPk(appId, {
            include: [{ model: this.sequelize.models[MODELS.TENANT], as: 'tenant' }], // Include tenant details if available
          });
        })
        .then((flatAppModel) => {
          return this.getCollabrators(flatAppModel.dataValues, accountId);
        })
        .then((app) => {
          return app;
        })
        .catch(GCPStorage.storageErrorHandler);
    }
    
    public removeApp(accountId: string, appId: string): Promise<void> {
      return this.setupPromise
        .then(() => {
          // Remove all collaborator entries for this app
          return this.sequelize.models[MODELS.COLLABORATOR].destroy({
            where: { appId, accountId },
          });
        })
        .then(() => {
          // Remove the app entry
          return this.sequelize.models[MODELS.APPS].destroy({
            where: { id: appId, accountId },
          });
        })
        .then(() => {
          // Remove the app entry
          //MARK: Fix this
          this.removeAppPointer(accountId, appId);
        })
        .catch(GCPStorage.storageErrorHandler);
    }    

    public updateApp(accountId: string, app: storage.App): Promise<void> {
      const appId: string = app.id;
      if (!appId) throw new Error("No app id");

      return this.setupPromise
        .then(() => {
          return this.updateAppWithPermission(accountId,app,true)
        })
        .catch(GCPStorage.storageErrorHandler);
    }

    // Collaborator Management Methods (identical to AWS storage)
    public addCollaborator(accountId: string, appId: string, email: string): Promise<void> {
      return this.setupPromise
        .then(() => {
          const getAppPromise: Promise<storage.App> = this.getApp(accountId, appId, /*keepCollaboratorIds*/ true);
          const accountPromise: Promise<storage.Account> = this.getAccountByEmail(email);
          return Promise.all<any>([getAppPromise, accountPromise]);
        })
        .then(([app, account]: [storage.App, storage.Account]) => {
          // Use the original email stored on the account to ensure casing is consistent
          email = account.email;
          return this.addCollaboratorWithPermissions(accountId, app, email, {
            accountId: account.id,
            permission: storage.Permissions.Collaborator,
          });
        })
        .catch(GCPStorage.storageErrorHandler);
    }

    public updateCollaborators(accountId: string, appId: string, email: string, role: string): Promise<void> {
      return this.setupPromise
      .then(() => {
        const getAppPromise: Promise<storage.App> = this.getApp(accountId, appId, /*keepCollaboratorIds*/ true);
        const requestCollaboratorAccountPromise: Promise<storage.Account> = this.getAccountByEmail(email);
        return Promise.all<any>([getAppPromise, requestCollaboratorAccountPromise]);
      })
      .then(([app, accountToModify]: [storage.App, storage.Account]) => {
        // Use the original email stored on the account to ensure casing is consistent
        email = accountToModify.email;
        let permission = role === "Owner" ? storage.Permissions.Owner : storage.Permissions.Collaborator;
        return this.updateCollaboratorWithPermissions(accountId, app, email, {
          accountId: accountToModify.id,
          permission: permission,
        });
      })
      .catch(GCPStorage.storageErrorHandler);
    }
  
    public getCollaborators(accountId: string, appId: string): Promise<storage.CollaboratorMap> {
      return this.setupPromise
        .then(() => {
          return this.getApp(accountId, appId, /*keepCollaboratorIds*/ false);
        })
        .then((app: storage.App) => {
          return Promise.resolve(app.collaborators);
        })
        .catch(GCPStorage.storageErrorHandler);
    }
  
    public removeCollaborator(accountId: string, appId: string, email: string): Promise<void> {
        return this.setupPromise
        .then(() => {
          // Get the App and Collaborators from the DB
          return this.getApp(accountId, appId, true);
        })
        .then((app: storage.App) => {
          const removedCollabProperties: storage.CollaboratorProperties = app.collaborators[email];
  
          if (!removedCollabProperties) {
            throw storage.storageError(storage.ErrorCode.NotFound, "The given email is not a collaborator for this app.");
          }
  
          // Cannot remove the owner
          if (removedCollabProperties.permission === storage.Permissions.Owner) {
            throw storage.storageError(storage.ErrorCode.AlreadyExists, "Cannot remove the owner of the app from collaborator list.");
          }
  
          // Remove the collaborator
          delete app.collaborators[email];
  
          // Update the App in the DB
          return this.updateAppWithPermission(accountId, app, true).then(() => {
            return this.removeAppPointer(removedCollabProperties.accountId, app.id);
          });
        })
        .catch(GCPStorage.storageErrorHandler);
    }

        // Deployment Management Methods (identical to AWS storage)
        public addDeployment(accountId: string, appId: string, deployment: storage.Deployment): Promise<string> {
            let deploymentId: string;
            return this.setupPromise
                .then(() => {
                    // Generate deployment ID
                    deployment.id = shortid.generate();
                    deploymentId = deployment.id;

                    // Insert the deployment in the DB
                    return this.sequelize.models[MODELS.DEPLOYMENT].create({ ...deployment, appId, createdTime: Date.now() });
                })
                .then(() => {
                    // Return deployment ID
                    return deploymentId;
                })
                .catch(GCPStorage.storageErrorHandler);
        }

        public getDeploymentInfo(deploymentKey: string): Promise<storage.DeploymentInfo> {
            return this.setupPromise
                .then(() => {
                    return this.sequelize.models[MODELS.DEPLOYMENT].findOne({ where: { key: deploymentKey } });
                })
                .then((deployment: any): storage.DeploymentInfo => {
                    if (!deployment) {
                        throw storage.storageError(storage.ErrorCode.NotFound, "Deployment not found");
                    }

                    return { appId: deployment.appId, deploymentId: deployment.id };
                })
                .catch(GCPStorage.storageErrorHandler);
        }

        public getDeployments(accountId: string, appId: string): Promise<storage.Deployment[]> {
            return this.setupPromise
                .then(() => {
                    // Retrieve deployments for the given appId, including the associated Package
                    return this.sequelize.models[MODELS.DEPLOYMENT].findAll({
                        where: { appId: appId },
                    });
                })
                .then((flatDeployments: any[]) => {
                    // Use Promise.all to wait for all unflattenDeployment promises to resolve
                    return Promise.all(flatDeployments.map((flatDeployment) => this.attachPackageToDeployment(accountId, flatDeployment)));
                })
                .catch((error) => {
                    console.error("Error retrieving deployments:", error);
                    throw error;
                });
        }

        public removeDeployment(accountId: string, appId: string, deploymentId: string): Promise<void> {
            //MARK:TODO TEST THIS
            return this.setupPromise
                .then(() => {
                    // Delete the deployment from the database using Sequelize
                    return this.sequelize.models[MODELS.DEPLOYMENT].destroy({
                        where: { id: deploymentId, appId: appId },
                    });
                })
                .then(() => {
                    // Delete history from GCS
                    return this.deleteHistoryBlob(deploymentId);
                })
                .catch((error) => {
                    console.error("Error deleting deployment:", error);
                    throw error;
                });
        }

        public updateDeployment(accountId: string, appId: string, deployment: storage.Deployment): Promise<void> {
            const deploymentId: string = deployment.id;
            if (!deploymentId) throw new Error("No deployment id");

            return this.setupPromise
                .then(() => {
                    // Update deployment details in the database
                    return this.sequelize.models[MODELS.DEPLOYMENT].update(deployment, {
                        where: { id: deploymentId, appId: appId },
                    });
                })
                .then(() => {})
                .catch((error) => {
                    console.error("Error updating deployment:", error);
                    throw error;
                });
        }

        // Package Management Methods (identical to AWS storage)
        public commitPackage(accountId: string, appId: string, deploymentId: string, appPackage: storage.Package): Promise<storage.Package> {
            if (!deploymentId) throw new Error("No deployment id");
            if (!appPackage) throw new Error("No package specified");

            let packageHistory: storage.Package[];
            return this.setupPromise
                .then(() => {
                    // Fetch the package history from GCS
                    return this.getPackageHistory(accountId, appId, deploymentId);
                })
                .then((history: storage.Package[]) => {
                    packageHistory = history;
                    appPackage.label = this.getNextLabel(packageHistory);
                    return this.getAccount(accountId);
                })
                .then(async (account: storage.Account) => {
                    appPackage.releasedBy = account.email;

                    // Remove the rollout value for the last package.
                    const lastPackage: storage.Package = packageHistory.length ? packageHistory[packageHistory.length - 1] : null;
                    //MARK: TODO TEST THIS
                    // if (lastPackage) {
                    //   lastPackage.rollout = null;
                    // }

                    packageHistory.push(appPackage);

                    if (packageHistory.length > 100) { // Define your max history length
                        packageHistory.splice(0, packageHistory.length - 100);
                    }

                    const savedPackage = await this.sequelize.models[MODELS.PACKAGE].create({...appPackage, deploymentId});
                    // Update deployment with the new package information
                    await this.sequelize.models[MODELS.DEPLOYMENT].update(
                        { packageId: savedPackage.dataValues.id },
                        { where: { id: deploymentId, appId } }
                    );
                    return savedPackage.dataValues;
                })
                .catch((error) => {
                    console.error("Error committing package:", error);
                    throw error;
                });
        }

        public clearPackageHistory(accountId: string, appId: string, deploymentId: string): Promise<void> {
            return this.setupPromise
                .then(() => {
                    // Remove all packages linked to the deployment
                    return this.sequelize.models[MODELS.PACKAGE].destroy({
                        where: { deploymentId },
                    });
                })
                .then(() => {
                    // Reset the currentPackageId for the deployment to clear the history
                    return this.sequelize.models[MODELS.DEPLOYMENT].update(
                        { currentPackageId: null },
                        { where: { id: deploymentId, appId } }
                    );
                })
                .then(()=>{})
                .catch((error) => {
                    console.error("Error clearing package history:", error);
                    throw error;
                });
        }

        public getPackageHistory(accountId: string, appId: string, deploymentId: string): Promise<storage.Package[]> {
            return this.setupPromise
                .then(() => {
                    // Fetch all packages associated with the deploymentId, ordered by uploadTime
                    return this.sequelize.models[MODELS.PACKAGE].findAll({
                        where: { deploymentId: deploymentId },
                        order: [['uploadTime', 'ASC']], // Sort by upload time to maintain historical order
                    });
                })
                .then((packageRecords: any[]) => {
                    // Map each package record to the storage.Package format
                    return packageRecords.map((pkgRecord) => this.formatPackage(pkgRecord.dataValues));
                })
                .catch((error) => {
                    console.error("Error retrieving package history:", error);
                    throw error;
                });
        }

        public updatePackageHistory(accountId: string, appId: string, deploymentId: string, history: storage.Package[]): Promise<void> {
            if (!history || !history.length) {
                throw new Error("Cannot clear package history from an update operation");
            }

            return this.setupPromise
            .then(async () => {
                for (const appPackage of history) {
                    // Find the existing package in the table using unique label and packageHash for data integrity
                    const existingPackage = await this.sequelize.models[MODELS.PACKAGE].findOne({
                        where: { 
                            deploymentId: deploymentId, 
                            label: appPackage.label,
                            packageHash: appPackage.packageHash
                        },
                    });

                    if (existingPackage) {

                        const existingData = existingPackage.dataValues;

                        const isChanged = Object.keys(appPackage).some((key) => {
                            return appPackage[key] !== existingData[key];
                        });

                        // Update the package if it has been changed
                        if (isChanged) {
                            await this.sequelize.models[MODELS.PACKAGE].update(appPackage, {
                                where: { id: existingData.id },
                            });
                        }
                    } else {
                        // If the package does not exist, insert it
                        await this.sequelize.models[MODELS.PACKAGE].create({
                            ...appPackage,
                            deploymentId: deploymentId,
                        });
                    }
                }
            })
            .then(() => {})
            .catch((error) => {
                console.error("Error updating package history:", error);
                throw error;
            });
        }

        public getPackageHistoryFromDeploymentKey(deploymentKey: string): Promise<storage.Package[]> {
            return this.setupPromise
                .then(async () => {
                    let deployment = await this.sequelize.models[MODELS.DEPLOYMENT].findOne({ where: { key: deploymentKey } });
                    if (!deployment?.dataValues) {
                        console.log(`Deployment not found for key: ${deploymentKey}`);
                        return [];
                    }
                    return deployment.dataValues;
                })
                .then((deployment: storage.Deployment) => {
                    // Fetch all packages associated with the deploymentId, ordered by uploadTime
                    if (!deployment?.id) {
                        console.log("Skipping package lookup due to missing deployment data.");
                        return [];
                    }
                    return this.sequelize.models[MODELS.PACKAGE].findAll({
                        where: { deploymentId: deployment.id },
                        order: [['uploadTime', 'ASC']], // Sort by upload time to maintain historical order
                    });
                })
                .then((packageRecords: any[]) => {
                    if (!Array.isArray(packageRecords) || packageRecords.length === 0) {
                        console.log("No packages found for the given deployment.");
                        return [];
                    }
                    // Map each package record to the storage.Package format
                    return packageRecords.map((pkgRecord) => this.formatPackage(pkgRecord.dataValues));
                })
                .catch((error) => {
                    console.error("Error retrieving package history:", error);
                    throw error;
                });
        }

        // GCS Blob Management Methods
        public addBlob(blobId: string, stream: stream.Readable, streamLength: number): Promise<string> {
            return this.setupPromise
                .then(() => {
                    // Generate a unique key if blobId is not provided
                    if (!blobId) {
                        blobId = `deployments/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.zip`;
                        console.log("Generated Blob ID:", blobId);
                    }

                    // Convert the stream to a buffer
                    return utils.streamToBufferS3(stream);
                })
                .then((buffer) => {
                    // Upload the buffer to GCS
                    const bucket = this.gcsClient.bucket(this.bucketName);
                    const file = bucket.file(blobId);
                    
                    return new Promise<void>((resolve, reject) => {
                        const writeStream = file.createWriteStream({
                            metadata: {
                                contentType: 'application/zip', // Assume all deployments are zipped
                            },
                        });

                        writeStream.on('error', reject);
                        writeStream.on('finish', resolve);
                        writeStream.end(buffer);
                    });
                })
                .then(() => {
                    console.log('blobId here ::', blobId);
                    return blobId; // Return the Blob ID for further use
                })
                .catch((error) => {
                    console.error("Error adding blob:", error);
                    throw error;
                });
        }

        public getBlobUrl(blobId: string): Promise<string> {
            return this.setupPromise
                .then(async () => {
                    if (process.env.NODE_ENV === "development") {
                        // For development with fake-gcs-server, return a direct URL
                        const baseUrl = process.env.STORAGE_EMULATOR_HOST || 'http://localhost:4443';
                        return `${baseUrl}/storage/v1/b/${this.bucketName}/o/${encodeURIComponent(blobId)}?alt=media`;
                    } else {
                        // For production, get a signed URL from GCS
                        const bucket = this.gcsClient.bucket(this.bucketName);
                        const file = bucket.file(blobId);
                        
                        const [signedUrl] = await file.getSignedUrl({
                            action: 'read',
                            expires: Date.now() + 60 * 60 * 1000, // URL valid for 1 hour
                        });
                        
                        return signedUrl;
                    }
                })
                .catch((error) => {
                    console.error("Error getting blob URL:", error);
                    throw error;
                });
        }

        public removeBlob(blobId: string): Promise<void> {
            return this.setupPromise
                .then(async () => {
                    // Delete the blob from GCS
                    const bucket = this.gcsClient.bucket(this.bucketName);
                    const file = bucket.file(blobId);
                    
                    await file.delete();
                })
                .then(() => {})
                .catch((error) => {
                    console.error("Error removing blob:", error);
                    throw error;
                });
        }

        public getDeployment(accountId: string, appId: string, deploymentId: string): Promise<storage.Deployment> {
            return this.setupPromise
                .then(async () => {
                    // Fetch the deployment by appId and deploymentId using Sequelize
                    return this.retrieveByAppHierarchy(appId, deploymentId);
                })
                .then(async (flatDeployment: any) => {
                    // Convert the retrieved Sequelize object to the desired format
                    return this.attachPackageToDeployment(accountId, flatDeployment);
                })
                .catch((error) => {
                    // Handle any Sequelize errors here
                    console.error("Error fetching deployment:", error);
                    throw error;
                });
        }

        public dropAll(): Promise<void> {
            return Promise.resolve(<void>null);
        }

        public transferApp(accountId: string, appId: string, email: string): Promise<void> {
            let app: storage.App;
            let targetCollaboratorAccountId: string;
            let requestingCollaboratorEmail: string;
            let isTargetAlreadyCollaborator: boolean;

            return this.setupPromise
                .then(() => {
                    const getAppPromise: Promise<storage.App> = this.getApp(accountId, appId, /*keepCollaboratorIds*/ true);
                    const accountPromise: Promise<storage.Account> = this.getAccountByEmail(email);
                    return Promise.all<any>([getAppPromise, accountPromise]);
                })
                .then(([appPromiseResult, accountPromiseResult]: [storage.App, storage.Account]) => {
                    targetCollaboratorAccountId = accountPromiseResult.id;
                    email = accountPromiseResult.email; // Use the original email stored on the account to ensure casing is consistent
                    app = appPromiseResult;
                    requestingCollaboratorEmail = GCPStorage.getEmailForAccountId(app.collaborators, accountId);

                    if (requestingCollaboratorEmail === email) {
                        throw storage.storageError(storage.ErrorCode.AlreadyExists, "The given account already owns the app.");
                    }

                    return this.getApps(targetCollaboratorAccountId);
                })
                .then((appsForCollaborator: storage.App[]) => {
                    if (storage.NameResolver.isDuplicate(appsForCollaborator, app.name)) {
                        throw storage.storageError(
                            storage.ErrorCode.AlreadyExists,
                            'Cannot transfer ownership. An app with name "' + app.name + '" already exists for the given collaborator.'
                        );
                    }

                    isTargetAlreadyCollaborator = GCPStorage.isCollaborator(app.collaborators, email);

                    // Update the current owner to be a collaborator
                    GCPStorage.setCollaboratorPermission(app.collaborators, requestingCollaboratorEmail, storage.Permissions.Collaborator);

                    // set target collaborator as an owner.
                    if (isTargetAlreadyCollaborator) {
                        GCPStorage.setCollaboratorPermission(app.collaborators, email, storage.Permissions.Owner);
                    } else {
                        const targetOwnerProperties: storage.CollaboratorProperties = {
                            accountId: targetCollaboratorAccountId,
                            permission: storage.Permissions.Owner,
                        };
                        GCPStorage.addToCollaborators(app.collaborators, email, targetOwnerProperties);
                    }

                    return this.updateAppWithPermission(accountId, app, /*updateCollaborator*/ true);
                })
                .then(() => {
                    if (!isTargetAlreadyCollaborator) {
                        // Added a new collaborator as owner to the app, create a corresponding entry for app in target collaborator's account.
                        return this.addAppPointer(targetCollaboratorAccountId, app.id);
                    }
                })
                .catch(GCPStorage.storageErrorHandler);
        }

        public updateAppWithPermission(accountId: string, app: any, updateCollaborator: boolean = false): Promise<void> {
            const appId: string = app.id;
            if (!appId) throw new Error("No app id");

            const flatApp = this.flattenAppForSequelize(app, updateCollaborator);

            // Start a transaction since we may be updating multiple tables (app + collaborators)
            return this.setupPromise
                .then(() => {
                    return this.sequelize.transaction((t) => {
                        // Update the App in the database
                        return this.sequelize.models[MODELS.APPS].update(flatApp, {
                            where: { id: appId },
                            transaction: t,
                        }).then(() => {
                            if (updateCollaborator && app.collaborators) {
                                // Remove 'isCurrentAccount' flag before updating collaborators
                                this.deleteIsCurrentAccountProperty(app.collaborators);

                                // First, remove existing collaborators for this app
                                return this.sequelize.models[MODELS.COLLABORATOR].destroy({
                                    where: { appId: appId },
                                    transaction: t,
                                }).then(() => {
                                    // Then, add updated collaborators
                                    const collaborators = Object.keys(app.collaborators).map((email) => {
                                        const collaborator = app.collaborators[email];
                                        return {
                                            email,
                                            accountId: collaborator.accountId,
                                            appId: appId,
                                            permission: collaborator.permission,
                                        };
                                    });

                                    // Add updated collaborators
                                    return this.sequelize.models[MODELS.COLLABORATOR].bulkCreate(collaborators, { transaction: t }).then(() => {
                                        // Explicitly return void to satisfy the function's return type
                                        return;
                                    });
                                });
                            } else {
                                // No collaborator update, just resolve the promise
                                return;
                            }
                        });
                    });
                });
        }

        // Helper methods (identical to AWS storage)
        private getNextLabel(packageHistory: storage.Package[]): string {
            if (packageHistory.length === 0) {
                return "v1";
            }

            const lastLabel: string = packageHistory[packageHistory.length - 1].label;
            const lastVersion: number = parseInt(lastLabel.substring(1)); // Trim 'v' from the front
            return "v" + (lastVersion + 1);
        }

        private deleteIsCurrentAccountProperty(map: any): void {
            if (map) {
                Object.keys(map).forEach((key: string) => {
                    delete map[key].isCurrentAccount;
                });
            }
        }

        private flattenAppForSequelize(app: any, updateCollaborator: boolean = false): any {
            if (!app) {
                return app;
            }

            const flatApp: any = {};
            for (const property in app) {
                if (property === "collaborators" && updateCollaborator) {
                    this.deleteIsCurrentAccountProperty(app.collaborators); // Remove unnecessary properties from collaborators
                } else if (property !== "collaborators") {
                    flatApp[property] = app[property];  // Copy all other properties
                }
            }

            return flatApp;
        }

        private unflattenDeployment(flatDeployment: any): storage.Deployment {
            if (!flatDeployment) throw new Error("Deployment not found");

            // Parse the package field if it's stored as a JSON string in the DB
            flatDeployment.package = flatDeployment.package ? JSON.parse(flatDeployment.package) : null;

            // Return the unflattened deployment
            return flatDeployment;
        }

        private async attachPackageToDeployment(accountId: string, flatDeployment: any): Promise<storage.Deployment> {
            if (!flatDeployment) throw new Error("Deployment not found");

            // Retrieve the package details from the Package table using packageId
            let packageData: storage.Package | null = null;
            let packageHistory: storage.Package[] = [];

            if (flatDeployment.packageId) {
                const packageRecord = await this.sequelize.models[MODELS.PACKAGE].findOne({
                    where: { id: flatDeployment.packageId },
                });

                if (packageRecord) {
                    packageData = this.formatPackage(packageRecord.dataValues); // Format to match storage.Package interface
                }
            }

            packageHistory = await this.getPackageHistory(accountId, flatDeployment.appId, flatDeployment.id);

            // Construct and return the full deployment object
            return {
                id: flatDeployment.id,
                name: flatDeployment.name,
                key: flatDeployment.key,
                package: packageData, // Include the resolved package data
                packageHistory: packageHistory,
            };
        }

        // Helper function to format package data to storage.Package
        private formatPackage(pkgData: any): storage.Package | null {
            if (!pkgData) return null;

            return {
                appVersion: pkgData.appVersion,
                blobUrl: pkgData.blobUrl,
                description: pkgData.description,
                diffPackageMap: pkgData.diffPackageMap ? JSON.parse(pkgData.diffPackageMap) : undefined,
                isDisabled: pkgData.isDisabled,
                isMandatory: pkgData.isMandatory,
                label: pkgData.label,
                manifestBlobUrl: pkgData.manifestBlobUrl,
                originalDeployment: pkgData.originalDeployment,
                originalLabel: pkgData.originalLabel,
                packageHash: pkgData.packageHash,
                releasedBy: pkgData.releasedBy,
                releaseMethod: pkgData.releaseMethod,
                rollout: pkgData.rollout,
                size: pkgData.size,
                uploadTime: pkgData.uploadTime,
            };
        }

        private retrieveByAppHierarchy(appId: string, deploymentId: string): Promise<any> {
            return Promise.resolve(
                this.sequelize.models[MODELS.DEPLOYMENT].findOne({
                    where: {
                        appId: appId,
                        id: deploymentId, // Assuming 'id' is the deploymentId
                    }
                })
            );
        }

        // GCS blob utility methods
        private deleteHistoryBlob(blobId: string): Promise<void> {
            return new Promise<void>((resolve, reject) => {
                const bucket = this.gcsClient.bucket(this.bucketName);
                const file = bucket.file(blobId);
                
                file.delete()
                    .then(() => {
                        resolve();
                    })
                    .catch((error: any) => {
                        reject(error);
                    });
            });
        }

        private getPackageHistoryFromBlob(deploymentId: string): Promise<storage.Package[]> {
            return new Promise<storage.Package[]>((resolve, reject) => {
                const bucket = this.gcsClient.bucket(this.bucketName);
                const file = bucket.file(`${deploymentId}/history.json`);
                
                let data = '';
                file.createReadStream()
                    .on('data', (chunk) => {
                        data += chunk;
                    })
                    .on('end', () => {
                        try {
                            const packageHistory = JSON.parse(data);
                            resolve(packageHistory);
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => {
                        reject(error);
                    });
            });
        }

        private uploadToHistoryBlob(deploymentId: string, content: string): Promise<void> {
            return new Promise<void>((resolve, reject) => {
                const bucket = this.gcsClient.bucket(this.bucketName);
                const file = bucket.file(`${deploymentId}/history.json`);
                
                const writeStream = file.createWriteStream({
                    metadata: {
                        contentType: 'application/json',
                    },
                });

                writeStream.on('error', reject);
                writeStream.on('finish', resolve);
                writeStream.end(content);
            });
        }

        // Static helper methods for collaborator management (identical to AWS storage)
        private static isCollaborator(collaboratorsMap: storage.CollaboratorMap, email: string): boolean {
            return collaboratorsMap && collaboratorsMap[email] !== undefined;
        }

        private static setCollaboratorPermission(collaboratorsMap: storage.CollaboratorMap, email: string, permission: typeof storage.Permissions[keyof typeof storage.Permissions]): void {
            if (collaboratorsMap && collaboratorsMap[email]) {
                collaboratorsMap[email].permission = permission;
            }
        }

        private static addToCollaborators(collaboratorsMap: storage.CollaboratorMap, email: string, properties: storage.CollaboratorProperties): void {
            if (collaboratorsMap) {
                collaboratorsMap[email] = properties;
            }
        }

        private static storageErrorHandler(gcpError: any): any {
            let errorCodeRaw: number | string;
            let errorMessage: string;

            try {
                const parsedMessage = JSON.parse(gcpError.message);
                errorCodeRaw = parsedMessage["odata.error"].code;
                errorMessage = parsedMessage["odata.error"].message.value;
            } catch (error) {
                errorCodeRaw = gcpError.code;
                errorMessage = gcpError.message;
            }

            if (typeof errorCodeRaw === "number") {
                // This is a storage.Error that we previously threw; just re-throw it
                throw gcpError;
            }

            let errorCode: storage.ErrorCode;
            switch (errorCodeRaw) {
                case "BlobNotFound":
                case "ResourceNotFound":
                case "TableNotFound":
                    errorCode = storage.ErrorCode.NotFound;
                    break;
                case "EntityAlreadyExists":
                case "TableAlreadyExists":
                    errorCode = storage.ErrorCode.AlreadyExists;
                    break;
                case "EntityTooLarge":
                case "PropertyValueTooLarge":
                    errorCode = storage.ErrorCode.TooLarge;
                    break;
                case "ETIMEDOUT":
                case "ESOCKETTIMEDOUT":
                case "ECONNRESET":
                    // This is an error emitted from the 'request' module, which is a
                    // dependency of 'azure-storage', and indicates failure after multiple
                    // retries.
                    errorCode = storage.ErrorCode.ConnectionFailed;
                    break;
                default:
                    errorCode = storage.ErrorCode.Other;
                    break;
            }
            throw storage.storageError(errorCode, errorMessage);
        }

    // Helper methods (identical to AWS storage)
    private addAppPointer(accountId: string, appId: string): Promise<void> {
        return this.setupPromise
          .then(() => {
            // Directly create the pointer in the DB using foreign keys (instead of partition/row keys)
            return this.sequelize.models[MODELS.APPPOINTER].create({
              accountId,
              appId,
              partitionKeyPointer: `accountId ${accountId}`,
              rowKeyPointer: `appId ${appId}`,
            });
          })
          .then(() => {
            console.log('App pointer added successfully');
            return Promise.resolve();
          })
          .catch(GCPStorage.storageErrorHandler);
    }

    private addCollaboratorWithPermissions(
        accountId: string,
        app: storage.App,
        email: string,
        collabProperties: storage.CollaboratorProperties
      ): Promise<void> {
        if (app && app.collaborators && !app.collaborators[email]) {
          app.collaborators[email] = collabProperties;
          return this.updateAppWithPermission(accountId, app, /*updateCollaborator*/ true).then(() => {
            return this.addAppPointer(collabProperties.accountId, app.id);
          });
        } else {
          throw storage.storageError(storage.ErrorCode.AlreadyExists, "The given account is already a collaborator for this app.");
        }
    }

    private updateCollaboratorWithPermissions(
        accountId: string,
        app: storage.App,
        email: string,
        collabProperties: storage.CollaboratorProperties
      ): Promise<void> {
        if (app && app.collaborators && app.collaborators[email]) {
          app.collaborators[email] = collabProperties;
          return this.updateAppWithPermission(accountId, app, /*updateCollaborator*/ true).then(() => {
            return this.addAppPointer(collabProperties.accountId, app.id);
          });
        } else {
          throw storage.storageError(storage.ErrorCode.AlreadyExists, "The given account is already a collaborator for this app.");
        }
    }

    private removeAppPointer(accountId: string, appId: string): Promise<void> {
        return this.setupPromise
        .then(() => {
          // Use Sequelize to destroy (delete) the record
          return this.sequelize.models[MODELS.APPPOINTER].destroy({
            where: {
              accountId: accountId,
              appId: appId,
            },
          });
        })
        .then((deletedCount: number) => {
          if (deletedCount === 0) {
            console.log('AppPointer not found');
          }
          console.log('AppPointer successfully removed');
        })
        .catch((error: any) => {
          console.error('Error removing AppPointer:', error);
          throw error;
        });
    }

    private async getCollabrators(app: storage.App, accountId: string) {
      const collabModel = await this.sequelize.models[MODELS.COLLABORATOR].findAll({where : {appId: app.id}})
      const collabMap = {}
      collabModel.map((collab) => {
        collabMap[collab.dataValues["email"]] = {
          ...collab.dataValues,
          "isCurrentAccount" : false
        }
      })
      const currentUserEmail: string = GCPStorage.getEmailForAccountId(collabMap, accountId);
      if (currentUserEmail && collabMap[currentUserEmail]) {
        collabMap[currentUserEmail].isCurrentAccount = true;
      }
      app["collaborators"] = collabMap
      return app;
    }

    private static getEmailForAccountId(collaboratorsMap: storage.CollaboratorMap, accountId: string): string {
      if (collaboratorsMap) {
        for (const email of Object.keys(collaboratorsMap)) {
          if ((<storage.CollaboratorProperties>collaboratorsMap[email]).accountId === accountId) {
            return email;
          }
        }
      }
  
      return null;
    }
}
