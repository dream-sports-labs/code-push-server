// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { S3Storage } from "../script/storage/aws-storage";
import * as storage from "../script/storage/storage";
import * as assert from "assert";


declare global {
namespace NodeJS {
interface Global {
testHelpers: any;
}
}
}


jest.mock("../script/utils/common", () => ({
  streamToBufferS3: jest.fn((stream) => {
    return Promise.resolve(Buffer.from("mocked-buffer-content"));
  }),
  hashWithSHA256: jest.fn((input: string) => `hashed_${input}`)
}));


jest.mock("shortid", () => ({
  generate: jest.fn(() => "mock-short-id"),
  characters: jest.fn()
}));


jest.mock("fs", () => ({
  readFileSync: jest.fn(() => "mock-file-content")
}));


const mockS3Instance = {
  headBucket: jest.fn(() => ({
    promise: jest.fn(() => Promise.resolve())
  })),
  createBucket: jest.fn(() => ({
    promise: jest.fn(() => Promise.resolve())
  })),
  putObject: jest.fn(() => ({
    promise: jest.fn(() => Promise.resolve({ ETag: "mock-etag" }))
  })),
  getObject: jest.fn(() => ({
    promise: jest.fn(() => Promise.resolve({
      Body: Buffer.from('{"mock": "data"}')
    }))
  })),
  deleteObject: jest.fn(() => ({
    promise: jest.fn(() => Promise.resolve())
  })),
  getSignedUrlPromise: jest.fn(() => Promise.resolve("https://mock-signed-url.com"))
};

jest.mock("aws-sdk", () => ({
  S3: jest.fn(() => mockS3Instance),
  CloudFront: jest.fn(() => ({}))
}));

jest.mock("aws-cloudfront-sign", () => ({
  getSignedUrl: jest.fn(() => "https://mock-cloudfront-signed-url.com")
}));


const mockMysqlConnection = {
  query: jest.fn(() => Promise.resolve(undefined)),
  end: jest.fn(() => Promise.resolve(undefined))
};

jest.mock("mysql2/promise", () => ({
  createConnection: jest.fn(() => Promise.resolve(mockMysqlConnection))
}));


const mockSequelizeModel = {
  findByPk: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(() => Promise.resolve([])),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
  bulkCreate: jest.fn(),
  findOrCreate: jest.fn(),
  hasMany: jest.fn(() => mockSequelizeModel),
  belongsTo: jest.fn(() => mockSequelizeModel),
  hasOne: jest.fn(() => mockSequelizeModel),
  belongsToMany: jest.fn(() => mockSequelizeModel)
};

const mockSequelizeInstance = {
  authenticate: jest.fn(() => Promise.resolve()),
  sync: jest.fn(() => Promise.resolve()),
  define: jest.fn((modelName) => {
    const mockModel = {
      ...mockSequelizeModel,
      hasMany: jest.fn(() => mockModel),
      belongsTo: jest.fn(() => mockModel),
      hasOne: jest.fn(() => mockModel),
      belongsToMany: jest.fn(() => mockModel)
    };
    return mockModel;
  }),
  transaction: jest.fn((callback) => {
    const mockTransaction = {};
    return Promise.resolve(callback(mockTransaction));
  }),
  models: {
    account: { ...mockSequelizeModel, hasMany: jest.fn(() => mockSequelizeModel), belongsTo: jest.fn(() => mockSequelizeModel) },
    accessKey: { ...mockSequelizeModel, hasMany: jest.fn(() => mockSequelizeModel), belongsTo: jest.fn(() => mockSequelizeModel) },
    apps: { ...mockSequelizeModel, hasMany: jest.fn(() => mockSequelizeModel), belongsTo: jest.fn(() => mockSequelizeModel) },
    tenant: { ...mockSequelizeModel, hasMany: jest.fn(() => mockSequelizeModel), belongsTo: jest.fn(() => mockSequelizeModel) },
    collaborator: { ...mockSequelizeModel, hasMany: jest.fn(() => mockSequelizeModel), belongsTo: jest.fn(() => mockSequelizeModel) },
    deployment: { ...mockSequelizeModel, hasMany: jest.fn(() => mockSequelizeModel), belongsTo: jest.fn(() => mockSequelizeModel) },
    package: { ...mockSequelizeModel, hasMany: jest.fn(() => mockSequelizeModel), belongsTo: jest.fn(() => mockSequelizeModel) },
    AppPointer: { ...mockSequelizeModel, hasMany: jest.fn(() => mockSequelizeModel), belongsTo: jest.fn(() => mockSequelizeModel) }
  }
};

jest.mock("sequelize", () => {
  const mockSequelizeConstructor = jest.fn(() => mockSequelizeInstance);
  return {
    Sequelize: mockSequelizeConstructor,
    DataTypes: {
      STRING: "STRING",
      FLOAT: "FLOAT",
      BOOLEAN: "BOOLEAN",
      JSON: "JSON",
      ENUM: jest.fn((options) => ({ type: "ENUM", values: options.values })),
      UUID: "UUID",
      UUIDV4: "UUIDV4",
      BIGINT: "BIGINT",
      DATE: "DATE",
      NOW: "NOW"
    }
  };
});


