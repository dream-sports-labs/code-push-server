// seed.ts — Seed tables + history blobs for Azurite local emulator

import {
  TableClient,
  TableServiceClient,
  AzureNamedKeyCredential,
} from "@azure/data-tables";
import { BlobServiceClient } from "@azure/storage-blob";

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const account    = process.env.AZURE_STORAGE_ACCOUNT!;
const accountKey = process.env.AZURE_STORAGE_ACCESS_KEY!;

const tableEndpoint = `http://127.0.0.1:10002/${account}`;

// use connection string for blob so emulator HTTP is allowed
const blobServiceClient = BlobServiceClient.fromConnectionString(
  "UseDevelopmentStorage=true"
);

const tableCred          = new AzureNamedKeyCredential(account, accountKey);
const tableServiceClient = new TableServiceClient(
  tableEndpoint,
  tableCred,
  { allowInsecureConnection: true }
);

// ─── SEED DATA ────────────────────────────────────────────────────────────────

const seedData = {
  accounts: [
    {
      partitionKey: "accountId id_0",
      rowKey:       "accountId* id_0",
      id:           "id_0",
      name:         "Default User",
      email:        "default@example.com",
    },
    {
      partitionKey:        "email default@example.com",
      rowKey:              "",
      partitionKeyPointer: "accountId id_0",
      rowKeyPointer:       "accountId* id_0",
    },
    {
      partitionKey: "Account",
      rowKey:       "id_0",
      email:        "user1@example.com",
      name:         "User One",
      createdTime:  Date.now().toString(),
    },
    {
      partitionKey: "Account",
      rowKey:       "id_1",
      email:        "user2@example.com",
      name:         "User Two",
      createdTime:  Date.now().toString(),
    },
  ],
  tenants: [
    {
      partitionKey: "Tenant",
      rowKey:       "tenant_1",
      displayName:  "Organization One",
      createdBy:    "id_0",
    },
    {
      partitionKey: "Tenant",
      rowKey:       "tenant_2",
      displayName:  "Organization Two",
      createdBy:    "id_1",
    },
  ],
  apps: [
    {
      partitionKey: "App",
      rowKey:       "id_2",
      name:         "App One",
      accountId:    "id_0",
      tenantId:     "tenant_1",
      createdTime:  Date.now().toString(),
    },
    {
      partitionKey: "App",
      rowKey:       "id_3",
      name:         "App Two",
      accountId:    "id_1",
      tenantId:     "tenant_2",
      createdTime:  Date.now().toString(),
    },
    {
      partitionKey: "App",
      rowKey:       "id_4",
      name:         "Independent App",
      accountId:    "id_0",
      createdTime:  Date.now().toString(),
    },
  ],
  collaborators: [
    {
      partitionKey: "Collaborator",
      rowKey:       "id_2:user1@example.com",
      email:        "user1@example.com",
      accountId:    "id_0",
      appId:        "id_2",
      permission:   "Owner",
      role:         "Admin",
    },
    {
      partitionKey: "Collaborator",
      rowKey:       "id_3:user2@example.com",
      email:        "user2@example.com",
      accountId:    "id_1",
      appId:        "id_3",
      permission:   "Owner",
      role:         "Admin",
    },
  ],
  deployments: [
    {
      partitionKey: "Deployment",
      rowKey:       "id_5",
      name:         "Deployment One",
      key:          "O25dwjupnmTCC-q70qC1CzWfO73NkSR75brivk",
      appId:        "id_2",
      packageId:    "pkg_1",
      createdTime:  "1731269070",
    },
    {
      partitionKey: "Deployment",
      rowKey:       "id_6",
      name:         "Deployment for App Two",
      key:          "deployment_key_2",
      appId:        "id_3",
      packageId:    "pkg_current_2",
      createdTime:  "1731269070",
    },
  ],
  deploymentKeyPointers: [
    {
      partitionKey: "deploymentKey O25dwjupnmTCC-q70qC1CzWfO73NkSR75brivk",
      rowKey:       "",
      appId:        "id_2",
      deploymentId: "id_5",
    },
    {
      partitionKey: "deploymentKey deployment_key_2",
      rowKey:       "",
      appId:        "id_3",
      deploymentId: "id_6",
    },
    {
      partitionKey: "accessKey mock-google-token",
      rowKey:       "",
      accountId:    "id_0",
      expires:      (Date.now() + 365 * 24 * 60 * 60 * 1000).toString(),
    },
    {
      partitionKey: "accountId id_0",
      rowKey:       "accountId* id_0",
      partitionKeyPointer: "email default@example.com",
      rowKeyPointer:       "",
    },
    {
      partitionKey: "email default@example.com",
      rowKey:       "",
      id:           "id_0",
      email:        "default@example.com",
      name:         "Default User",
    },
  ],
  packages: [
    {
      partitionKey: "Package",
      rowKey:       "pkg_1",
      appVersion:   "1.0.0",
      blobUrl:
        "https://codepush-secondary.blob.core.windows.net/storagev2/z98_ktyhgijjKQai7fIvDj6z_t6pb984637d-14f4-409d-9646-13a0665a3902",
      description:  "Minor improvements",
      isDisabled:   "false",
      isMandatory:  "false",
      label:        "v1",
      manifestBlobUrl:
        "https://codepush-secondary.blob.core.windows.net/storagev2",
      packageHash:
        "d581c94fa2c00b144f1b9a5cf786787826bdf4a9e12e4941c8d2541efc7518ed",
      releasedBy:   "user1@example.com",
      releaseMethod:"Upload",
      size:         "256994",
      uploadTime:   "1731269070",
      deploymentId: "id_5",
      rollout:      "100",
    },
    {
      partitionKey: "Package",
      rowKey:       "pkg_current_1",
      appVersion:   "1.0.0",
      blobUrl:      "https://example.com/blob_v1",
      description:  "Current version of App One",
      isDisabled:   "false",
      isMandatory:  "true",
      label:        "v2",
      manifestBlobUrl:"https://example.com/manifest_v1",
      packageHash:  "hash_1",
      releasedBy:   "user1@example.com",
      releaseMethod:"Upload",
      size:         "1024",
      uploadTime:   Date.now().toString(),
      deploymentId: "id_5",
      rollout:      "100",
    },
    {
      partitionKey: "Package",
      rowKey:       "pkg_current_2",
      appVersion:   "1.2.0",
      blobUrl:      "https://example.com/blob_v2",
      description:  "Current version of App Two",
      isDisabled:   "false",
      isMandatory:  "false",
      label:        "v2",
      manifestBlobUrl:"https://example.com/manifest_v2",
      packageHash:  "hash_2",
      releasedBy:   "user2@example.com",
      releaseMethod:"Upload",
      size:         "2048",
      uploadTime:   Date.now().toString(),
      deploymentId: "id_6",
      rollout:      "100",
    },
    {
      partitionKey: "Package",
      rowKey:       "pkg_hist_1",
      appVersion:   "1.2.3",
      blobUrl:      "https://example.com/blob_v0.9",
      description:  "Previous version of App One",
      isDisabled:   "false",
      isMandatory:  "false",
      label:        "v3",
      manifestBlobUrl:"https://example.com/manifest_v0.9",
      packageHash:  "hash_old_1",
      releasedBy:   "user1@example.com",
      releaseMethod:"Upload",
      size:         "900",
      uploadTime:   (Date.now() - 1_000_000).toString(),
      deploymentId: "id_5",
      rollout:      "100",
    },
  ],
  accessKeys: [
    {
      partitionKey: "AccessKey",
      rowKey:       "id_6",
      name:         "accessKey1",
      accountId:    "id_0",
      createdBy:    "admin",
      createdTime:  Date.now().toString(),
      friendlyName: "Default Access Key",
      expires:      "1735689600000",
      scope:        "all",
    },
    {
      partitionKey: "AccessKey",
      rowKey:       "mock_token_key",
      name:         "mock-google-token",
      accountId:    "id_0",
      createdBy:    "admin",
      createdTime:  Date.now().toString(),
      friendlyName: "Mock Google Token for Development",
      expires:      (Date.now() + 365 * 24 * 60 * 60 * 1000).toString(),
      scope:        "all",
    },
  ],
  accessKeyNameToAccountIdMap: [
    {
      partitionKey: "accessKey accessKey1",
      rowKey:       "",
      accountId:    "id_0",
      expires:      (Date.now() + 365 * 24 * 60 * 60 * 1000).toString(),
    },
    {
      partitionKey: "accessKey mock-google-token",
      rowKey:       "",
      accountId:    "id_0",
      expires:      (Date.now() + 365 * 24 * 60 * 60 * 1000).toString(),
    },
  ],
};

