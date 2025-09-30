import { CreateBucketRequest, HeadBucketRequest } from "aws-sdk/clients/s3";
import { Options } from "sequelize";

export const DB_NAME = "codepushdb";
export const DB_USER = "codepush";
export const DB_PASS = "root";
export const DB_HOST = "localhost";
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "codepush-local-bucket";

export const SEQUELIZE_CONFIG: Options = {
  database: process.env.DB_NAME || DB_NAME,
  dialect: "mysql",
  replication: {
    write: {
      host: process.env.DB_HOST || DB_HOST,
      username: process.env.DB_USER || DB_USER,
      password: process.env.DB_PASS || DB_PASS,
    },
    read: [
      {
        host: process.env.DB_HOST_READER,
        username: process.env.DB_USER || DB_USER,
        password: process.env.DB_PASS || DB_PASS,
      },
    ],
  },
  pool: {
    max: 5,
    min: 1,
    acquire: 10000,
    idle: 10000,
    evict: 15000,
    maxUses: 100000,
  },
};

export const S3_CONFIG = {
  endpoint: process.env.S3_ENDPOINT, // LocalStack S3 endpoint
  s3ForcePathStyle: true,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  region: process.env.S3_REGION,
};

export const S3_HEAD_BUCKET_PARAMS: HeadBucketRequest = {
  Bucket: S3_BUCKET_NAME,
};

export const S3_CREATE_BUCKET_PARAMS: CreateBucketRequest = {
  Bucket: S3_BUCKET_NAME,
};