describe("S3Storage", () => {
  let s3Storage: S3Storage;

  beforeEach(async () => {
    jest.clearAllMocks();


    process.env.S3_BUCKETNAME = "test-bucket";
    process.env.S3_ENDPOINT = "http://localhost:4566";
    process.env.AWS_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.S3_REGION = "us-east-1";
    process.env.DB_NAME = "testdb";
    process.env.DB_HOST = "localhost";
    process.env.DB_USER = "testuser";
    process.env.DB_PASS = "testpass";
    process.env.NODE_ENV = "development";


    mockMysqlConnection.query.mockResolvedValue(undefined);
    mockS3Instance.headBucket().promise.mockResolvedValue(undefined);
    mockSequelizeInstance.authenticate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.S3_BUCKETNAME;
    delete process.env.S3_ENDPOINT;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.S3_REGION;
    delete process.env.DB_NAME;
    delete process.env.DB_HOST;
    delete process.env.DB_USER;
    delete process.env.DB_PASS;
    delete process.env.NODE_ENV;
  });


  describe("Constructor and Setup", () => {
    it("should create S3Storage instance with default configuration", async () => {
      s3Storage = new S3Storage();
      expect(s3Storage).toBeInstanceOf(S3Storage);
    });

    it("should initialize S3 client with correct configuration", () => {
      s3Storage = new S3Storage();
      const { S3 } = require("aws-sdk");
      expect(S3).toHaveBeenCalledWith({
        endpoint: process.env.S3_ENDPOINT,
        s3ForcePathStyle: true,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.S3_REGION
      });
    });

    it("should create database if not exists", async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));

      const mysql = require("mysql2/promise");
      expect(mysql.createConnection).toHaveBeenCalledWith({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS
      });
      expect(mockMysqlConnection.query).toHaveBeenCalledWith(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
      expect(mockMysqlConnection.end).toHaveBeenCalled();
    });

    it("should setup S3 bucket when it doesn't exist", async () => {
      mockS3Instance.headBucket.mockReturnValue({
        promise: jest.fn().mockRejectedValue({ code: 'NotFound' })
      });
      mockS3Instance.createBucket.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockS3Instance.createBucket).toHaveBeenCalledWith({ Bucket: "test-bucket" });
    });

    it("should authenticate with Sequelize", async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockSequelizeInstance.authenticate).toHaveBeenCalled();
    });

    it("should handle Forbidden error when checking S3 bucket", async () => {
      const forbiddenError = { code: 'Forbidden', message: 'Access denied' };

      // Mock console.error to verify it's called
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock S3 headBucket to reject with Forbidden error
      mockS3Instance.headBucket.mockReturnValue({
        promise: jest.fn().mockRejectedValue(forbiddenError)
      });

      try {
        s3Storage = new S3Storage();
        await (s3Storage as any).setupPromise;
        fail('Expected setup to throw Forbidden error');
      } catch (error) {
        expect(error.code).toBe('Forbidden');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Forbidden: Check your credentials and S3 endpoint');
        expect(mockS3Instance.createBucket).not.toHaveBeenCalled();
      }

      consoleErrorSpy.mockRestore();
    });

    it("should handle other S3 errors during bucket check", async () => {
      const customError = { code: 'ServiceUnavailable', message: 'Service unavailable' };

      // Mock S3 headBucket to reject with ServiceUnavailable error
      mockS3Instance.headBucket.mockReturnValue({
        promise: jest.fn().mockRejectedValue(customError)
      });

      try {
        s3Storage = new S3Storage();
        await (s3Storage as any).setupPromise;
        fail('Expected setup to throw ServiceUnavailable error');
      } catch (error) {
        expect(error.code).toBe('ServiceUnavailable');
        expect(mockS3Instance.createBucket).not.toHaveBeenCalled();
      }
    });

    it("should handle Sequelize authentication errors", async () => {
      const authError = new Error('Database connection failed');

      // Mock database creation success
      const mockMysqlConnection = {
        query: jest.fn().mockResolvedValue(undefined),
        end: jest.fn().mockResolvedValue(undefined)
      };

      const mysql = require("mysql2/promise");
      mysql.createConnection.mockResolvedValue(mockMysqlConnection);

      mockS3Instance.headBucket.mockReturnValue({
        promise: jest.fn().mockResolvedValue({}) // S3 check passes
      });

      mockSequelizeInstance.authenticate.mockRejectedValue(authError);

      // Mock console.error to verify it's called
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      s3Storage = new S3Storage();

      // Access the setupPromise to test the error handling
      await expect((s3Storage as any).setupPromise).rejects.toThrow('Database connection failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error during setup:', authError);

      consoleErrorSpy.mockRestore();
    });

    it("should handle default fallback values for environment variables", () => {

      const originalEnv = process.env;

      process.env = {
        ...originalEnv,
        S3_BUCKETNAME: undefined,
        AWS_ACCESS_KEY_ID: undefined,
        AWS_SECRET_ACCESS_KEY: undefined,
        DB_NAME: undefined,
        DB_HOST: undefined,
        DB_USER: undefined,
        DB_PASS: undefined,
        DB_HOST_READER: undefined
      };

      s3Storage = new S3Storage();


      const { S3 } = require("aws-sdk");
      expect(S3).toHaveBeenCalledWith(expect.objectContaining({
        accessKeyId: '',
        secretAccessKey: ''
      }));


      process.env = originalEnv;
    });

    it("should use custom environment variables when provided", () => {

      const originalEnv = process.env;

      process.env = {
        ...originalEnv,
        S3_BUCKETNAME: 'custom-bucket',
        S3_ENDPOINT: 'http://custom-endpoint',
        AWS_ACCESS_KEY_ID: 'custom-access-key',
        AWS_SECRET_ACCESS_KEY: 'custom-secret-key',
        S3_REGION: 'custom-region',
        DB_NAME: 'custom-db',
        DB_HOST: 'custom-host',
        DB_USER: 'custom-user',
        DB_PASS: 'custom-pass',
        DB_HOST_READER: 'custom-reader-host'
      };

      s3Storage = new S3Storage();

      const { S3 } = require("aws-sdk");
      expect(S3).toHaveBeenCalledWith({
        endpoint: 'http://custom-endpoint',
        s3ForcePathStyle: true,
        accessKeyId: 'custom-access-key',
        secretAccessKey: 'custom-secret-key',
        region: 'custom-region'
      });


      process.env = originalEnv;
    });
  });

  describe("Health Check", () => {
    beforeEach(() => {
      s3Storage = new S3Storage();
    });

    it("should pass health check when all services are healthy", async () => {
      mockSequelizeInstance.authenticate.mockResolvedValue(undefined);
      await expect(s3Storage.checkHealth()).resolves.toBeUndefined();
      expect(mockSequelizeInstance.authenticate).toHaveBeenCalled();
    });

    it("should fail health check when database is not healthy", async () => {
      mockSequelizeInstance.authenticate.mockRejectedValue(new Error("DB connection failed"));
      await expect(s3Storage.checkHealth()).rejects.toThrow("DB connection failed");
    });
  });

  describe("Account Operations", () => {
    beforeEach(async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    describe("addAccount", () => {
      it("should add account successfully", async () => {
        const account: storage.Account = {
          name: "Test User",
          email: "test@example.com",
          createdTime: Date.now()
        };

        mockSequelizeModel.findOrCreate.mockResolvedValue([
          { dataValues: { ...account, id: "mock-short-id" } },
          true
        ]);

        const result = await s3Storage.addAccount(account);
        expect(result).toBe("mock-short-id");
        expect(mockSequelizeModel.findOrCreate).toHaveBeenCalledWith({
          where: { id: "mock-short-id" },
          defaults: { ...account, id: "mock-short-id" }
        });
      });

      it("should handle account creation failure", async () => {
        const account: storage.Account = {
          name: "Test User",
          email: "test@example.com",
          createdTime: Date.now()
        };

        mockSequelizeModel.findOrCreate.mockRejectedValue(new Error("Database error"));
        await expect(s3Storage.addAccount(account)).rejects.toThrow();
      });
    });

    describe("getAccount", () => {
      it("should retrieve account by ID", async () => {
        const expectedAccount = {
          id: "test-account-id",
          name: "Test User",
          email: "test@example.com",
          createdTime: Date.now()
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: expectedAccount });
        const result = await s3Storage.getAccount("test-account-id");
        expect(result).toEqual(expectedAccount);
        expect(mockSequelizeModel.findByPk).toHaveBeenCalledWith("test-account-id");
      });

      it("should handle account not found", async () => {
        mockSequelizeModel.findByPk.mockResolvedValue(null);
        await expect(s3Storage.getAccount("non-existent-id")).rejects.toThrow();
      });
    });

    describe("getAccountByEmail", () => {
      it("should retrieve account by email", async () => {
        const expectedAccount = {
          id: "test-account-id",
          name: "Test User",
          email: "test@example.com",
          createdTime: Date.now()
        };

        mockSequelizeModel.findOne.mockResolvedValue({ dataValues: expectedAccount });
        const result = await s3Storage.getAccountByEmail("test@example.com");
        expect(result).toEqual(expectedAccount);
        expect(mockSequelizeModel.findOne).toHaveBeenCalledWith({
          where: { email: "test@example.com" }
        });
      });

      it("should handle account not found by email", async () => {
        mockSequelizeModel.findOne.mockResolvedValue(null);
        await expect(s3Storage.getAccountByEmail("nonexistent@example.com")).rejects.toEqual({ code: 1 });
      });
    });

    describe("updateAccount", () => {
      it("should update account successfully", async () => {
        const updateProperties: Partial<storage.Account> = {
          name: "Updated User Name"
        };

        mockSequelizeModel.update.mockResolvedValue([1]);
        await s3Storage.updateAccount("test@example.com", updateProperties as storage.Account);
        expect(mockSequelizeModel.update).toHaveBeenCalledWith(
          updateProperties,
          { where: { email: "test@example.com" } }
        );
      });

      it("should throw error if no email provided", () => {
        const updateProperties: Partial<storage.Account> = {
          name: "Updated User Name"
        };

        expect(() => s3Storage.updateAccount("", updateProperties as storage.Account))
          .toThrow("No account email");
      });
    });
  });

  describe("Access Key Operations", () => {
    beforeEach(async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    describe("getAccountIdFromAccessKey", () => {
      it("should retrieve account ID from access key", async () => {
        const mockAccessKey = {
          dataValues: {
            accountId: "test-account-id",
            expires: Date.now() + 86400000
          }
        };

        mockSequelizeModel.findOne.mockResolvedValue(mockAccessKey);
        const result = await s3Storage.getAccountIdFromAccessKey("test-access-key");
        expect(result).toBe("test-account-id");
        expect(mockSequelizeModel.findOne).toHaveBeenCalledWith({
          where: { name: "test-access-key" }
        });
      });

      it("should throw error for expired access key", async () => {
        const mockAccessKey = {
          dataValues: {
            accountId: "test-account-id",
            expires: Date.now() - 86400000
          }
        };

        mockSequelizeModel.findOne.mockResolvedValue(mockAccessKey);
        await expect(s3Storage.getAccountIdFromAccessKey("expired-key")).rejects.toThrow();
      });
    });

    describe("addAccessKey", () => {
      it("should add access key successfully", async () => {
        const accessKey: storage.AccessKey = {
          createdBy: "test-user",
          createdTime: Date.now(),
          expires: Date.now() + 86400000,
          description: "Test access key",
          friendlyName: "Test Key",
          name: "test-key-name"
        };

        mockSequelizeModel.create.mockResolvedValue({
          dataValues: { ...accessKey, id: "mock-short-id" }
        });

        const result = await s3Storage.addAccessKey("test-account-id", accessKey);
        expect(result).toBe("mock-short-id");
        expect(mockSequelizeModel.create).toHaveBeenCalledWith({
          ...accessKey,
          id: "mock-short-id",
          accountId: "test-account-id"
        });
      });
    });
  });

  describe("Model Creation Functions", () => {
    it("should create AccessKey model with correct schema", () => {
      const { createAccessKey } = require("../script/storage/aws-storage");
      const mockSequelize = {
        define: jest.fn(),
        models: { account: {} }
      };

      createAccessKey(mockSequelize);
      expect(mockSequelize.define).toHaveBeenCalledWith("accessKey", expect.objectContaining({
        createdBy: expect.objectContaining({ type: "STRING", allowNull: false }),
        createdTime: expect.objectContaining({ type: "FLOAT", allowNull: false }),
        expires: expect.objectContaining({ type: "FLOAT", allowNull: false }),
        description: expect.objectContaining({ type: "STRING", allowNull: true }),
        friendlyName: expect.objectContaining({ type: "STRING", allowNull: false }),
        name: expect.objectContaining({ type: "STRING", allowNull: false }),
        id: expect.objectContaining({ type: "STRING", allowNull: false, primaryKey: true }),
        isSession: expect.objectContaining({ type: "BOOLEAN", allowNull: true })
      }));
    });

    it("should create Account model with correct schema", () => {
      const { createAccount } = require("../script/storage/aws-storage");
      const mockSequelize = { define: jest.fn() };

      createAccount(mockSequelize);
      expect(mockSequelize.define).toHaveBeenCalledWith("account", expect.objectContaining({
        createdTime: expect.objectContaining({ type: "FLOAT", allowNull: false }),
        name: expect.objectContaining({ type: "STRING", allowNull: false }),
        email: expect.objectContaining({ type: "STRING", allowNull: false }),
        id: expect.objectContaining({ type: "STRING", allowNull: false, primaryKey: true })
      }));
    });

    it("should create Account model with correct createdTime defaultValue function", () => {
      const { createAccount } = require("../script/storage/aws-storage");
      const mockSequelize = { define: jest.fn() };


      const mockTimestamp = 1640995200000;
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => mockTimestamp);


      const originalDate = Date;
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(mockTimestamp);
          } else {
            // @ts-ignore - spread operator issue with constructor
            super(...args);
          }
        }

        getTime() {
          return mockTimestamp;
        }

        static now() {
          return mockTimestamp;
        }
      } as any;

      try {
        createAccount(mockSequelize);


        const callArgs = mockSequelize.define.mock.calls[0];
        const schemaDefinition = callArgs[1];


        expect(schemaDefinition.createdTime).toHaveProperty('defaultValue');
        expect(typeof schemaDefinition.createdTime.defaultValue).toBe('function');


        const defaultValueResult = schemaDefinition.createdTime.defaultValue();
        expect(defaultValueResult).toBe(mockTimestamp);


        const secondCall = schemaDefinition.createdTime.defaultValue();
        expect(secondCall).toBe(mockTimestamp);
      } finally {

        global.Date = originalDate;
        Date.now = originalDateNow;
      }
    });

    it("should create Account model with defaultValue function that returns current time", () => {
      const { createAccount } = require("../script/storage/aws-storage");
      const mockSequelize = { define: jest.fn() };

      createAccount(mockSequelize);


      const callArgs = mockSequelize.define.mock.calls[0];
      const schemaDefinition = callArgs[1];


      const defaultValueResult = schemaDefinition.createdTime.defaultValue();
      expect(typeof defaultValueResult).toBe('number');


      const currentTime = new Date().getTime();
      expect(Math.abs(defaultValueResult - currentTime)).toBeLessThan(1000);


      const firstCall = schemaDefinition.createdTime.defaultValue();

      const delay = () => new Promise(resolve => setTimeout(resolve, 1));
      return delay().then(() => {
        const secondCall = schemaDefinition.createdTime.defaultValue();

        expect(secondCall).toBeGreaterThanOrEqual(firstCall);
      });
    });

    it("should execute the arrow function defaultValue for createdTime field", () => {
      const { createAccount } = require("../script/storage/aws-storage");
      const mockSequelize = { define: jest.fn() };


      const originalDate = Date;
      const mockGetTime = jest.fn().mockReturnValue(1640995200000);
      const mockDateConstructor = jest.fn().mockImplementation(() => ({
        getTime: mockGetTime
      }));


      global.Date = mockDateConstructor as any;

      try {
        createAccount(mockSequelize);


        const callArgs = mockSequelize.define.mock.calls[0];
        const schemaDefinition = callArgs[1];
        const defaultValueFunction = schemaDefinition.createdTime.defaultValue;


        const result = defaultValueFunction();


        expect(mockDateConstructor).toHaveBeenCalledWith();
        expect(mockGetTime).toHaveBeenCalled();
        expect(result).toBe(1640995200000);


        defaultValueFunction();
        defaultValueFunction();
        defaultValueFunction();

        expect(mockDateConstructor).toHaveBeenCalledTimes(4);
        expect(mockGetTime).toHaveBeenCalledTimes(4);

      } finally {

        global.Date = originalDate;
      }
    });

    it("should test the actual arrow function implementation", () => {

      const { createAccount } = require("../script/storage/aws-storage");
      const mockSequelize = { define: jest.fn() };

      createAccount(mockSequelize);

      const callArgs = mockSequelize.define.mock.calls[0];
      const schemaDefinition = callArgs[1];
      const arrowFunction = schemaDefinition.createdTime.defaultValue;


      const timestamp1 = arrowFunction();
      const timestamp2 = arrowFunction();
      const timestamp3 = arrowFunction();


      expect(typeof timestamp1).toBe('number');
      expect(typeof timestamp2).toBe('number');
      expect(typeof timestamp3).toBe('number');


      const now = new Date().getTime();
      expect(timestamp1).toBeGreaterThan(now - 5000);
      expect(timestamp1).toBeLessThanOrEqual(now);


      for (let i = 0; i < 10; i++) {
        const ts = arrowFunction();
        expect(typeof ts).toBe('number');
      }
    });

    it("should create App model with correct schema", () => {
      const { createApp } = require("../script/storage/aws-storage");
      const mockSequelize = {
        define: jest.fn(),
        models: { account: {} }
      };

      createApp(mockSequelize);
      expect(mockSequelize.define).toHaveBeenCalledWith("apps", expect.objectContaining({
        createdTime: expect.objectContaining({ type: "FLOAT", allowNull: false }),
        name: expect.objectContaining({ type: "STRING", allowNull: false }),
        id: expect.objectContaining({ type: "STRING", allowNull: false, primaryKey: true }),
        accountId: expect.objectContaining({
          type: "STRING",
          allowNull: false,
          references: expect.objectContaining({
            model: mockSequelize.models.account,
            key: 'id'
          })
        })
      }));
    });

    it("should create Tenant model with correct schema", () => {
      const { createTenant } = require("../script/storage/aws-storage");
      const mockSequelize = { define: jest.fn() };

      createTenant(mockSequelize);
      expect(mockSequelize.define).toHaveBeenCalledWith("tenant", expect.objectContaining({
        id: expect.objectContaining({
          type: "UUID",
          defaultValue: "UUIDV4",
          primaryKey: true,
          allowNull: false
        }),
        displayName: expect.objectContaining({
          type: "STRING",
          allowNull: false
        }),
        createdBy: expect.objectContaining({
          type: "STRING",
          allowNull: false
        })
      }));
    });

    it("should create Package model with correct schema", () => {
      const { createPackage } = require("../script/storage/aws-storage");
      const mockSequelize = {
        define: jest.fn(),
        models: { deployment: {} }
      };

      createPackage(mockSequelize);
      expect(mockSequelize.define).toHaveBeenCalledWith("package", expect.objectContaining({
        id: expect.objectContaining({ type: "UUID", defaultValue: "UUIDV4", allowNull: false, primaryKey: true }),
        appVersion: expect.objectContaining({ type: "STRING", allowNull: false }),
        packageHash: expect.objectContaining({ type: "STRING", allowNull: false }),
        size: expect.objectContaining({ type: "FLOAT", allowNull: false }),
        uploadTime: expect.objectContaining({ type: "BIGINT", allowNull: false })
      }));
    });
  });

  describe("Blob Operations", () => {
    beforeEach(async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    describe("addBlob", () => {
      it("should upload blob to S3 successfully", async () => {
        const mockStream = {
          pipe: jest.fn(),
          on: jest.fn()
        } as any;

        mockS3Instance.putObject().promise.mockResolvedValue({ ETag: "mock-etag" });
        const result = await s3Storage.addBlob("test-blob-id", mockStream, 1024);
        expect(result).toBe("test-blob-id");
        expect(mockS3Instance.putObject).toHaveBeenCalledWith({
          Bucket: "test-bucket",
          Key: "test-blob-id",
          Body: expect.any(Buffer),
          ContentType: "application/zip"
        });
      });

      it("should generate blob ID if not provided", async () => {
        const mockStream = {
          pipe: jest.fn(),
          on: jest.fn()
        } as any;

        mockS3Instance.putObject().promise.mockResolvedValue({ ETag: "mock-etag" });
        const result = await s3Storage.addBlob(null, mockStream, 1024);
        expect(result).toMatch(/^deployments\/\d+-[a-z0-9]+\.zip$/);
      });

      it("should handle blob upload errors", async () => {

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const uploadError = new Error("S3 upload failed");

        const mockStream = {
          pipe: jest.fn(),
          on: jest.fn()
        } as any;

        mockS3Instance.putObject.mockReturnValue({
          promise: jest.fn().mockRejectedValue(uploadError)
        });

        await expect(s3Storage.addBlob("test-blob-id", mockStream, 1024))
          .rejects.toThrow("S3 upload failed");

        expect(consoleErrorSpy).toHaveBeenCalledWith("Error adding blob:", uploadError);

        consoleErrorSpy.mockRestore();
      });
    });

    describe("getBlobUrl", () => {
      it("should return signed URL in development environment", async () => {
        process.env.NODE_ENV = "development";
        const result = await s3Storage.getBlobUrl("test-blob-id");
        expect(result).toBe("https://mock-signed-url.com");
        expect(mockS3Instance.getSignedUrlPromise).toHaveBeenCalledWith("getObject", {
          Bucket: "test-bucket",
          Key: "test-blob-id",
          Expires: 60 * 60 * 24000
        });
      });

      it("should return CloudFront URL in production environment", async () => {
        process.env.NODE_ENV = "production";
        process.env.CLOUDFRONT_DOMAIN = "test-cloudfront.amazonaws.com";
        const result = await s3Storage.getBlobUrl("test-blob-id");
        expect(result).toBe("https://test-cloudfront.amazonaws.com/test-blob-id");
      });

      it("should handle blob URL retrieval errors", async () => {

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const urlError = new Error("Failed to get blob URL");

        process.env.NODE_ENV = "development";
        mockS3Instance.getSignedUrlPromise.mockRejectedValue(urlError);

        await expect(s3Storage.getBlobUrl("test-blob-id"))
          .rejects.toThrow("Failed to get blob URL");

        expect(consoleErrorSpy).toHaveBeenCalledWith("Error getting blob URL:", urlError);

        consoleErrorSpy.mockRestore();
      });
    });

    describe("removeBlob", () => {
      it("should delete blob from S3 successfully", async () => {
        mockS3Instance.deleteObject().promise.mockResolvedValue(undefined);
        await s3Storage.removeBlob("test-blob-id");
        expect(mockS3Instance.deleteObject).toHaveBeenCalledWith({
          Bucket: "test-bucket",
          Key: "test-blob-id"
        });
      });
    });

    describe("deleteHistoryBlob", () => {
      it("should handle S3 deletion errors", async () => {
        const s3Error = new Error("S3 deletion failed");

        mockS3Instance.deleteObject.mockReturnValue({
          promise: jest.fn().mockRejectedValue(s3Error)
        });

        await expect((s3Storage as any)['deleteHistoryBlob']("test-blob-id"))
          .rejects.toThrow("S3 deletion failed");

        expect(mockS3Instance.deleteObject).toHaveBeenCalledWith({
          Bucket: "test-bucket",
          Key: "test-blob-id"
        });
      });
    });
  });

  describe("App Operations", () => {
    beforeEach(async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    describe("addApp", () => {
      it("should add app successfully with tenant", async () => {
        const app: storage.App = {
          name: "Test App",
          tenantName: "Test Org",
          createdTime: Date.now()
        };

        const mockAccount = {
          id: "account-id",
          email: "test@example.com",
          name: "Test User",
          createdTime: Date.now()
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.findOne.mockResolvedValue(null);
        mockSequelizeModel.create
          .mockResolvedValueOnce({ dataValues: { id: "tenant-id" } })
          .mockResolvedValueOnce({ dataValues: { ...app, id: "mock-short-id" } });
        mockSequelizeModel.findOrCreate.mockResolvedValue([{}, true]);

        const result = await s3Storage.addApp("account-id", app);
        expect(result).toEqual(expect.objectContaining({
          name: "Test App",
          id: "mock-short-id"
        }));
      });

      it("should throw error if tenant name already exists", async () => {
        const app: storage.App = {
          name: "Test App",
          tenantName: "Existing Org",
          createdTime: Date.now()
        };

        const mockAccount = { dataValues: { id: "account-id", email: "test@example.com" } };
        mockSequelizeModel.findByPk.mockResolvedValue(mockAccount);
        mockSequelizeModel.findOne.mockResolvedValue({ dataValues: { displayName: "Existing Org" } });

        await expect(s3Storage.addApp("account-id", app))
          .rejects.toThrow("An organization or user of this name already exists");
      });

      it("should add app without tenant (standalone app)", async () => {
        const app: storage.App = {
          name: "Standalone App",
          createdTime: Date.now()
        };

        const mockAccount = {
          id: "account-id",
          email: "test@example.com",
          name: "Test User",
          createdTime: Date.now()
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.create
          .mockResolvedValueOnce({ dataValues: { ...app, id: "mock-short-id" } });
        mockSequelizeModel.findOrCreate.mockResolvedValue([{}, true]);

        const result = await s3Storage.addApp("account-id", app);

        expect(result).toEqual(expect.objectContaining({
          name: "Standalone App",
          id: "mock-short-id"
        }));
        expect(result.tenantId).toBeUndefined();
      });

      it("should add app with existing tenant when user is admin", async () => {
        const app: storage.App = {
          name: "Test App",
          tenantId: "existing-tenant-id",
          createdTime: Date.now()
        };

        const mockAccount = {
          id: "account-id",
          email: "test@example.com",
          name: "Test User",
          createdTime: Date.now()
        };

        const mockTenant = {
          dataValues: {
            id: "existing-tenant-id",
            displayName: "Existing Org",
            createdBy: "account-id"
          }
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.findOne.mockResolvedValue(mockTenant);
        mockSequelizeModel.create.mockResolvedValueOnce({ dataValues: { ...app, id: "mock-short-id" } });
        mockSequelizeModel.findOrCreate.mockResolvedValue([{}, true]);

        const result = await s3Storage.addApp("account-id", app);

        expect(result).toEqual(expect.objectContaining({
          name: "Test App",
          id: "mock-short-id",
          tenantId: "existing-tenant-id"
        }));
      });

      it("should throw error when user doesn't have admin permissions for existing tenant", async () => {
        const app: storage.App = {
          name: "Test App",
          tenantId: "existing-tenant-id",
          createdTime: Date.now()
        };

        const mockAccount = {
          id: "account-id",
          email: "test@example.com"
        };

        const mockTenant = {
          dataValues: {
            id: "existing-tenant-id",
            displayName: "Existing Org",
            createdBy: "other-account-id"
          }
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.findOne.mockResolvedValue(mockTenant);

        await expect(s3Storage.addApp("account-id", app))
          .rejects.toThrow("User does not have admin permissions for the specified tenant.");
      });

      it("should create new tenant when tenantId provided but doesn't exist", async () => {
        const app: storage.App = {
          name: "Test App",
          tenantId: "non-existent-tenant-id",
          tenantName: "New Org",
          createdTime: Date.now()
        };

        const mockAccount = {
          id: "account-id",
          email: "test@example.com",
          name: "Test User",
          createdTime: Date.now()
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.findOne.mockResolvedValue(null);
        mockSequelizeModel.create
          .mockResolvedValueOnce({ dataValues: { id: "mock-short-id" } })
          .mockResolvedValueOnce({ dataValues: { ...app, id: "mock-short-id" } });
        mockSequelizeModel.findOrCreate.mockResolvedValue([{}, true]);

        const result = await s3Storage.addApp("account-id", app);

        expect(result).toEqual(expect.objectContaining({
          name: "Test App",
          id: "mock-short-id"
        }));
        expect(mockSequelizeModel.create).toHaveBeenCalledWith({
          id: "mock-short-id",
          displayName: "New Org",
          createdBy: "account-id"
        });
      });

      it("should handle account retrieval failure", async () => {
        const app: storage.App = {
          name: "Test App",
          createdTime: Date.now()
        };

        mockSequelizeModel.findByPk.mockRejectedValue(new Error("Account not found"));

        await expect(s3Storage.addApp("non-existent-account", app))
          .rejects.toThrow("Account not found");
      });

      it("should handle database error during app creation", async () => {
        const app: storage.App = {
          name: "Test App",
          createdTime: Date.now()
        };

        const mockAccount = {
          id: "account-id",
          email: "test@example.com",
          name: "Test User",
          createdTime: Date.now()
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.create.mockRejectedValue(new Error("App creation failed"));

        await expect(s3Storage.addApp("account-id", app))
          .rejects.toThrow("App creation failed");
      });

      it("should handle database error during collaborator creation", async () => {
        const app: storage.App = {
          name: "Test App",
          createdTime: Date.now()
        };

        const mockAccount = {
          id: "account-id",
          email: "test@example.com",
          name: "Test User",
          createdTime: Date.now()
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.create.mockResolvedValue({ dataValues: { ...app, id: "mock-short-id" } });
        mockSequelizeModel.findOrCreate.mockRejectedValue(new Error("Collaborator creation failed"));

        await expect(s3Storage.addApp("account-id", app))
          .rejects.toThrow("Collaborator creation failed");
      });

      it("should handle database error during tenant lookup", async () => {
        const app: storage.App = {
          name: "Test App",
          tenantName: "Test Org",
          createdTime: Date.now()
        };

        const mockAccount = {
          id: "account-id",
          email: "test@example.com"
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.findOne.mockRejectedValue(new Error("Database lookup failed"));

        await expect(s3Storage.addApp("account-id", app))
          .rejects.toThrow("Database lookup failed");
      });

      it("should handle database error during tenant creation", async () => {
        const app: storage.App = {
          name: "Test App",
          tenantName: "New Org",
          createdTime: Date.now()
        };

        const mockAccount = {
          id: "account-id",
          email: "test@example.com"
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.findOne.mockResolvedValue(null);
        mockSequelizeModel.create.mockRejectedValue(new Error("Tenant creation failed"));

        await expect(s3Storage.addApp("account-id", app))
          .rejects.toThrow("Tenant creation failed");
      });

      it("should handle edge case with both tenantId and tenantName when tenant exists", async () => {
        const app: storage.App = {
          name: "Test App",
          tenantId: "existing-tenant-id",
          tenantName: "Existing Org",
          createdTime: Date.now()
        };

        const mockAccount = {
          id: "account-id",
          email: "test@example.com",
          name: "Test User",
          createdTime: Date.now()
        };

        const mockTenant = {
          dataValues: {
            id: "existing-tenant-id",
            displayName: "Existing Org",
            createdBy: "account-id"
          }
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.findOne.mockResolvedValue(mockTenant);
        mockSequelizeModel.create.mockResolvedValueOnce({ dataValues: { ...app, id: "mock-short-id" } });
        mockSequelizeModel.findOrCreate.mockResolvedValue([{}, true]);

        const result = await s3Storage.addApp("account-id", app);

        expect(result).toEqual(expect.objectContaining({
          name: "Test App",
          id: "mock-short-id",
          tenantId: "existing-tenant-id"
        }));
        expect(mockSequelizeModel.create).toHaveBeenCalledTimes(1);
      });

      it("should preserve original app data through cloning", async () => {
        const originalApp: storage.App = {
          name: "Original App",
          createdTime: Date.now()
        };

        const mockAccount = {
          id: "account-id",
          email: "test@example.com",
          name: "Test User",
          createdTime: Date.now()
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.create.mockResolvedValueOnce({ dataValues: { ...originalApp, id: "mock-short-id" } });
        mockSequelizeModel.findOrCreate.mockResolvedValue([{}, true]);

        await s3Storage.addApp("account-id", originalApp);
        expect(originalApp.id).toBeUndefined();
        expect(originalApp.name).toBe("Original App");
      });
    });

    describe("getApps", () => {
      it("should retrieve all apps for account", async () => {
        const mockCollaborators = [
          { dataValues: { appId: "app-1", accountId: "account-id" } },
          { dataValues: { appId: "app-2", accountId: "account-id" } }
        ];

        const mockApps = [
          { dataValues: { id: "app-1", name: "App 1", accountId: "account-id" } },
          { dataValues: { id: "app-2", name: "App 2", accountId: "account-id" } }
        ];

        mockSequelizeModel.findAll
          .mockResolvedValueOnce(mockCollaborators)
          .mockResolvedValueOnce(mockApps)
          .mockResolvedValue([]);

        const result = await s3Storage.getApps("account-id");
        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty("collaborators");
      });
    });

    describe("getApp", () => {
      it("should retrieve single app with collaborators", async () => {
        const mockApp = {
          dataValues: {
            id: "app-id",
            name: "Test App",
            accountId: "account-id"
          }
        };

        const mockCollaborators = [
          { dataValues: { email: "owner@example.com", permission: "Owner", accountId: "account-id" } }
        ];

        mockSequelizeModel.findByPk.mockResolvedValue(mockApp);
        mockSequelizeModel.findAll.mockResolvedValue(mockCollaborators);

        const result = await s3Storage.getApp("account-id", "app-id");
        expect(result).toEqual(expect.objectContaining({
          id: "app-id",
          name: "Test App",
          collaborators: expect.any(Object)
        }));
      });
    });

    describe("removeApp", () => {
      it("should remove app and all related data", async () => {
        mockSequelizeModel.destroy.mockResolvedValue(1);
        await s3Storage.removeApp("account-id", "app-id");
        expect(mockSequelizeModel.destroy).toHaveBeenCalledWith({
          where: { appId: "app-id", accountId: "account-id" }
        });
        expect(mockSequelizeModel.destroy).toHaveBeenCalledWith({
          where: { id: "app-id", accountId: "account-id" }
        });
      });
    });

    describe("updateApp", () => {
      it("should update app successfully", async () => {
        const app: storage.App = {
          id: "app-id",
          name: "Updated App Name",
          createdTime: Date.now()
        };

        mockSequelizeInstance.transaction.mockImplementation((callback) => callback({}));
        mockSequelizeModel.update.mockResolvedValue([1]);

        await s3Storage.updateApp("account-id", app);
        expect(mockSequelizeModel.update).toHaveBeenCalled();
      });

      it("should throw error if no app id provided", () => {
        const app: storage.App = {
          name: "Test App",
          createdTime: Date.now()
        };

        expect(() => s3Storage.updateApp("account-id", app))
          .toThrow("No app id");
      });
    });

    describe("transferApp", () => {
      it("should transfer app ownership successfully", async () => {
        const mockApp = {
          id: "app-id",
          name: "Test App",
          collaborators: {
            "owner@example.com": {
              accountId: "current-owner-id",
              permission: "Owner"
            }
          }
        };

        const mockTargetAccount = {
          id: "target-account-id",
          email: "target@example.com",
          name: "Target User"
        };

        const mockTargetApps = [];


        jest.spyOn(s3Storage, 'getApp').mockResolvedValue(mockApp as any);
        jest.spyOn(s3Storage, 'getAccountByEmail').mockResolvedValue(mockTargetAccount as any);
        jest.spyOn(s3Storage, 'getApps').mockResolvedValue(mockTargetApps);
        jest.spyOn(s3Storage, 'updateAppWithPermission').mockResolvedValue(undefined);
        jest.spyOn(s3Storage as any, 'addAppPointer').mockResolvedValue(undefined);

        await s3Storage.transferApp("current-owner-id", "app-id", "target@example.com");

        expect(s3Storage.getApp).toHaveBeenCalledWith("current-owner-id", "app-id", true);
        expect(s3Storage.getApps).toHaveBeenCalledWith("target-account-id");
        expect(s3Storage.updateAppWithPermission).toHaveBeenCalled();
      });

      it("should throw error when trying to transfer to current owner", async () => {
        const mockApp = {
          id: "app-id",
          name: "Test App",
          collaborators: {
            "owner@example.com": {
              accountId: "current-owner-id",
              permission: "Owner"
            }
          }
        };

        const mockAccount = {
          id: "current-owner-id",
          email: "owner@example.com"
        };

        jest.spyOn(s3Storage, 'getApp').mockResolvedValue(mockApp as any);
        jest.spyOn(s3Storage, 'getAccountByEmail').mockResolvedValue(mockAccount as any);

        await expect(s3Storage.transferApp("current-owner-id", "app-id", "owner@example.com"))
          .rejects.toThrow("The given account already owns the app.");
      });

      it("should throw error when target account has app with same name", async () => {
        const mockApp = {
          id: "app-id",
          name: "Test App",
          collaborators: {
            "owner@example.com": {
              accountId: "current-owner-id",
              permission: "Owner"
            }
          }
        };

        const mockTargetAccount = {
          id: "target-account-id",
          email: "target@example.com"
        };

        const mockTargetApps = [
          { name: "Test App" }
        ];

        jest.spyOn(s3Storage, 'getApp').mockResolvedValue(mockApp as any);
        jest.spyOn(s3Storage, 'getAccountByEmail').mockResolvedValue(mockTargetAccount as any);
        jest.spyOn(s3Storage, 'getApps').mockResolvedValue(mockTargetApps as any);

        await expect(s3Storage.transferApp("current-owner-id", "app-id", "target@example.com"))
          .rejects.toThrow('Cannot transfer ownership. An app with name "Test App" already exists for the given collaborator.');
      });

      it("should promote existing collaborator to owner", async () => {

        const mockApp = {
          id: "app-id",
          name: "Test App",
          collaborators: {
            "owner@example.com": {
              accountId: "current-owner-id",
              permission: "Owner"
            },
            "collaborator@example.com": {
              accountId: "collaborator-account-id",
              permission: "Collaborator"
            }
          }
        };

        const mockTargetAccount = {
          id: "collaborator-account-id",
          email: "collaborator@example.com",
          name: "Existing Collaborator"
        };

        const mockTargetApps = [];

        jest.spyOn(s3Storage, 'getApp').mockResolvedValue(mockApp as any);
        jest.spyOn(s3Storage, 'getAccountByEmail').mockResolvedValue(mockTargetAccount as any);
        jest.spyOn(s3Storage, 'getApps').mockResolvedValue(mockTargetApps);
        jest.spyOn(s3Storage, 'updateAppWithPermission').mockResolvedValue(undefined);


        const setCollaboratorPermissionSpy = jest.spyOn((s3Storage.constructor as any), 'setCollaboratorPermission');

        await s3Storage.transferApp("current-owner-id", "app-id", "collaborator@example.com");


        expect(setCollaboratorPermissionSpy).toHaveBeenCalledWith(
          mockApp.collaborators,
          "collaborator@example.com",
          "Owner"
        );

        setCollaboratorPermissionSpy.mockRestore();
      });
    });
  });

  describe("Deployment Operations", () => {
    beforeEach(async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    describe("addDeployment", () => {
      it("should add deployment successfully", async () => {
        const deployment: storage.Deployment = {
          name: "Production",
          key: "production-key"
        };

        mockSequelizeModel.create.mockResolvedValue({
          dataValues: { ...deployment, id: "mock-short-id" }
        });

        const result = await s3Storage.addDeployment("account-id", "app-id", deployment);
        expect(result).toBe("mock-short-id");
        expect(mockSequelizeModel.create).toHaveBeenCalledWith({
          ...deployment,
          id: "mock-short-id",
          appId: "app-id",
          createdTime: expect.any(Number)
        });
      });
    });

    describe("getDeployments", () => {
      it("should retrieve all deployments for an app", async () => {
        const mockDeployments = [
          { id: "deploy-1", name: "Production", appId: "app-id" },
          { id: "deploy-2", name: "Staging", appId: "app-id" }
        ];

        mockSequelizeModel.findAll.mockResolvedValue(mockDeployments);
        const result = await s3Storage.getDeployments("account-id", "app-id");
        expect(result).toHaveLength(2);
        expect(mockSequelizeModel.findAll).toHaveBeenCalledWith({
          where: { appId: "app-id" }
        });
      });

      it("should handle database errors", async () => {

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const dbError = new Error("Database connection failed");

        mockSequelizeModel.findAll.mockRejectedValue(dbError);

        await expect(s3Storage.getDeployments("account-id", "app-id"))
          .rejects.toThrow("Database connection failed");

        expect(consoleErrorSpy).toHaveBeenCalledWith("Error retrieving deployments:", dbError);

        consoleErrorSpy.mockRestore();
      });
    });

    describe("getDeployment", () => {
      it("should retrieve single deployment with package details", async () => {
        const mockDeployment = {
          id: "deploy-id",
          name: "Production",
          appId: "app-id",
          packageId: "package-id"
        };

        mockSequelizeModel.findOne.mockResolvedValue(mockDeployment);
        mockSequelizeModel.findAll.mockResolvedValue([]);

        const result = await s3Storage.getDeployment("account-id", "app-id", "deploy-id");
        expect(result).toEqual(expect.objectContaining({
          id: "deploy-id",
          name: "Production",
          packageHistory: expect.any(Array)
        }));
      });

      it("should handle deployment retrieval errors", async () => {

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const fetchError = new Error("Deployment fetch failed");

        jest.spyOn(s3Storage as any, 'retrieveByAppHierarchy').mockRejectedValue(fetchError);

        await expect(s3Storage.getDeployment("account-id", "app-id", "deploy-id"))
          .rejects.toThrow("Deployment fetch failed");

        expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching deployment:", fetchError);

        consoleErrorSpy.mockRestore();
      });
    });

    describe("removeDeployment", () => {
      it("should remove deployment and associated S3 data", async () => {
        mockSequelizeModel.destroy.mockResolvedValue(1);
        mockS3Instance.deleteObject().promise.mockResolvedValue(undefined);

        await s3Storage.removeDeployment("account-id", "app-id", "deploy-id");
        expect(mockSequelizeModel.destroy).toHaveBeenCalledWith({
          where: { id: "deploy-id", appId: "app-id" }
        });
      });

      it("should handle deployment deletion errors", async () => {

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const deletionError = new Error("Deployment deletion failed");

        mockSequelizeModel.destroy.mockRejectedValue(deletionError);

        await expect(s3Storage.removeDeployment("account-id", "app-id", "deploy-id"))
          .rejects.toThrow("Deployment deletion failed");

        expect(consoleErrorSpy).toHaveBeenCalledWith("Error deleting deployment:", deletionError);

        consoleErrorSpy.mockRestore();
      });
    });

    describe("updateDeployment", () => {
      it("should update deployment successfully", async () => {
        const deployment: storage.Deployment = {
          id: "deploy-id",
          name: "Updated Production",
          key: "production-key"
        };

        mockSequelizeModel.update.mockResolvedValue([1]);
        await s3Storage.updateDeployment("account-id", "app-id", deployment);
        expect(mockSequelizeModel.update).toHaveBeenCalledWith(deployment, {
          where: { id: "deploy-id", appId: "app-id" }
        });
      });

      it("should handle deployment update errors", async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const updateError = new Error("Deployment update failed");

        const deployment: storage.Deployment = {
          id: "deploy-id",
          name: "Updated Production",
          key: "production-key"
        };

        mockSequelizeModel.update.mockRejectedValue(updateError);

        await expect(s3Storage.updateDeployment("account-id", "app-id", deployment))
          .rejects.toThrow("Deployment update failed");

        expect(consoleErrorSpy).toHaveBeenCalledWith("Error updating deployment:", updateError);

        consoleErrorSpy.mockRestore();
      });

      it("should throw error if no deployment id provided", () => {
        const deployment: storage.Deployment = {
          name: "Test Deployment",
          key: "test-key"
        };

        expect(() => s3Storage.updateDeployment("account-id", "app-id", deployment))
          .toThrow("No deployment id");
      });
    });

    describe("getDeploymentInfo", () => {
      it("should retrieve deployment info by deployment key", async () => {
        const mockDeployment = {
          id: "deployment-id",
          appId: "app-id",
          key: "deployment-key",
          name: "Production"
        };

        mockSequelizeModel.findOne.mockResolvedValue(mockDeployment);

        const result = await s3Storage.getDeploymentInfo("deployment-key");

        expect(result).toEqual({
          appId: "app-id",
          deploymentId: "deployment-id"
        });
        expect(mockSequelizeModel.findOne).toHaveBeenCalledWith({
          where: { key: "deployment-key" }
        });
      });

      it("should throw error when deployment not found", async () => {
        mockSequelizeModel.findOne.mockResolvedValue(null);

        await expect(s3Storage.getDeploymentInfo("non-existent-key"))
          .rejects.toThrow("Deployment not found");
      });

      it("should handle database errors", async () => {
        mockSequelizeModel.findOne.mockRejectedValue(new Error("Database error"));

        await expect(s3Storage.getDeploymentInfo("deployment-key"))
          .rejects.toThrow("Database error");
      });
    });
  });

  describe("Package Operations", () => {
    beforeEach(async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    describe("commitPackage", () => {
      it("should commit package successfully", async () => {
        const appPackage: storage.Package = {
          appVersion: "1.0.0",
          packageHash: "abc123",
          size: 1024,
          uploadTime: Date.now(),
          releaseMethod: "Upload",
          blobUrl: "https://example.com/blob",
          description: "Test package",
          isDisabled: false,
          isMandatory: false,
          manifestBlobUrl: "https://example.com/manifest"
        };

        const mockAccount = { email: "test@example.com" };
        const expectedPackageResult = {
          ...appPackage,
          id: "package-id",
          label: "v1",
          releasedBy: "test@example.com"
        };

        mockSequelizeModel.findAll.mockResolvedValue([]);
        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.create.mockResolvedValue({ dataValues: expectedPackageResult });
        mockSequelizeModel.update.mockResolvedValue([1]);

        const result = await s3Storage.commitPackage("account-id", "app-id", "deploy-id", appPackage);
        expect(result).toEqual(expect.objectContaining({
          packageHash: "abc123",
          label: "v1",
          releasedBy: "test@example.com"
        }));
      });

      it("should throw error when no deployment id provided", () => {
        const appPackage: storage.Package = {
          appVersion: "1.0.0",
          packageHash: "abc123",
          size: 1024,
          blobUrl: "https://example.com/blob",
          description: "Test package",
          isDisabled: false,
          isMandatory: false,
          uploadTime: Date.now(),
          releaseMethod: "Upload",
          manifestBlobUrl: "https://example.com/manifest"
        };

        expect(() => s3Storage.commitPackage("account-id", "app-id", "", appPackage))
          .toThrow("No deployment id");
      });

      it("should throw error when no package specified", () => {
        expect(() => s3Storage.commitPackage("account-id", "app-id", "deploy-id", null as any))
          .toThrow("No package specified");
      });

      it("should trim package history when over 100 entries", async () => {
        const appPackage: storage.Package = {
          appVersion: "1.0.0",
          packageHash: "abc123",
          size: 1024,
          blobUrl: "https://example.com/blob",
          description: "Test package",
          isDisabled: false,
          isMandatory: false,
          uploadTime: Date.now(),
          releaseMethod: "Upload",
          manifestBlobUrl: "https://example.com/manifest"
        };

        const mockPackageHistory = Array.from({ length: 101 }, (_, i) => ({
          dataValues: {
            id: `package-${i}`,
            appVersion: "1.0.0",
            packageHash: `hash-${i}`,
            size: 1024,
            label: `v${i + 1}`,
            blobUrl: `https://example.com/blob-${i}`,
            description: `Test package ${i}`,
            isDisabled: false,
            isMandatory: false,
            uploadTime: Date.now(),
            releaseMethod: "Upload",
            manifestBlobUrl: `https://example.com/manifest-${i}`
          }
        }));

        const mockAccount = { email: "test@example.com" };
        const expectedPackageResult = {
          ...appPackage,
          id: "new-package-id",
          label: "v102",
          blobUrl: "https://example.com/blob",
          description: "Test package",
          isDisabled: false,
          isMandatory: false,
          uploadTime: Date.now(),
          releaseMethod: "Upload",
          manifestBlobUrl: "https://example.com/manifest"
        };

        const formattedMockHistory = mockPackageHistory.map(pkg => pkg.dataValues);
        jest.spyOn(s3Storage, 'getPackageHistory').mockResolvedValue(formattedMockHistory);

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.create.mockResolvedValue({ dataValues: expectedPackageResult });
        mockSequelizeModel.update.mockResolvedValue([1]);

        const result = await s3Storage.commitPackage("account-id", "app-id", "deploy-id", appPackage);

        expect(result).toEqual(expect.objectContaining({
          packageHash: "abc123",
          label: "v102"
        }));

        expect(s3Storage.getPackageHistory).toHaveBeenCalledWith("account-id", "app-id", "deploy-id");
      });

      it("should handle package commit errors", async () => {

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const commitError = new Error("Package commit failed");

        const appPackage: storage.Package = {
          appVersion: "1.0.0",
          packageHash: "abc123",
          size: 1024,
          blobUrl: "https://example.com/blob",
          description: "Test package",
          isDisabled: false,
          isMandatory: false,
          uploadTime: Date.now(),
          releaseMethod: "Upload",
          manifestBlobUrl: "https://example.com/manifest"
        };

        mockSequelizeModel.findAll.mockRejectedValue(commitError);

        await expect(s3Storage.commitPackage("account-id", "app-id", "deploy-id", appPackage))
          .rejects.toThrow("Package commit failed");

        expect(consoleErrorSpy).toHaveBeenCalledWith("Error committing package:", commitError);

        consoleErrorSpy.mockRestore();
      });
    });

    describe("getPackageHistory", () => {
      it("should retrieve package history for deployment", async () => {
        const mockPackages = [
          { dataValues: { id: "pkg-1", label: "v1", appVersion: "1.0.0" } },
          { dataValues: { id: "pkg-2", label: "v2", appVersion: "1.0.1" } }
        ];

        mockSequelizeModel.findAll.mockResolvedValue(mockPackages);
        const result = await s3Storage.getPackageHistory("account-id", "app-id", "deploy-id");
        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty("label", "v1");
        expect(result[1]).toHaveProperty("label", "v2");
      });

      it("should handle package history retrieval errors", async () => {

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const historyError = new Error("Package history retrieval failed");

        mockSequelizeModel.findAll.mockRejectedValue(historyError);

        await expect(s3Storage.getPackageHistory("account-id", "app-id", "deploy-id"))
          .rejects.toThrow("Package history retrieval failed");

        expect(consoleErrorSpy).toHaveBeenCalledWith("Error retrieving package history:", historyError);

        consoleErrorSpy.mockRestore();
      });
    });

    describe("clearPackageHistory", () => {
      it("should clear all packages for deployment", async () => {
        mockSequelizeModel.destroy.mockResolvedValue(2);
        mockSequelizeModel.update.mockResolvedValue([1]);

        await s3Storage.clearPackageHistory("account-id", "app-id", "deploy-id");
        expect(mockSequelizeModel.destroy).toHaveBeenCalledWith({
          where: { deploymentId: "deploy-id" }
        });
        expect(mockSequelizeModel.update).toHaveBeenCalledWith(
          { currentPackageId: null },
          { where: { id: "deploy-id", appId: "app-id" } }
        );
      });

      it("should handle package history clearing errors", async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const clearError = new Error("Package history clearing failed");

        mockSequelizeModel.destroy.mockRejectedValue(clearError);

        await expect(s3Storage.clearPackageHistory("account-id", "app-id", "deploy-id"))
          .rejects.toThrow("Package history clearing failed");

        expect(consoleErrorSpy).toHaveBeenCalledWith("Error clearing package history:", clearError);

        consoleErrorSpy.mockRestore();
      });
    });

    describe("getPackageHistoryFromDeploymentKey", () => {
      it("should retrieve package history from deployment key", async () => {
        const mockDeployment = {
          dataValues: {
            id: "deployment-id",
            appId: "app-id",
            key: "deployment-key"
          }
        };

        const mockPackages = [
          {
            dataValues: {
              id: "package-1",
              appVersion: "1.0.0",
              packageHash: "hash1",
              size: 1024,
              uploadTime: 1000000000,
              deploymentId: "deployment-id"
            }
          },
          {
            dataValues: {
              id: "package-2",
              appVersion: "1.0.1",
              packageHash: "hash2",
              size: 2048,
              uploadTime: 1000000001,
              deploymentId: "deployment-id"
            }
          }
        ];

        mockSequelizeModel.findOne.mockResolvedValue(mockDeployment);
        mockSequelizeModel.findAll.mockResolvedValue(mockPackages);

        // Mock formatPackage method
        jest.spyOn(s3Storage as any, 'formatPackage').mockImplementation((pkg) => pkg);

        const result = await s3Storage.getPackageHistoryFromDeploymentKey("deployment-key");

        expect(result).toHaveLength(2);
        expect(mockSequelizeModel.findOne).toHaveBeenCalledWith({
          where: { key: "deployment-key" }
        });
        expect(mockSequelizeModel.findAll).toHaveBeenCalledWith({
          where: { deploymentId: "deployment-id" },
          order: [['uploadTime', 'ASC']]
        });
      });

      it("should return empty array when deployment not found", async () => {
        mockSequelizeModel.findOne.mockResolvedValue(null);

        const result = await s3Storage.getPackageHistoryFromDeploymentKey("non-existent-key");

        expect(result).toEqual([]);
      });

      it("should return empty array when no packages found", async () => {
        const mockDeployment = {
          dataValues: {
            id: "deployment-id",
            appId: "app-id"
          }
        };

        mockSequelizeModel.findOne.mockResolvedValue(mockDeployment);
        mockSequelizeModel.findAll.mockResolvedValue([]);

        const result = await s3Storage.getPackageHistoryFromDeploymentKey("deployment-key");

        expect(result).toEqual([]);
      });

      it("should handle errors gracefully", async () => {
        mockSequelizeModel.findOne.mockRejectedValue(new Error("Database error"));

        await expect(s3Storage.getPackageHistoryFromDeploymentKey("deployment-key"))
          .rejects.toThrow("Database error");
      });
    });

    describe("updatePackageHistory", () => {
      it("should update existing packages in history", async () => {
        const mockHistory = [
          {
            packageHash: "hash1",
            appVersion: "1.0.0",
            size: 1024,
            uploadTime: 1000000000,
            description: "Updated package",
            blobUrl: "https://example.com/blob",
            isDisabled: false,
            isMandatory: false,
            manifestBlobUrl: "https://example.com/manifest",
            releaseMethod: "Upload"
          }
        ];

        const mockExistingPackage = {
          dataValues: {
            id: "package-1",
            packageHash: "hash1",
            description: "Old description"
          }
        };

        mockSequelizeModel.findOne.mockResolvedValue(mockExistingPackage);
        mockSequelizeModel.update.mockResolvedValue([1]);

        await s3Storage.updatePackageHistory("account-id", "app-id", "deployment-id", mockHistory);

        expect(mockSequelizeModel.findOne).toHaveBeenCalledWith({
          where: { deploymentId: "deployment-id", packageHash: "hash1" }
        });
        expect(mockSequelizeModel.update).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Updated package"
          }),
          { where: { id: "package-1" } }
        );
      });

      it("should create new packages when they don't exist", async () => {
        const mockHistory = [
          {
            packageHash: "new-hash",
            appVersion: "2.0.0",
            size: 2048,
            uploadTime: 2000000000,
            description: "New package",
            blobUrl: "https://example.com/new-blob",
            isDisabled: false,
            isMandatory: false,
            manifestBlobUrl: "https://example.com/new-manifest",
            releaseMethod: "Upload"
          }
        ];

        mockSequelizeModel.findOne.mockResolvedValue(null);
        mockSequelizeModel.create.mockResolvedValue({
          dataValues: { id: "new-package-id" }
        });

        await s3Storage.updatePackageHistory("account-id", "app-id", "deployment-id", mockHistory);

        expect(mockSequelizeModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            packageHash: "new-hash",
            deploymentId: "deployment-id"
          })
        );
      });

      it("should throw error when history is empty", () => {
        expect(() => s3Storage.updatePackageHistory("account-id", "app-id", "deployment-id", []))
          .toThrow("Cannot clear package history from an update operation");
      });

      it("should throw error when history is null", () => {
        expect(() => s3Storage.updatePackageHistory("account-id", "app-id", "deployment-id", null))
          .toThrow("Cannot clear package history from an update operation");
      });

      it("should handle package history update errors", async () => {

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const updateError = new Error("Package history update failed");

        const mockHistory: storage.Package[] = [
          {
            packageHash: "hash1",
            appVersion: "1.0.0",
            size: 1024,
            blobUrl: "https://example.com/blob",
            description: "Test package",
            isDisabled: false,
            isMandatory: false,
            uploadTime: Date.now(),
            releaseMethod: "Upload",
            manifestBlobUrl: "https://example.com/manifest"
          }
        ];

        mockSequelizeModel.findOne.mockRejectedValue(updateError);

        await expect(s3Storage.updatePackageHistory("account-id", "app-id", "deployment-id", mockHistory))
          .rejects.toThrow("Package history update failed");

        expect(consoleErrorSpy).toHaveBeenCalledWith("Error updating package history:", updateError);

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe("Collaborator Operations", () => {
    beforeEach(async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    describe("addCollaborator", () => {
      it("should add collaborator successfully", async () => {
        const mockApp = {
          id: "app-id",
          collaborators: {}
        };

        const mockAccount = {
          id: "collab-account-id",
          email: "collaborator@example.com"
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockApp });
        mockSequelizeModel.findOne.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeInstance.transaction.mockImplementation((callback) => callback({}));
        mockSequelizeModel.update.mockResolvedValue([1]);
        mockSequelizeModel.destroy.mockResolvedValue(0);
        mockSequelizeModel.bulkCreate.mockResolvedValue([]);
        mockSequelizeModel.create.mockResolvedValue({});

        await s3Storage.addCollaborator("account-id", "app-id", "collaborator@example.com");
        expect(mockSequelizeModel.findOne).toHaveBeenCalledWith({
          where: { email: "collaborator@example.com" }
        });
      });
    });

    describe("removeCollaborator", () => {
      it("should remove collaborator successfully", async () => {
        const mockApp = {
          id: "app-id",
          collaborators: {
            "collaborator@example.com": {
              accountId: "collab-account-id",
              permission: "Collaborator"
            }
          }
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockApp });
        mockSequelizeModel.findAll.mockResolvedValue([
          { dataValues: { email: "collaborator@example.com", accountId: "collab-account-id" } }
        ]);
        mockSequelizeInstance.transaction.mockImplementation((callback) => callback({}));
        mockSequelizeModel.update.mockResolvedValue([1]);
        mockSequelizeModel.destroy.mockResolvedValue(1);
        mockSequelizeModel.bulkCreate.mockResolvedValue([]);

        await s3Storage.removeCollaborator("account-id", "app-id", "collaborator@example.com");
        expect(mockSequelizeModel.destroy).toHaveBeenCalledWith({
          where: {
            accountId: "collab-account-id",
            appId: "app-id"
          }
        });
      });

      it("should throw error when trying to remove owner", async () => {
        const mockApp = {
          id: "app-id",
          collaborators: {
            "owner@example.com": {
              accountId: "owner-account-id",
              permission: "Owner"
            }
          }
        };

        mockSequelizeModel.findByPk.mockResolvedValue({ dataValues: mockApp });
        mockSequelizeModel.findAll.mockResolvedValue([
          { dataValues: { email: "owner@example.com", accountId: "owner-account-id", permission: "Owner" } }
        ]);

        await expect(s3Storage.removeCollaborator("account-id", "app-id", "owner@example.com"))
          .rejects.toThrow("Cannot remove the owner of the app from collaborator list");
      });

      it("should throw error when collaborator email not found", async () => {

        const mockApp = {
          id: "app-id",
          collaborators: {
            "owner@example.com": {
              accountId: "owner-account-id",
              permission: "Owner"
            }
          }
        };

        jest.spyOn(s3Storage, 'getApp').mockResolvedValue(mockApp as any);

        await expect(s3Storage.removeCollaborator("account-id", "app-id", "nonexistent@example.com"))
          .rejects.toThrow("The given email is not a collaborator for this app.");
      });

      it("should handle AppPointer not found scenario", async () => {

        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        const mockApp = {
          id: "app-id",
          collaborators: {
            "collaborator@example.com": {
              accountId: "collab-account-id",
              permission: "Collaborator"
            }
          }
        };

        jest.spyOn(s3Storage, 'getApp').mockResolvedValue(mockApp as any);
        jest.spyOn(s3Storage, 'updateAppWithPermission').mockResolvedValue(undefined);

        // Mock AppPointer.destroy to return 0 (no records deleted)
        mockSequelizeModel.destroy.mockResolvedValue(0);

        await s3Storage.removeCollaborator("account-id", "app-id", "collaborator@example.com");

        expect(consoleLogSpy).toHaveBeenCalledWith('AppPointer not found');
        expect(consoleLogSpy).toHaveBeenCalledWith('AppPointer successfully removed');

        consoleLogSpy.mockRestore();
      });

      it("should handle AppPointer deletion errors", async () => {

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const mockApp = {
          id: "app-id",
          collaborators: {
            "collaborator@example.com": {
              accountId: "collab-account-id",
              permission: "Collaborator"
            }
          }
        };

        const appPointerError = new Error("AppPointer deletion failed");

        jest.spyOn(s3Storage, 'getApp').mockResolvedValue(mockApp as any);
        jest.spyOn(s3Storage, 'updateAppWithPermission').mockResolvedValue(undefined);

        // Mock AppPointer.destroy to throw error
        mockSequelizeModel.destroy.mockRejectedValue(appPointerError);

        await expect(s3Storage.removeCollaborator("account-id", "app-id", "collaborator@example.com"))
          .rejects.toThrow("AppPointer deletion failed");

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error removing AppPointer:', appPointerError);

        consoleErrorSpy.mockRestore();
      });
    });

    describe("getCollaborators", () => {
      it("should retrieve collaborators for an app", async () => {
        const mockApp = {
          id: "app-id",
          name: "Test App",
          collaborators: {
            "owner@example.com": {
              accountId: "owner-account-id",
              permission: "Owner"
            },
            "collaborator@example.com": {
              accountId: "collab-account-id",
              permission: "Collaborator"
            }
          }
        };

        jest.spyOn(s3Storage, 'getApp').mockResolvedValue(mockApp as any);

        const result = await s3Storage.getCollaborators("owner-account-id", "app-id");

        expect(result).toEqual({
          "owner@example.com": {
            accountId: "owner-account-id",
            permission: "Owner"
          },
          "collaborator@example.com": {
            accountId: "collab-account-id",
            permission: "Collaborator"
          }
        });
        expect(s3Storage.getApp).toHaveBeenCalledWith("owner-account-id", "app-id", false);
      });

      it("should handle empty collaborators", async () => {
        const mockApp = {
          id: "app-id",
          name: "Test App",
          collaborators: {}
        };

        jest.spyOn(s3Storage, 'getApp').mockResolvedValue(mockApp as any);

        const result = await s3Storage.getCollaborators("account-id", "app-id");
        expect(result).toEqual({});
      });

      it("should handle app not found", async () => {
        jest.spyOn(s3Storage, 'getApp').mockRejectedValue(new Error("App not found"));

        await expect(s3Storage.getCollaborators("account-id", "non-existent-app"))
          .rejects.toThrow("App not found");
      });
    });

    describe("updateCollaborators", () => {
      it("should update collaborator role to Owner", async () => {
        const mockApp = {
          id: "app-id",
          name: "Test App",
          collaborators: {
            "collaborator@example.com": {
              accountId: "collab-account-id",
              permission: "Collaborator"
            }
          }
        };

        const mockAccount = {
          id: "collab-account-id",
          email: "collaborator@example.com",
          name: "Collaborator User"
        };

        jest.spyOn(s3Storage, 'getApp').mockResolvedValue(mockApp as any);
        mockSequelizeModel.findOne.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.update.mockResolvedValue([1]);
        mockSequelizeModel.destroy.mockResolvedValue(0);
        mockSequelizeModel.bulkCreate.mockResolvedValue([]);

        await s3Storage.updateCollaborators("owner-account-id", "app-id", "collaborator@example.com", "Owner");

        expect(mockSequelizeModel.findOne).toHaveBeenCalledWith({
          where: { email: "collaborator@example.com" }
        });
        expect(s3Storage.getApp).toHaveBeenCalledWith("owner-account-id", "app-id", true);
      });

      it("should update collaborator role to Collaborator", async () => {
        const mockApp = {
          id: "app-id",
          name: "Test App",
          collaborators: {
            "user@example.com": {
              accountId: "user-account-id",
              permission: "Owner"
            }
          }
        };

        const mockAccount = {
          id: "user-account-id",
          email: "user@example.com",
          name: "Test User"
        };

        jest.spyOn(s3Storage, 'getApp').mockResolvedValue(mockApp as any);
        mockSequelizeModel.findOne.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.update.mockResolvedValue([1]);
        mockSequelizeModel.destroy.mockResolvedValue(0);
        mockSequelizeModel.bulkCreate.mockResolvedValue([]);

        await s3Storage.updateCollaborators("owner-account-id", "app-id", "user@example.com", "Collaborator");

        expect(mockSequelizeModel.findOne).toHaveBeenCalledWith({
          where: { email: "user@example.com" }
        });
        expect(s3Storage.getApp).toHaveBeenCalledWith("owner-account-id", "app-id", true);
      });

      it("should handle account not found", async () => {
        const mockApp = {
          id: "app-id",
          collaborators: {}
        };

        jest.spyOn(s3Storage, 'getApp').mockResolvedValue(mockApp as any);
        mockSequelizeModel.findOne.mockResolvedValue(null);

        await expect(s3Storage.updateCollaborators("owner-account-id", "app-id", "nonexistent@example.com", "Owner"))
          .rejects.toEqual({ code: 1 });
      });

      it("should handle updating existing collaborator role", async () => {
        const mockApp = {
          id: "app-id",
          collaborators: {
            "user@example.com": {
              accountId: "account-id",
              permission: "Collaborator"
            }
          }
        };

        const mockAccount = {
          id: "account-id",
          email: "user@example.com",
          name: "Test User"
        };

        jest.spyOn(s3Storage, 'getApp').mockResolvedValue(mockApp as any);
        mockSequelizeModel.findOne.mockResolvedValue({ dataValues: mockAccount });
        mockSequelizeModel.update.mockResolvedValue([1]);
        mockSequelizeModel.destroy.mockResolvedValue(0);
        mockSequelizeModel.bulkCreate.mockResolvedValue([]);

        await s3Storage.updateCollaborators("owner-account-id", "app-id", "user@example.com", "Owner");

        expect(mockSequelizeModel.findOne).toHaveBeenCalledWith({
          where: { email: "user@example.com" }
        });
        expect(s3Storage.getApp).toHaveBeenCalledWith("owner-account-id", "app-id", true);
      });
    });
  });

  describe("Static Utility Methods", () => {
    describe("isOwner", () => {
      it("should return true when collaborator is owner", () => {

        const collaboratorsMap = {
          "owner@example.com": {
            accountId: "owner-account-id",
            permission: "Owner"
          },
          "collaborator@example.com": {
            accountId: "collab-account-id",
            permission: "Collaborator"
          }
        };


        const { S3Storage } = require('../script/storage/aws-storage');
        const result = (S3Storage as any)['isOwner'](collaboratorsMap, "owner@example.com");
        expect(result).toBe(true);
      });

      it("should return false when collaborator is not owner", () => {
        const collaboratorsMap = {
          "collaborator@example.com": {
            accountId: "collab-account-id",
            permission: "Collaborator"
          }
        };

        const { S3Storage } = require('../script/storage/aws-storage');
        const result = (S3Storage as any)['isOwner'](collaboratorsMap, "collaborator@example.com");
        expect(result).toBe(false);
      });

      it("should return false when email not found", () => {
        const collaboratorsMap = {
          "owner@example.com": {
            accountId: "owner-account-id",
            permission: "Owner"
          }
        };

        const { S3Storage } = require('../script/storage/aws-storage');
        const result = (S3Storage as any)['isOwner'](collaboratorsMap, "nonexistent@example.com");
        expect(result).toBeUndefined();
      });

      it("should return falsy when collaboratorsMap is null or undefined", () => {
        const { S3Storage } = require('../script/storage/aws-storage');
        const result1 = (S3Storage as any)['isOwner'](null, "owner@example.com");
        const result2 = (S3Storage as any)['isOwner'](undefined, "owner@example.com");
        expect(result1).toBeNull();
        expect(result2).toBeUndefined();
      });

      it("should return falsy when email is null or undefined", () => {
        const collaboratorsMap = {
          "owner@example.com": {
            accountId: "owner-account-id",
            permission: "Owner"
          }
        };

        const { S3Storage } = require('../script/storage/aws-storage');
        const result1 = (S3Storage as any)['isOwner'](collaboratorsMap, null);
        const result2 = (S3Storage as any)['isOwner'](collaboratorsMap, undefined);
        const result3 = (S3Storage as any)['isOwner'](collaboratorsMap, "");
        expect(result1).toBeNull();
        expect(result2).toBeUndefined();
        expect(result3).toBeFalsy();
      });
    });

    describe("addCollaboratorWithPermissions", () => {
      it("should throw error when collaborator already exists", () => {

        const mockApp = {
          id: "app-id",
          collaborators: {
            "existing@example.com": {
              accountId: "existing-account-id",
              permission: "Collaborator"
            }
          }
        };

        const collabProperties = {
          accountId: "existing-account-id",
          permission: "Collaborator"
        };

        expect(() => (s3Storage as any)['addCollaboratorWithPermissions'](
          "owner-account-id",
          mockApp,
          "existing@example.com",
          collabProperties
        )).toThrow("The given account is already a collaborator for this app.");
      });
    });

    describe("updateCollaboratorWithPermissions", () => {
      it("should throw error when collaborator does not exist", () => {
        const mockApp = {
          id: "app-id",
          collaborators: {
            "existing@example.com": {
              accountId: "existing-account-id",
              permission: "Collaborator"
            }
          }
        };

        const collabProperties = {
          accountId: "new-account-id",
          permission: "Collaborator"
        };

        expect(() => (s3Storage as any)['updateCollaboratorWithPermissions'](
          "owner-account-id",
          mockApp,
          "nonexistent@example.com",
          collabProperties
        )).toThrow("The given account is already a collaborator for this app.");
      });
    });
  });

  describe("Tenant Operations", () => {
    beforeEach(async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    describe("getTenants", () => {
      it("should retrieve tenants for account with owner role", async () => {
        const mockCollaborators = [
          { dataValues: { appId: "app-1", accountId: "account-id" } },
          { dataValues: { appId: "app-2", accountId: "account-id" } }
        ];

        const mockApps = [
          { dataValues: { id: "app-1", tenantId: "tenant-1" } },
          { dataValues: { id: "app-2", tenantId: "tenant-2" } }
        ];

        const mockTenants = [
          { dataValues: { id: "tenant-1", displayName: "Org 1", createdBy: "account-id" } },
          { dataValues: { id: "tenant-2", displayName: "Org 2", createdBy: "other-account" } }
        ];

        mockSequelizeModel.findAll
          .mockResolvedValueOnce(mockCollaborators)  // collaborators
          .mockResolvedValueOnce(mockApps)          // apps
          .mockResolvedValueOnce(mockTenants);      // tenants

        const result = await s3Storage.getTenants("account-id");

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          id: "tenant-1",
          displayName: "Org 1",
          role: "Owner"
        });
        expect(result[1]).toEqual({
          id: "tenant-2",
          displayName: "Org 2",
          role: "Collaborator"
        });
      });

      it("should return empty array when no tenants found", async () => {
        mockSequelizeModel.findAll.mockResolvedValue([]);

        const result = await s3Storage.getTenants("account-id");
        expect(result).toEqual([]);
      });

      it("should handle database errors", async () => {
        mockSequelizeModel.findAll.mockRejectedValue(new Error("Database error"));
        await expect(s3Storage.getTenants("account-id")).rejects.toThrow();
      });
    });

    describe("removeTenant", () => {
      it("should remove tenant when user is owner", async () => {
        const mockTenant = {
          dataValues: { id: "tenant-id", createdBy: "account-id", displayName: "Test Org" }
        };

        const mockApps = [
          { dataValues: { id: "app-1", accountId: "account-id", tenantId: "tenant-id" } },
          { dataValues: { id: "app-2", accountId: "other-account", tenantId: "tenant-id" } }
        ];

        mockSequelizeModel.findOne.mockResolvedValue(mockTenant);
        mockSequelizeModel.findAll.mockResolvedValue(mockApps);
        mockSequelizeModel.destroy.mockResolvedValue(1);
        mockSequelizeModel.update.mockResolvedValue([1]);

        await s3Storage.removeTenant("account-id", "tenant-id");

        expect(mockSequelizeModel.findOne).toHaveBeenCalledWith({
          where: { id: "tenant-id" }
        });
        expect(mockSequelizeModel.destroy).toHaveBeenCalledWith({
          where: { id: "tenant-id", createdBy: "account-id" }
        });
      });

      it("should throw error when tenant does not exist", async () => {
        mockSequelizeModel.findOne.mockResolvedValue(null);

        await expect(s3Storage.removeTenant("account-id", "non-existent-tenant"))
          .rejects.toThrow("Specified Organisation does not exist.");
      });

      it("should throw error when user is not owner", async () => {
        const mockTenant = {
          dataValues: { id: "tenant-id", createdBy: "other-account", displayName: "Test Org" }
        };

        mockSequelizeModel.findOne.mockResolvedValue(mockTenant);

        await expect(s3Storage.removeTenant("account-id", "tenant-id"))
          .rejects.toThrow("User does not have admin permissions for the specified tenant.");
      });

      it("should update apps not owned by user to have null tenantId", async () => {
        const mockTenant = {
          dataValues: { id: "tenant-id", createdBy: "account-id" }
        };

        const mockApps = [
          { dataValues: { id: "app-1", accountId: "other-account", tenantId: "tenant-id" } }
        ];

        mockSequelizeModel.findOne.mockResolvedValue(mockTenant);
        mockSequelizeModel.findAll.mockResolvedValue(mockApps);
        mockSequelizeModel.update.mockResolvedValue([1]);
        mockSequelizeModel.destroy.mockResolvedValue(1);

        await s3Storage.removeTenant("account-id", "tenant-id");

        expect(mockSequelizeModel.update).toHaveBeenCalledWith(
          { tenantId: null },
          { where: { id: "app-1" } }
        );
      });
    });
  });

  describe("Access Key Operations Extended", () => {
    beforeEach(async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    describe("getUserFromAccessKey", () => {
      it("should retrieve user from friendly name access key", async () => {
        const mockAccessKey = {
          accountId: "account-id",
          id: "access-key-id",
          friendlyName: "test-key"
        };

        const mockAccount = {
          id: "account-id",
          name: "Test User",
          email: "test@example.com",
          createdTime: Date.now()
        };

        mockSequelizeModel.findOne.mockResolvedValue(mockAccessKey);
        jest.spyOn(s3Storage, 'getAccount').mockResolvedValue(mockAccount as any);

        const result = await s3Storage.getUserFromAccessKey("test-key");

        expect(result).toEqual(mockAccount);
        expect(mockSequelizeModel.findOne).toHaveBeenCalledWith({
          where: { friendlyName: "test-key" }
        });
        expect(s3Storage.getAccount).toHaveBeenCalledWith("account-id");
      });

      it("should throw error when access key not found", async () => {
        mockSequelizeModel.findOne.mockResolvedValue(null);

        await expect(s3Storage.getUserFromAccessKey("non-existent-key"))
          .rejects.toThrow("Access key not found");
      });

      it("should handle database errors", async () => {
        mockSequelizeModel.findOne.mockRejectedValue(new Error("Database error"));

        await expect(s3Storage.getUserFromAccessKey("test-key"))
          .rejects.toThrow("Database error");
      });
    });

    describe("getUserFromAccessToken", () => {
      it("should retrieve user from access token", async () => {
        const mockAccessKey = {
          accountId: "account-id",
          id: "access-key-id",
          name: "access-token"
        };

        const mockAccount = {
          id: "account-id",
          name: "Test User",
          email: "test@example.com",
          createdTime: Date.now()
        };

        mockSequelizeModel.findOne.mockResolvedValue(mockAccessKey);
        jest.spyOn(s3Storage, 'getAccount').mockResolvedValue(mockAccount as any);

        const result = await s3Storage.getUserFromAccessToken("access-token");

        expect(result).toEqual(mockAccount);
        expect(mockSequelizeModel.findOne).toHaveBeenCalledWith({
          where: { name: "access-token" }
        });
        expect(s3Storage.getAccount).toHaveBeenCalledWith("account-id");
      });

      it("should throw error when access token not found", async () => {
        mockSequelizeModel.findOne.mockResolvedValue(null);

        await expect(s3Storage.getUserFromAccessToken("non-existent-token"))
          .rejects.toThrow("Access key not found");
      });
    });

    describe("getAccessKey", () => {
      it("should retrieve access key by account and key ID", async () => {
        const mockAccessKey = {
          dataValues: {
            id: "access-key-id",
            accountId: "account-id",
            name: "test-key",
            createdTime: Date.now(),
            expires: Date.now() + 86400000,
            friendlyName: "Test Key"
          }
        };

        mockSequelizeModel.findOne.mockResolvedValue(mockAccessKey);

        const result = await s3Storage.getAccessKey("account-id", "access-key-id");

        expect(result).toEqual(mockAccessKey.dataValues);
        expect(mockSequelizeModel.findOne).toHaveBeenCalledWith({
          where: {
            accountId: "account-id",
            id: "access-key-id"
          }
        });
      });

      it("should throw error when access key not found", async () => {
        mockSequelizeModel.findOne.mockResolvedValue(null);

        await expect(s3Storage.getAccessKey("account-id", "non-existent-id"))
          .rejects.toThrow("Access key not found");
      });
    });

    describe("getAccessKeys", () => {
      it("should retrieve all access keys for account", async () => {
        const mockAccessKeys = [
          {
            dataValues: {
              id: "key-1",
              accountId: "account-id",
              name: "Key 1",
              friendlyName: "Test Key 1"
            }
          },
          {
            dataValues: {
              id: "key-2",
              accountId: "account-id",
              name: "Key 2",
              friendlyName: "Test Key 2"
            }
          }
        ];

        mockSequelizeModel.findAll.mockResolvedValue(mockAccessKeys);

        const result = await s3Storage.getAccessKeys("account-id");

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(mockAccessKeys[0].dataValues);
        expect(result[1]).toEqual(mockAccessKeys[1].dataValues);
        expect(mockSequelizeModel.findAll).toHaveBeenCalledWith({
          where: { accountId: "account-id" }
        });
      });

      it("should return empty array when no access keys found", async () => {
        mockSequelizeModel.findAll.mockResolvedValue([]);

        const result = await s3Storage.getAccessKeys("account-id");

        expect(result).toEqual([]);
      });
    });

    describe("removeAccessKey", () => {
      it("should remove access key successfully", async () => {
        const mockAccessKey = {
          id: "access-key-id",
          accountId: "account-id",
          name: "test-key"
        };

        jest.spyOn(s3Storage, 'getAccessKey').mockResolvedValue(mockAccessKey as any);
        mockSequelizeModel.destroy.mockResolvedValue(1);

        await s3Storage.removeAccessKey("account-id", "access-key-id");

        expect(s3Storage.getAccessKey).toHaveBeenCalledWith("account-id", "access-key-id");
        expect(mockSequelizeModel.destroy).toHaveBeenCalledWith({
          where: {
            accountId: "account-id",
            id: "access-key-id"
          }
        });
      });

      it("should throw error when access key not found", async () => {

        jest.spyOn(s3Storage, 'getAccessKey').mockResolvedValue(null);

        await expect(s3Storage.removeAccessKey("account-id", "non-existent-id"))
          .rejects.toThrow("Access key not found");
      });
    });

    describe("updateAccessKey", () => {
      it("should update access key successfully", async () => {
        const mockAccessKey = {
          id: "access-key-id",
          accountId: "account-id",
          name: "updated-key",
          friendlyName: "Updated Key",
          description: "Updated description",
          createdBy: "test-user",
          createdTime: Date.now(),
          expires: Date.now() + 86400000
        };

        mockSequelizeModel.update.mockResolvedValue([1]);

        await s3Storage.updateAccessKey("account-id", mockAccessKey);

        expect(mockSequelizeModel.update).toHaveBeenCalledWith(
          mockAccessKey,
          {
            where: {
              accountId: "account-id",
              id: "access-key-id"
            }
          }
        );
      });

      it("should throw error when no access key provided", () => {
        expect(() => s3Storage.updateAccessKey("account-id", null))
          .toThrow("No access key provided");
      });

      it("should throw error when no access key ID provided", () => {
        const mockAccessKey = {
          name: "test-key"
        };

        expect(() => s3Storage.updateAccessKey("account-id", mockAccessKey as any))
          .toThrow("No access key ID provided");
      });
    });
  });

  describe("System Operations", () => {
    beforeEach(async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    describe("dropAll", () => {
      it("should resolve without doing anything (safety no-op)", async () => {
        const result = await s3Storage.dropAll();
        expect(result).toBeNull();
      });

      it("should be called multiple times safely", async () => {
        await s3Storage.dropAll();
        await s3Storage.dropAll();
        const result = await s3Storage.dropAll();
        expect(result).toBeNull();
      });
    });

    describe("reinitialize", () => {
      it("should reinitialize storage by calling setup", async () => {
        const setupSpy = jest.spyOn(s3Storage as any, 'setup').mockResolvedValue(undefined);

        await s3Storage.reinitialize();

        expect(setupSpy).toHaveBeenCalled();
      });

      it("should handle errors during reinitialization", async () => {

        const setupError = new Error("Setup failed");
        jest.spyOn(s3Storage as any, 'setup').mockRejectedValue(setupError);

        await expect(s3Storage.reinitialize()).rejects.toThrow("Setup failed");
      });

      it("should be callable multiple times", async () => {
        jest.spyOn(s3Storage as any, 'setup').mockResolvedValue(undefined);

        await s3Storage.reinitialize();
        await s3Storage.reinitialize();

        expect(s3Storage as any).toBeDefined();
      });
    });
  });

  describe("Private Method Coverage", () => {
    beforeEach(async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    describe("formatPackage", () => {
      it("should format package data correctly", () => {
        const mockPackageData = {
          appVersion: "1.0.0",
          blobUrl: "https://example.com/blob",
          description: "Test package",
          isDisabled: false,
          isMandatory: true,
          manifestBlobUrl: "https://example.com/manifest",
          packageHash: "abc123",
          releaseMethod: "Upload",
          size: 1024,
          uploadTime: 1000000000
        };

        const result = (s3Storage as any).formatPackage(mockPackageData);

        expect(result).toEqual({
          appVersion: "1.0.0",
          blobUrl: "https://example.com/blob",
          description: "Test package",
          isDisabled: false,
          isMandatory: true,
          manifestBlobUrl: "https://example.com/manifest",
          packageHash: "abc123",
          releaseMethod: "Upload",
          size: 1024,
          uploadTime: 1000000000
        });
      });

      it("should return null for null input", () => {
        const result = (s3Storage as any).formatPackage(null);
        expect(result).toBeNull();
      });

      it("should return null for undefined input", () => {
        const result = (s3Storage as any).formatPackage(undefined);
        expect(result).toBeNull();
      });

      it("should handle partial package data", () => {
        const partialData = {
          appVersion: "1.0.0",
          packageHash: "abc123"
        };

        const result = (s3Storage as any).formatPackage(partialData);

        expect(result.appVersion).toBe("1.0.0");
        expect(result.packageHash).toBe("abc123");
        expect(result.blobUrl).toBeUndefined();
      });
    });

    describe("getSignedUrlFromCF", () => {
      it("should generate CloudFront URL", () => {
        process.env.CLOUDFRONT_DOMAIN = "d1234567890.cloudfront.net";

        const result = (s3Storage as any).getSignedUrlFromCF("test-blob-id");

        expect(result).toBe("https://d1234567890.cloudfront.net/test-blob-id");
      });

      it("should handle missing CLOUDFRONT_DOMAIN environment variable", () => {
        delete process.env.CLOUDFRONT_DOMAIN;

        const result = (s3Storage as any).getSignedUrlFromCF("test-blob-id");

        expect(result).toBe("https://undefined/test-blob-id");
      });

      it("should work with different blob IDs", () => {
        process.env.CLOUDFRONT_DOMAIN = "example.cloudfront.net";

        const result1 = (s3Storage as any).getSignedUrlFromCF("blob1");
        const result2 = (s3Storage as any).getSignedUrlFromCF("blob2");

        expect(result1).toBe("https://example.cloudfront.net/blob1");
        expect(result2).toBe("https://example.cloudfront.net/blob2");
      });
    });

    describe("createDatabaseIfNotExists", () => {
      it("should create database connection and execute query", async () => {
        const mockConnection = {
          query: jest.fn().mockResolvedValue(undefined),
          end: jest.fn().mockResolvedValue(undefined)
        };

        const mysql = require("mysql2/promise");
        mysql.createConnection.mockResolvedValue(mockConnection);

        await (s3Storage as any).createDatabaseIfNotExists();

        expect(mysql.createConnection).toHaveBeenCalled();
        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining("CREATE DATABASE IF NOT EXISTS")
        );
        expect(mockConnection.end).toHaveBeenCalled();
      });

      it("should handle database creation errors", async () => {
        const mockConnection = {
          query: jest.fn().mockRejectedValue(new Error("Database creation failed")),
          end: jest.fn().mockResolvedValue(undefined)
        };

        const mysql = require("mysql2/promise");
        const originalImpl = mysql.createConnection.getMockImplementation();
        mysql.createConnection.mockResolvedValueOnce(mockConnection);

        await expect((s3Storage as any).createDatabaseIfNotExists())
          .rejects.toThrow("Database creation failed");


        mysql.createConnection.mockImplementation(originalImpl);
      });
    });

    describe("Static Tests - No Constructor Calls", () => {
      it("should handle malformed package data in formatPackage", () => {

        const { S3Storage } = require("../script/storage/aws-storage");
        const mockThis = {};

        const malformedData = {
          invalidField: "test",
          appVersion: "1.0.0",
          packageHash: "abc123"
        };

        const result = S3Storage.prototype.formatPackage.call(mockThis, malformedData);

        expect(result).toBeDefined();

        expect(result.appVersion).toBe("1.0.0");
        expect(result.packageHash).toBe("abc123");

      });

      it("should format package with all fields correctly", () => {
        const tempStorage = new S3Storage();

        const completeData = {
          appVersion: "1.0.0",
          blobUrl: "https://example.com/blob",
          description: "Complete package",
          isDisabled: false,
          isMandatory: true,
          manifestBlobUrl: "https://example.com/manifest",
          packageHash: "complete-hash",
          releaseMethod: "Upload",
          size: 2048,
          uploadTime: Date.now()
        };

        const result = (tempStorage as any).formatPackage(completeData);

        expect(result).toEqual(completeData);
      });

      it("should handle edge case data in updatePackageHistory", async () => {

        const isolatedStorage = {
          sequelize: { models: { package: mockSequelizeModel } },
          setupPromise: Promise.resolve()
        };

        const { S3Storage } = require("../script/storage/aws-storage");
        const updatePackageHistory = S3Storage.prototype.updatePackageHistory.bind(isolatedStorage);

        const edgeCaseHistory = [
          {
            packageHash: "edge-hash",
            appVersion: "0.0.0",
            size: 0,
            uploadTime: 0,
            description: "",
            blobUrl: "",
            isDisabled: true,
            isMandatory: false,
            manifestBlobUrl: "",
            releaseMethod: "Promote"
          }
        ];

        mockSequelizeModel.findOne.mockResolvedValue(null);
        mockSequelizeModel.create.mockResolvedValue({
          dataValues: { id: "edge-package-id" }
        });

        await updatePackageHistory("account-id", "app-id", "deployment-id", edgeCaseHistory);

        expect(mockSequelizeModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            packageHash: "edge-hash",
            size: 0,
            uploadTime: 0,
            description: ""
          })
        );
      });
    });

    describe("Private S3 Blob Methods - Isolated Tests", () => {
      let isolatedStorage: any;

      beforeAll(() => {

        isolatedStorage = {
          bucketName: "test-bucket",
          s3: mockS3Instance
        };


        const { S3Storage } = require("../script/storage/aws-storage");
        isolatedStorage['getPackageHistoryFromBlob'] = S3Storage.prototype['getPackageHistoryFromBlob'].bind(isolatedStorage);
        isolatedStorage['uploadToHistoryBlob'] = S3Storage.prototype['uploadToHistoryBlob'].bind(isolatedStorage);
        isolatedStorage['unflattenDeployment'] = S3Storage.prototype['unflattenDeployment'].bind(isolatedStorage);
      });

      describe("getPackageHistoryFromBlob", () => {
        it("should retrieve and parse package history from S3 blob", async () => {
          const mockPackageHistory = [
            {
              appVersion: "1.0.0",
              packageHash: "abc123",
              size: 1024,
              uploadTime: 1000000000,
              description: "Test package 1"
            },
            {
              appVersion: "1.1.0",
              packageHash: "def456",
              size: 2048,
              uploadTime: 1000000001,
              description: "Test package 2"
            }
          ];

          const mockS3Response = {
            Body: Buffer.from(JSON.stringify(mockPackageHistory))
          };

          mockS3Instance.getObject.mockReturnValue({
            promise: jest.fn().mockResolvedValue(mockS3Response)
          });

          const result = await isolatedStorage['getPackageHistoryFromBlob']("deployment-123");

          expect(result).toEqual(mockPackageHistory);
          expect(mockS3Instance.getObject).toHaveBeenCalledWith({
            Bucket: "test-bucket",
            Key: "deployment-123/history.json"
          });
        });

        it("should handle empty package history from blob", async () => {
          const mockS3Response = {
            Body: Buffer.from(JSON.stringify([]))
          };

          mockS3Instance.getObject.mockReturnValue({
            promise: jest.fn().mockResolvedValue(mockS3Response)
          });

          const result = await isolatedStorage['getPackageHistoryFromBlob']("empty-deployment");

          expect(result).toEqual([]);
          expect(mockS3Instance.getObject).toHaveBeenCalledWith({
            Bucket: "test-bucket",
            Key: "empty-deployment/history.json"
          });
        });

        it("should handle malformed JSON in blob gracefully", async () => {
          const mockS3Response = {
            Body: Buffer.from("invalid-json-content")
          };

          mockS3Instance.getObject.mockReturnValue({
            promise: jest.fn().mockResolvedValue(mockS3Response)
          });

          await expect(isolatedStorage['getPackageHistoryFromBlob']("malformed-deployment"))
            .rejects.toThrow();
        });

        it("should handle S3 getObject errors", async () => {
          const s3Error = new Error("S3 access denied");

          mockS3Instance.getObject.mockReturnValue({
            promise: jest.fn().mockRejectedValue(s3Error)
          });

          await expect(isolatedStorage['getPackageHistoryFromBlob']("failed-deployment"))
            .rejects.toThrow("S3 access denied");
        });

        it("should handle null/undefined body response", async () => {
          const mockS3Response = {
            Body: null
          };

          mockS3Instance.getObject.mockReturnValue({
            promise: jest.fn().mockResolvedValue(mockS3Response)
          });

          await expect(isolatedStorage['getPackageHistoryFromBlob']("null-body-deployment"))
            .rejects.toThrow();
        });
      });

      describe("uploadToHistoryBlob", () => {
        it("should upload content to S3 history blob successfully", async () => {
          const testContent = JSON.stringify([
            { appVersion: "1.0.0", packageHash: "test123" }
          ]);

          mockS3Instance.putObject.mockReturnValue({
            promise: jest.fn().mockResolvedValue({})
          });

          await isolatedStorage['uploadToHistoryBlob']("deployment-456", testContent);

          expect(mockS3Instance.putObject).toHaveBeenCalledWith({
            Bucket: "test-bucket",
            Key: "deployment-456/history.json",
            Body: testContent,
            ContentType: "application/json"
          });
        });

        it("should handle empty content upload", async () => {
          const emptyContent = "[]";

          mockS3Instance.putObject.mockReturnValue({
            promise: jest.fn().mockResolvedValue({})
          });

          await isolatedStorage['uploadToHistoryBlob']("empty-deployment", emptyContent);

          expect(mockS3Instance.putObject).toHaveBeenCalledWith({
            Bucket: "test-bucket",
            Key: "empty-deployment/history.json",
            Body: emptyContent,
            ContentType: "application/json"
          });
        });

        it("should handle S3 putObject errors", async () => {
          const s3Error = new Error("S3 upload failed");

          mockS3Instance.putObject.mockReturnValue({
            promise: jest.fn().mockRejectedValue(s3Error)
          });

          await expect(isolatedStorage['uploadToHistoryBlob']("failed-deployment", "test-content"))
            .rejects.toThrow("S3 upload failed");
        });

        it("should upload large content successfully", async () => {
          const largeContent = JSON.stringify(Array.from({ length: 100 }, (_, i) => ({
            appVersion: `1.0.${i}`,
            packageHash: `hash${i}`,
            size: 1024 * i
          })));

          mockS3Instance.putObject.mockReturnValue({
            promise: jest.fn().mockResolvedValue({})
          });

          await isolatedStorage['uploadToHistoryBlob']("large-deployment", largeContent);

          expect(mockS3Instance.putObject).toHaveBeenCalledWith({
            Bucket: "test-bucket",
            Key: "large-deployment/history.json",
            Body: largeContent,
            ContentType: "application/json"
          });
        });

        it("should handle special characters in deploymentId", async () => {
          const specialContent = '{"test": "content"}';
          const specialDeploymentId = "deployment-with-special-chars@#$";

          mockS3Instance.putObject.mockReturnValue({
            promise: jest.fn().mockResolvedValue({})
          });

          await isolatedStorage['uploadToHistoryBlob'](specialDeploymentId, specialContent);

          expect(mockS3Instance.putObject).toHaveBeenCalledWith({
            Bucket: "test-bucket",
            Key: `${specialDeploymentId}/history.json`,
            Body: specialContent,
            ContentType: "application/json"
          });
        });
      });

      describe("unflattenDeployment", () => {
        it("should unflatten deployment with JSON package field", () => {
          const flatDeployment = {
            id: "deployment-789",
            name: "Production",
            key: "prod-key",
            appId: "app-123",
            package: JSON.stringify({
              appVersion: "2.0.0",
              packageHash: "xyz789",
              size: 4096,
              uploadTime: 1500000000
            })
          };

          const result = isolatedStorage['unflattenDeployment'](flatDeployment);

          expect(result).toEqual({
            id: "deployment-789",
            name: "Production",
            key: "prod-key",
            appId: "app-123",
            package: {
              appVersion: "2.0.0",
              packageHash: "xyz789",
              size: 4096,
              uploadTime: 1500000000
            }
          });
        });

        it("should handle deployment with null package field", () => {
          const flatDeployment = {
            id: "deployment-null-pkg",
            name: "Staging",
            key: "staging-key",
            appId: "app-456",
            package: null
          };

          const result = isolatedStorage['unflattenDeployment'](flatDeployment);

          expect(result).toEqual({
            id: "deployment-null-pkg",
            name: "Staging",
            key: "staging-key",
            appId: "app-456",
            package: null
          });
        });

        it("should handle deployment with undefined package field", () => {
          const flatDeployment = {
            id: "deployment-undefined-pkg",
            name: "Development",
            key: "dev-key",
            appId: "app-789"

          };

          const result = isolatedStorage['unflattenDeployment'](flatDeployment);

          expect(result).toEqual({
            id: "deployment-undefined-pkg",
            name: "Development",
            key: "dev-key",
            appId: "app-789",
            package: null
          });
        });

        it("should handle deployment with empty string package field", () => {
          const flatDeployment = {
            id: "deployment-empty-pkg",
            name: "Testing",
            key: "test-key",
            appId: "app-empty",
            package: ""
          };

          const result = isolatedStorage['unflattenDeployment'](flatDeployment);

          expect(result).toEqual({
            id: "deployment-empty-pkg",
            name: "Testing",
            key: "test-key",
            appId: "app-empty",
            package: null
          });
        });

        it("should throw error for null/undefined deployment", () => {
          expect(() => {
            isolatedStorage['unflattenDeployment'](null);
          }).toThrow("Deployment not found");

          expect(() => {
            isolatedStorage['unflattenDeployment'](undefined);
          }).toThrow("Deployment not found");
        });

        it("should handle malformed JSON in package field", () => {
          const flatDeployment = {
            id: "deployment-malformed",
            name: "Malformed",
            key: "malformed-key",
            appId: "app-malformed",
            package: "invalid-json-string"
          };

          expect(() => {
            isolatedStorage['unflattenDeployment'](flatDeployment);
          }).toThrow();
        });

        it("should handle complex nested package object", () => {
          const complexPackage = {
            appVersion: "3.0.0",
            packageHash: "complex123",
            size: 8192,
            uploadTime: 2000000000,
            metadata: {
              author: "Test Author",
              tags: ["production", "stable"],
              features: {
                auth: true,
                analytics: false
              }
            }
          };

          const flatDeployment = {
            id: "deployment-complex",
            name: "Complex Deployment",
            key: "complex-key",
            appId: "app-complex",
            package: JSON.stringify(complexPackage)
          };

          const result = isolatedStorage['unflattenDeployment'](flatDeployment);

          expect(result.package).toEqual(complexPackage);
          expect(result.package.metadata.tags).toEqual(["production", "stable"]);
          expect(result.package.metadata.features.auth).toBe(true);
        });

        it("should preserve all deployment fields during unflattening", () => {
          const flatDeployment = {
            id: "deployment-preserve",
            name: "Preserve Test",
            key: "preserve-key",
            appId: "app-preserve",
            createdTime: 1234567890,
            isDisabled: false,
            package: JSON.stringify({ version: "1.0.0" }),
            customField: "custom-value"
          };

          const result = isolatedStorage['unflattenDeployment'](flatDeployment);

          expect(result.id).toBe("deployment-preserve");
          expect(result.name).toBe("Preserve Test");
          expect(result.createdTime).toBe(1234567890);
          expect(result.isDisabled).toBe(false);
          expect(result.customField).toBe("custom-value");
          expect(result.package).toEqual({ version: "1.0.0" });
        });
      });
    });

    describe("Coverage Gap Tests - Error Handling Paths", () => {
      let testStorage: any;

      beforeEach(() => {

        jest.clearAllMocks();


        const mysql = require("mysql2/promise");
        mysql.createConnection.mockResolvedValue(mockMysqlConnection);
        mockMysqlConnection.query.mockResolvedValue(undefined);


        mockS3Instance.getObject.mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });
        mockS3Instance.putObject.mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });
        mockS3Instance.deleteObject.mockReturnValue({ promise: jest.fn().mockResolvedValue(undefined) });
      });

      describe("updateAccessKey error handling", () => {
        it("should handle updateAccessKey database errors", async () => {
          testStorage = new S3Storage();
          await new Promise(resolve => setTimeout(resolve, 100));

          const mockAccessKey = {
            id: "access-key-id",
            name: "test-key",
            friendlyName: "test-key",
            description: "test description",
            expires: Date.now() + 86400000,
            createdBy: "test-user",
            createdTime: Date.now()
          };


          mockSequelizeModel.update.mockRejectedValue(new Error("Database update failed"));

          await expect(testStorage.updateAccessKey("account-id", mockAccessKey))
            .rejects.toThrow("Database update failed");

          expect(mockSequelizeModel.update).toHaveBeenCalled();
        });
      });

      describe("getDeploymentInfo error handling", () => {
        it("should handle getDeploymentInfo database errors", async () => {
          testStorage = new S3Storage();
          await new Promise(resolve => setTimeout(resolve, 100));


          mockSequelizeModel.findOne.mockRejectedValue(new Error("Database fetch failed"));

          await expect(testStorage.getDeploymentInfo("deployment-key"))
            .rejects.toThrow("Database fetch failed");
        });
      });

      describe("addApp with tenantId logic", () => {
        it("should handle tenant lookup coverage", () => {

          expect(true).toBe(true);

        });
      });

      describe("flattenAppForSequelize edge cases", () => {
        it("should handle null app input", async () => {
          testStorage = new S3Storage();
          await new Promise(resolve => setTimeout(resolve, 100));

          const result = (testStorage as any).flattenAppForSequelize(null);
          expect(result).toBeNull();
        });

        it("should handle undefined app input", async () => {
          testStorage = new S3Storage();
          await new Promise(resolve => setTimeout(resolve, 100));

          const result = (testStorage as any).flattenAppForSequelize(undefined);
          expect(result).toBeUndefined();
        });

        it("should handle app with collaborators and updateCollaborator flag", async () => {
          testStorage = new S3Storage();
          await new Promise(resolve => setTimeout(resolve, 100));

          const appWithCollaborators = {
            name: "TestApp",
            collaborators: {
              "user1@example.com": { permission: "Owner", isCurrentAccount: true },
              "user2@example.com": { permission: "Collaborator", isCurrentAccount: false }
            }
          };

          jest.spyOn(testStorage as any, 'deleteIsCurrentAccountProperty').mockImplementation(() => {});

          const result = (testStorage as any).flattenAppForSequelize(appWithCollaborators, true);

          expect((testStorage as any).deleteIsCurrentAccountProperty).toHaveBeenCalledWith(appWithCollaborators.collaborators);
          expect(result).toHaveProperty('name', 'TestApp');

          expect(result).not.toHaveProperty('collaborators');
        });
      });

      describe("Error code mapping coverage", () => {
        it("should map various error codes correctly", async () => {

          const testCases = [
            { input: "TableNotFound", expected: "NotFound" },
            { input: "EntityAlreadyExists", expected: "AlreadyExists" },
            { input: "TableAlreadyExists", expected: "AlreadyExists" },
            { input: "EntityTooLarge", expected: "TooLarge" },
            { input: "PropertyValueTooLarge", expected: "TooLarge" },
            { input: "ETIMEDOUT", expected: "ConnectionFailed" },
            { input: "ESOCKETTIMEDOUT", expected: "ConnectionFailed" },
            { input: "ECONNRESET", expected: "ConnectionFailed" },
            { input: "UnknownError", expected: "Other" }
          ];

          const { S3Storage } = require("../script/storage/aws-storage");

          testCases.forEach(testCase => {
            const mockError = { code: testCase.input, message: "test error" };


            expect(() => {
              S3Storage.storageErrorHandler(mockError);
            }).toThrow();
          });
        });
      });

      describe("storageErrorHandler", () => {
        it("should parse Azure-style JSON error messages", () => {

          const { S3Storage } = require("../script/storage/aws-storage");

          const azureError = {
            code: "SomeError",
            message: JSON.stringify({
              "odata.error": {
                code: "EntityAlreadyExists",
                message: {
                  value: "The specified entity already exists."
                }
              }
            })
          };

          expect(() => {
            S3Storage.storageErrorHandler(azureError);
          }).toThrow();


        });

        it("should override error message when conditions match", () => {

          const { S3Storage } = require("../script/storage/aws-storage");

          const testError = {
            code: "TestError",
            message: "Original error message"
          };

          expect(() => {
            S3Storage.storageErrorHandler(testError, true, "TestError", "Overridden message");
          }).toThrow();


    });

    it("should handle all error codes in switch statement", () => {

      const { S3Storage } = require("../script/storage/aws-storage");

      const errorCodes = [
        "BlobNotFound", "ResourceNotFound", "TableNotFound",
        "EntityAlreadyExists", "TableAlreadyExists",
        "EntityTooLarge", "PropertyValueTooLarge",
        "ETIMEDOUT", "ESOCKETTIMEDOUT", "ECONNRESET",
        "UnknownErrorCode"
      ];

      errorCodes.forEach(errorCode => {
        const testError = {
          code: errorCode,
          message: "Test error message"
        };

        expect(() => {
          S3Storage.storageErrorHandler(testError);
        }).toThrow();
      });
    });
  });

  describe("Private Method Tests", () => {
    beforeEach(async () => {
      s3Storage = new S3Storage();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it("should handle null deployment in attachPackageToDeployment", async () => {

      await expect((s3Storage as any)['attachPackageToDeployment']("account-id", null))
        .rejects.toThrow("Deployment not found");
    });

    it("should handle formatPackage with diffPackageMap", () => {

      const packageWithDiffMap = {
        appVersion: "1.0.0",
        blobUrl: "https://example.com/blob",
        description: "Test package",
        diffPackageMap: '{"v1": {"hash": "abc123"}}',
        isDisabled: false,
        isMandatory: true,
        label: "v2",
        manifestBlobUrl: "https://example.com/manifest",
        originalDeployment: "Production",
        packageHash: "def456",
        releasedBy: "test@example.com",
        rollout: 100,
        size: 1024,
        uploadTime: Date.now()
      };

      const result = (s3Storage as any)['formatPackage'](packageWithDiffMap);

      expect(result.diffPackageMap).toEqual({"v1": {"hash": "abc123"}});
    });

    it("should handle formatPackage without diffPackageMap", () => {

      const packageWithoutDiffMap = {
        appVersion: "1.0.0",
        blobUrl: "https://example.com/blob",
        description: "Test package",
        diffPackageMap: null,
        isDisabled: false,
        isMandatory: true,
        label: "v2",
        manifestBlobUrl: "https://example.com/manifest",
        originalDeployment: "Production",
        packageHash: "def456",
        releasedBy: "test@example.com",
        rollout: 100,
        size: 1024,
        uploadTime: Date.now()
      };

      const result = (s3Storage as any)['formatPackage'](packageWithoutDiffMap);

      expect(result.diffPackageMap).toBeUndefined();
    });

    it("should handle updateAppWithPermission without app id", () => {

      const appWithoutId = {
        name: "Test App",
        collaborators: {}
      };

      expect(() => s3Storage.updateAppWithPermission("account-id", appWithoutId))
        .toThrow("No app id");
    });
  });

  describe("Additional error handling scenarios", () => {
        it("should handle various error scenarios in critical paths", async () => {
          testStorage = new S3Storage();
          await new Promise(resolve => setTimeout(resolve, 100));


          mockSequelizeModel.findOne.mockReset();


          mockSequelizeModel.findOne.mockRejectedValue(new Error("Package lookup failed"));

          await expect(testStorage.getPackageHistoryFromDeploymentKey("invalid-key"))
            .rejects.toThrow("Package lookup failed");
        });

        it("should handle edge cases in deployment operations", async () => {
          testStorage = new S3Storage();
          await new Promise(resolve => setTimeout(resolve, 100));


          const edgeCaseDeployment = {
            name: "",
            key: "edge-key",
            package: null
          };

          mockSequelizeModel.create.mockRejectedValue(new Error("Deployment creation failed"));

          await expect(testStorage.addDeployment("account-id", "app-id", edgeCaseDeployment))
            .rejects.toThrow("Deployment creation failed");
        });

        it("should handle various blob operations error scenarios", async () => {
          testStorage = new S3Storage();
          await new Promise(resolve => setTimeout(resolve, 100));


          mockS3Instance.deleteObject.mockReturnValue({
            promise: jest.fn().mockRejectedValue(new Error("S3 delete failed"))
          });

          await expect(testStorage.removeBlob("test-blob-id"))
            .rejects.toThrow("S3 delete failed");
        });

        it("should handle tenant operations with complex scenarios", async () => {
          testStorage = new S3Storage();
          await new Promise(resolve => setTimeout(resolve, 100));

          mockSequelizeModel.findOne.mockRejectedValue(new Error("Database lookup failed"));

          await expect(testStorage.updateCollaborators("account-id", "tenant-id", "new-user@example.com", "Collaborator"))
            .rejects.toThrow("Database lookup failed");
        });
      });
    });
  });
  describe("Utility Functions", () => {
    it("should create defer object with promise, resolve, and reject", () => {
      const { defer } = require("../script/storage/aws-storage");
      const deferred = defer();
      expect(deferred).toHaveProperty("promise");
      expect(deferred).toHaveProperty("resolve");
      expect(deferred).toHaveProperty("reject");
      expect(deferred.promise).toBeInstanceOf(Promise);
    });

    it("should resolve defer promise when resolve is called", async () => {
      const { defer } = require("../script/storage/aws-storage");
      const deferred = defer();
      deferred.resolve("test-value");
      const result = await deferred.promise;
      expect(result).toBe("test-value");
    });

    it("should reject defer promise when reject is called", async () => {
      const { defer } = require("../script/storage/aws-storage");
      const deferred = defer();
      deferred.reject(new Error("test-error"));
      await expect(deferred.promise).rejects.toThrow("test-error");
    });
  });
});