// ─── TABLE SEEDING ────────────────────────────────────────────────────────────

async function seedTable(tableName: string, entities: any[]): Promise<void> {
  console.log(`→ Seeding table "${tableName}" (${entities.length} rows)`);
  try {
    await tableServiceClient.deleteTable(tableName);
  } catch {}
  await tableServiceClient.createTable(tableName);
  const client = new TableClient(
    tableEndpoint,
    tableName,
    tableCred,
    { allowInsecureConnection: true }
  );
  for (const ent of entities) {
    try {
      await client.createEntity(ent);
    } catch (e: any) {
      if (e.code !== "EntityAlreadyExists") {
        console.error(`  ✗ error inserting ${ent.rowKey}:`, e);
      }
    }
  }
}

// ─── BLOB HISTORY SEEDING ─────────────────────────────────────────────────────

async function seedHistoryBlobs(): Promise<void> {
  console.log("→ Seeding blob history into container packagehistoryv1");
  const containerClient = blobServiceClient.getContainerClient("packagehistoryv1");
  await containerClient.createIfNotExists();
  const historyMap = seedData.packages.reduce<Record<string, any[]>>((map, pkg) => {
    (map[pkg.deploymentId] ||= []).push({
      appVersion:     pkg.appVersion,
      label:          pkg.label,
      packageHash:    pkg.packageHash,
      rollout:        Number(pkg.rollout),
      isMandatory:    pkg.isMandatory === "true",
      blobUrl:        pkg.blobUrl,
      manifestBlobUrl: pkg.manifestBlobUrl,
      size:           Number(pkg.size),
      description:    pkg.description,
      releasedBy:     pkg.releasedBy,
      releaseMethod:  pkg.releaseMethod,
      uploadTime:     Number(pkg.uploadTime),
    });
    return map;
  }, {});
  for (const [deploymentId, history] of Object.entries(historyMap)) {
    const content = JSON.stringify(history);
    await containerClient
      .getBlockBlobClient(deploymentId)
      .upload(content, Buffer.byteLength(content));
    console.log(`  ✓ uploaded history for "${deploymentId}"`);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function seedAll(): Promise<void> {
  console.log("Creating and seeding all tables...");
  const tables = [
    "storagev2",
    "accounts",
    "tenants",
    "apps",
    "collaborators",
    "deployments",
    "packages",
    "accessKeys",
    "accessKeyNameToAccountIdMap",
  ];
  for (const name of tables) {
    try { await tableServiceClient.createTable(name); } catch {}
  }

  await seedTable("storagev2", [
    { partitionKey: "schema", rowKey: "version", value: "2" },
    ...seedData.deploymentKeyPointers,
  ]);
  await seedTable("accounts",                         seedData.accounts);
  await seedTable("tenants",                          seedData.tenants);
  await seedTable("apps",                             seedData.apps);
  await seedTable("collaborators",                    seedData.collaborators);
  await seedTable("deployments",                      seedData.deployments);
  await seedTable("packages",                         seedData.packages);
  await seedTable("accessKeys",                       seedData.accessKeys);
  await seedTable("accessKeyNameToAccountIdMap",      seedData.accessKeyNameToAccountIdMap);

  await seedHistoryBlobs();
  console.log("✅ All tables and history blobs seeded successfully");
}

seedAll().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
