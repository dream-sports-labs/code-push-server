import * as storage from "./storage";
import { Storage as GCSStorage } from '@google-cloud/storage';
import * as stream from "stream";
import { Sequelize, DataTypes } from "sequelize";
import * as shortid from "shortid";
import * as utils from "../utils/common";
import * as mysql from "mysql2/promise";
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
    private gcsSetupDone = false;
    private sequelizeSetupDone = false;
    private sequelize: Sequelize;
    private setupPromise: Promise<null | Error>;

    public constructor() {
        shortid.characters("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-");

        const isDbReady = GCPStorage.createDatabaseIfNotExists();
        if (!isDbReady) {
          throw new Error("[GCPStorage] constructor() database setup failed");
        }

        this.setupPromise = new Promise(async (resolve, reject) => {
          try {
            if (!this.gcsSetupDone) {
              await this.setupGCS()
              this.gcsSetupDone = true;
            }
          } catch (error) {
            console.log("[GCPStorage] constructor() setupGCS error", error);
          }

          try {
            if (!this.sequelizeSetupDone) {
              await this.setupSequelize()
              this.sequelizeSetupDone = true;
            }
          } catch (error) {
            console.log("[GCPStorage] constructor() setupSequelize error", error);
          }

          if (this.gcsSetupDone && this.sequelizeSetupDone) {
            console.log("[GCPStorage] constructor() setup complete");
            resolve(null);
          } else {
            reject(new Error("[GCPStorage] constructor() setup failed"));
          }
        })
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

    // Placeholder methods - we'll implement these in the next steps
    public async addAccount(account: storage.Account): Promise<string> {
      throw new Error("Method not implemented yet");
    }

    public getAccount(accountId: string): Promise<storage.Account> {
      throw new Error("Method not implemented yet");
    }

    public async getAccountByEmail(email: string): Promise<storage.Account> {
      throw new Error("Method not implemented yet");
    }

    public updateAccount(email: string, updateProperties: storage.Account): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public getAppOwnershipCount(accountId: string): Promise<number> {
      throw new Error("Method not implemented yet");
    }

    public getTermsAcceptance(accountId: string): Promise<storage.TermsAcceptance> {
      throw new Error("Method not implemented yet");
    }

    public addOrUpdateTermsAcceptance(termsAcceptance: storage.TermsAcceptance): Promise<storage.TermsAcceptance> {
      throw new Error("Method not implemented yet");
    }

    public getAccountIdFromAccessKey(accessKey: string): Promise<string> {
      throw new Error("Method not implemented yet");
    }

    public addApp(accountId: string, app: storage.App): Promise<storage.App> {
      throw new Error("Method not implemented yet");
    }

    public getApps(accountId: string): Promise<storage.App[]> {
      throw new Error("Method not implemented yet");
    }

    public getTenants(accountId: string): Promise<storage.Organization[]> {
      throw new Error("Method not implemented yet");
    }

    public removeTenant(accountId: string, tenantId: string): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public getApp(accountId: string, appId: string, keepCollaboratorIds?: boolean): Promise<storage.App> {
      throw new Error("Method not implemented yet");
    }

    public removeApp(accountId: string, appId: string): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public updateApp(accountId: string, app: storage.App): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public transferApp(accountId: string, appId: string, email: string): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public addCollaborator(accountId: string, appId: string, email: string): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public updateCollaborators(accountId: string, appId: string, email: string, role: string): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public getCollaborators(accountId: string, appId: string): Promise<storage.CollaboratorMap> {
      throw new Error("Method not implemented yet");
    }

    public removeCollaborator(accountId: string, appId: string, email: string): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public addDeployment(accountId: string, appId: string, deployment: storage.Deployment): Promise<string> {
      throw new Error("Method not implemented yet");
    }

    public getDeploymentInfo(deploymentKey: string): Promise<storage.DeploymentInfo> {
      throw new Error("Method not implemented yet");
    }

    public getDeployments(accountId: string, appId: string): Promise<storage.Deployment[]> {
      throw new Error("Method not implemented yet");
    }

    public removeDeployment(accountId: string, appId: string, deploymentId: string): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public updateDeployment(accountId: string, appId: string, deployment: storage.Deployment): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public commitPackage(accountId: string, appId: string, deploymentId: string, appPackage: storage.Package): Promise<storage.Package> {
      throw new Error("Method not implemented yet");
    }

    public clearPackageHistory(accountId: string, appId: string, deploymentId: string): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public getPackageHistory(accountId: string, appId: string, deploymentId: string): Promise<storage.Package[]> {
      throw new Error("Method not implemented yet");
    }

    public updatePackageHistory(accountId: string, appId: string, deploymentId: string, history: storage.Package[]): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public addBlob(blobId: string, stream: stream.Readable, streamLength: number): Promise<string> {
      throw new Error("Method not implemented yet");
    }

    public getBlobUrl(blobId: string): Promise<string> {
      throw new Error("Method not implemented yet");
    }

    public removeBlob(blobId: string): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public getPackageHistoryFromDeploymentKey(deploymentKey: string): Promise<storage.Package[]> {
      throw new Error("Method not implemented yet");
    }

    public addAccessKey(accountId: string, accessKey: storage.AccessKey): Promise<string> {
      throw new Error("Method not implemented yet");
    }

    public getUserFromAccessKey(accessKey: string): Promise<storage.Account> {
      throw new Error("Method not implemented yet");
    }

    public getUserFromAccessToken(accessToken: string): Promise<storage.Account> {
      throw new Error("Method not implemented yet");
    }

    public getAccessKey(accountId: string, accessKeyId: string): Promise<storage.AccessKey> {
      throw new Error("Method not implemented yet");
    }

    public removeAccessKey(accountId: string, accessKeyId: string): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public updateAccessKey(accountId: string, accessKey: storage.AccessKey): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    public getAccessKeys(accountId: string): Promise<storage.AccessKey[]> {
      throw new Error("Method not implemented yet");
    }

    public getDeployment(accountId: string, appId: string, deploymentId: string): Promise<storage.Deployment> {
      throw new Error("Method not implemented yet");
    }

    public dropAll(): Promise<void> {
      return Promise.resolve(<void>null);
    }

    public updateAppWithPermission(accountId: string, app: any, updateCollaborator: boolean = false): Promise<void> {
      throw new Error("Method not implemented yet");
    }

    private static storageErrorHandler(gcpError: any): any {
      // We'll implement this error handler similar to AWS version
      throw gcpError;
    }
}
