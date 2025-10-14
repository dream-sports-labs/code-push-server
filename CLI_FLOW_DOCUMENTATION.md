# CodePush CLI - Complete Flow & Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [CLI Entry Point & Flow](#cli-entry-point--flow)
4. [Command Parser](#command-parser)
5. [Command Executor](#command-executor)
6. [Management SDK](#management-sdk)
7. [Acquisition SDK](#acquisition-sdk)
8. [Key Commands](#key-commands)
9. [Authentication Flow](#authentication-flow)
10. [Release Flow](#release-flow)
11. [Data Flow Diagram](#data-flow-diagram)

---

## Overview

The CodePush CLI is a Node.js command-line application that enables developers to manage and deploy over-the-air (OTA) updates to React Native apps. It provides commands for:

- **Account Management**: Register, login, logout, access keys
- **App Management**: Create, list, rename, remove apps
- **Deployment Management**: Create deployments (Staging, Production, etc.)
- **Release Management**: Deploy updates, promote releases, rollback
- **Collaboration**: Add/remove collaborators, transfer ownership
- **Debugging**: View logs from mobile apps

**Binary Name**: `code-push-standalone`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Architecture                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐      ┌──────────────┐      ┌─────────────┐ │
│  │  cli.ts    │─────▶│ command-     │─────▶│ command-    │ │
│  │ (Entry)    │      │ parser.ts    │      │ executor.ts │ │
│  └────────────┘      └──────────────┘      └─────────────┘ │
│                                                     │        │
│                                                     ▼        │
│                           ┌──────────────────────────────┐  │
│                           │   SDK Layer                   │  │
│                           ├──────────────────────────────┤  │
│                           │ management-sdk.ts            │  │
│                           │ (REST API Client)            │  │
│                           └──────────────────────────────┘  │
│                                          │                   │
│                                          ▼                   │
│                           ┌──────────────────────────────┐  │
│                           │   CodePush Server            │  │
│                           │   (HTTP API)                 │  │
│                           └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

1. **cli.ts** - Entry point that orchestrates the flow
2. **command-parser.ts** - Parses CLI arguments using yargs
3. **command-executor.ts** - Executes commands and handles business logic
4. **management-sdk.ts** - REST API client for server communication
5. **acquisition-sdk.ts** - Client SDK for update checks (used by mobile apps)

---

## CLI Entry Point & Flow

**File**: `script/cli.ts`

```typescript
#!/usr/bin/env node

import * as parser from "./command-parser";
import * as execute from "./command-executor";
import * as chalk from "chalk";

function run() {
  // 1. Parse command-line arguments into command object
  const command = parser.createCommand();

  if (!command) {
    parser.showHelp(/*showRootDescription*/ false);
    return;
  }

  // 2. Execute the command
  execute
    .execute(command)
    .catch((error: any): void => {
      console.error(chalk.red(`[Error]  ${error.message}`));
      process.exit(1);
    })
    .done();
}

run();
```

### Flow Steps:
1. User runs command: `code-push-standalone <command> <args>`
2. `cli.ts` calls `parser.createCommand()` to parse arguments
3. Parser returns a typed command object (e.g., `IReleaseCommand`)
4. `execute.execute(command)` is called
5. Command is executed, interacting with server via SDK
6. Success/error messages are displayed

---

## Command Parser

**File**: `script/command-parser.ts`

The parser uses **yargs** to define and parse CLI commands.

### Command Structure

Commands follow this pattern:
```
code-push-standalone <category> <action> <args> [options]
```

Examples:
- `code-push-standalone login`
- `code-push-standalone app add MyApp`
- `code-push-standalone release-react MyApp ios`
- `code-push-standalone deployment ls MyApp`

### Command Categories

1. **access-key**: Manage access keys
   - `add`, `patch`, `list`, `remove`

2. **app**: Manage apps
   - `add`, `list`, `remove`, `rename`, `transfer`

3. **deployment**: Manage deployments
   - `add`, `list`, `remove`, `rename`, `history`, `clear`

4. **collaborator**: Manage collaborators
   - `add`, `list`, `remove`

5. **release**: Deploy updates
   - `release` (general), `release-react` (React Native specific)

6. **session**: Manage login sessions
   - `list`, `remove`

7. **Standalone commands**:
   - `login`, `logout`, `register`, `link`, `whoami`
   - `promote`, `rollback`, `patch`, `debug`

### Parser Flow

```typescript
// 1. Parse arguments using yargs
yargs.command("app", "View and manage your CodePush apps", (yargs) => {
  yargs.command("add", "Add a new app", (yargs) => {
    // Define options, examples, validation
  })
})

// 2. Extract parsed values
const argv = yargs.parseSync();

// 3. Build command object
export function createCommand(): cli.ICommand {
  const arg0 = argv._[0];  // e.g., "app"
  const arg1 = argv._[1];  // e.g., "add"
  const arg2 = argv._[2];  // e.g., "MyApp"

  switch (arg0) {
    case "app":
      switch (arg1) {
        case "add":
          return {
            type: cli.CommandType.appAdd,
            appName: arg2
          };
      }
  }
}
```

### Key Features:
- **Type Safety**: Each command has a TypeScript interface
- **Validation**: Validates required arguments and options
- **Help System**: Auto-generates help text with examples
- **Aliases**: Support for short commands (e.g., `ls` = `list`)

---

## Command Executor

**File**: `script/command-executor.ts`

The executor handles authentication, SDK initialization, and command routing.

### Execution Flow

```typescript
export function execute(command: cli.ICommand) {
  // 1. Load saved connection info (access key)
  connectionInfo = deserializeConnectionInfo();

  // 2. Authentication check
  return Q(<void>null).then(() => {
    switch (command.type) {
      // Must not be logged in
      case cli.CommandType.login:
      case cli.CommandType.register:
        if (connectionInfo) {
          throw new Error("Already logged in");
        }
        break;

      // Must be logged in
      default:
        if (!connectionInfo) {
          throw new Error("Not logged in. Run 'code-push-standalone login'");
        }
        // Initialize SDK with access key
        sdk = getSdk(connectionInfo.accessKey, CLI_HEADERS, connectionInfo.customServerUrl);
        break;
    }

    // 3. Route to appropriate handler
    switch (command.type) {
      case cli.CommandType.release:
        return release(<cli.IReleaseCommand>command);
      case cli.CommandType.appList:
        return appList(<cli.IAppListCommand>command);
      // ... other commands
    }
  });
}
```

### Authentication State

Connection info is stored in: `~/.code-push.config`

```json
{
  "accessKey": "your-access-key-here",
  "preserveAccessKeyOnLogout": false,
  "customServerUrl": "http://localhost:3000"
}
```

### Command Handlers

Each command has a dedicated handler function:

```typescript
function appAdd(command: cli.IAppAddCommand): Promise<void> {
  return sdk.addApp(command.appName).then((app: App) => {
    log(`Successfully added "${command.appName}" app`);
    // Show deployments (Staging, Production)
    return deploymentList({ ... });
  });
}

function release(command: cli.IReleaseCommand): Promise<void> {
  // Validate package path
  // Create zip if directory
  // Upload to server
  // Show progress bar
  return sdk.release(...).then(() => {
    log(`Successfully released update`);
  });
}
```

---

## Management SDK

**File**: `script/management-sdk.ts`

The SDK is a REST API client that communicates with the CodePush server.

### SDK Architecture

```typescript
class AccountManager {
  private _accessKey: string;
  private _serverUrl: string;
  private _customHeaders: Headers;
  public passedOrgName: string;  // For multi-tenant support

  constructor(accessKey: string, customHeaders?: Headers, serverUrl?: string) {
    this._accessKey = accessKey;
    this._serverUrl = serverUrl || "http://localhost:3000";
    this._customHeaders = customHeaders;
  }

  // HTTP Methods
  private get(endpoint: string): Promise<JsonResponse>
  private post(endpoint: string, body: string): Promise<JsonResponse>
  private patch(endpoint: string, body: string): Promise<JsonResponse>
  private del(endpoint: string): Promise<JsonResponse>

  // Authentication
  public isAuthenticated(): Promise<boolean>

  // Access Keys
  public addAccessKey(name: string, ttl?: number): Promise<AccessKey>
  public getAccessKeys(): Promise<AccessKey[]>

  // Apps
  public getApps(): Promise<App[]>
  public addApp(appName: string): Promise<App>
  public removeApp(appName: string): Promise<void>

  // Deployments
  public getDeployments(appName: string): Promise<Deployment[]>
  public addDeployment(appName: string, name: string): Promise<Deployment>

  // Releases
  public release(appName: string, deployment: string, filePath: string, ...): Promise<void>
  public promote(appName: string, source: string, dest: string, ...): Promise<void>
  public rollback(appName: string, deployment: string): Promise<void>

  // Collaborators
  public getCollaborators(appName: string): Promise<CollaboratorMap>
  public addCollaborator(appName: string, email: string): Promise<void>
}
```

### Request Flow

```typescript
private makeApiRequest(method: string, endpoint: string, requestBody: string): Promise<JsonResponse> {
  return Promise((resolve, reject) => {
    let request = superagent[method](this._serverUrl + endpoint);
    
    // Attach credentials
    this.attachCredentials(request);
    
    if (requestBody) {
      request = request.set("Content-Type", "application/json").send(requestBody);
    }

    request.end((err, res) => {
      if (err) {
        reject(this.getCodePushError(err, res));
        return;
      }
      
      resolve({ headers: res.header, body: JSON.parse(res.text) });
    });
  });
}

private attachCredentials(request: superagent.Request<any>): void {
  // Add custom headers (e.g., CLI version)
  for (const headerName in this._customHeaders) {
    request.set(headerName, this._customHeaders[headerName]);
  }
  
  // Add organization/tenant header if specified
  if (this.passedOrgName) {
    let tenantId = this.getTenantId(this.passedOrgName);
    request.set("tenant", tenantId);
  }
  
  // Add authentication
  let bearerToken = "cli-" + this._accessKey;
  request.set("Authorization", `Bearer ${bearerToken}`);
  request.set("Accept", "application/vnd.code-push.v2+json");
}
```

### Multi-Tenant Support

The SDK supports organization-scoped operations:

```bash
# App name format: OrgName/AppName
code-push-standalone app add MyOrg/MyApp
code-push-standalone deployment ls MyOrg/MyApp
```

The parser extracts the organization name:

```typescript
export function parseAppName(appName: string): { ownerName: string | null, appName: string } {
  const [ownerName, app] = appName.includes('/')
    ? appName.split('/')
    : [null, appName];
  return { ownerName, appName: app };
}
```

---

## Acquisition SDK

**File**: `script/acquisition-sdk.ts`

This SDK is used by **mobile apps** (not the CLI) to check for updates.

### Update Check Flow

```typescript
class AcquisitionManager {
  queryUpdateWithCurrentPackage(
    currentPackage: Package,
    callback: Callback<RemotePackage>
  ): void {
    // Build update request
    const updateRequest: UpdateCheckRequest = {
      deploymentKey: this._deploymentKey,
      appVersion: currentPackage.appVersion,
      packageHash: currentPackage.packageHash,
      clientUniqueId: this._clientUniqueId,
    };

    // Make HTTP request
    const url = this._serverUrl + "updateCheck?" + queryStringify(updateRequest);
    
    this._httpRequester.request(Http.Verb.GET, url, (error, response) => {
      if (error) {
        callback(error, null);
        return;
      }

      const updateInfo = JSON.parse(response.body).updateInfo;

      if (updateInfo.isAvailable) {
        callback(null, {
          downloadUrl: updateInfo.downloadURL,
          packageHash: updateInfo.packageHash,
          ...
        });
      } else {
        callback(null, null);  // No update available
      }
    });
  }

  reportStatusDeploy(deployedPackage: Package, status: string): void {
    // Report deployment success/failure
  }

  reportStatusDownload(downloadedPackage: Package): void {
    // Report download completion
  }
}
```

---

## Key Commands

### 1. Login

```bash
code-push-standalone login
```

**Flow**:
1. Opens browser to `http://localhost:3000/auth/login?hostname=<machine>`
2. User authenticates via GitHub/Microsoft
3. Server generates access key
4. User copies access key and pastes into CLI
5. CLI validates key with `GET /authenticated`
6. Saves key to `~/.code-push.config`

**Code**:
```typescript
function login(command: cli.ILoginCommand): Promise<void> {
  if (command.accessKey) {
    // Direct access key login
    sdk = getSdk(command.accessKey, CLI_HEADERS, command.serverUrl);
    return sdk.isAuthenticated().then((isAuth) => {
      if (isAuth) {
        serializeConnectionInfo(command.accessKey, true, command.serverUrl);
      } else {
        throw new Error("Invalid access key");
      }
    });
  } else {
    // Browser-based login
    return loginWithExternalAuthentication("login", command.serverUrl);
  }
}
```

---

### 2. App Add

```bash
code-push-standalone app add MyOrg/MyApp
```

**Flow**:
1. Parser extracts `ownerName` and `appName`
2. SDK sets `passedOrgName` for tenant header
3. `POST /apps/` with app name and org info
4. Server creates app with 2 default deployments (Staging, Production)
5. CLI displays deployments with keys

**Code**:
```typescript
function appAdd(command: cli.IAppAddCommand): Promise<void> {
  return sdk.addApp(command.appName).then((app: App) => {
    log(`Successfully added "${command.appName}" app`);
    // Show deployment keys
    return deploymentList({
      type: cli.CommandType.deploymentList,
      appName: app.name,
      format: "table",
      displayKeys: true,
    });
  });
}
```

**SDK Method**:
```typescript
public addApp(appName: string): Promise<App> {
  const app: any = { name: appName };
  
  // Add organization info if specified
  let tenantId = this.getTenantId(this.passedOrgName);
  if (tenantId) {
    app.organisation = { orgId: tenantId };
  } else if (this.passedOrgName) {
    app.organisation = { orgName: this.passedOrgName };
  }
  
  return this.post("/apps/", JSON.stringify(app));
}
```

---

### 3. Release (General)

```bash
code-push-standalone release MyOrg/MyApp ./build 1.0.0 -d Production
```

**Flow**:
1. Validates `./build` path exists
2. If directory, creates ZIP file temporarily
3. Reads file as stream
4. `POST /apps/MyApp/deployments/Production/release`
5. Uploads file with multipart/form-data
6. Shows progress bar
7. Deletes temp ZIP if created

**Code**:
```typescript
function release(command: cli.IReleaseCommand): Promise<void> {
  // Validate
  throwForInvalidSemverRange(command.appStoreVersion);
  
  const updateMetadata: PackageInfo = {
    description: command.description,
    isDisabled: command.disabled,
    isMandatory: command.mandatory,
    rollout: command.rollout,
  };

  // Show progress bar
  const progressBar = new progress("Upload progress:[:bar] :percent :etas", {
    complete: "=",
    incomplete: " ",
    width: 50,
    total: 100,
  });

  return sdk.release(
    command.appName,
    command.deploymentName,
    command.package,
    command.appStoreVersion,
    updateMetadata,
    (progress) => progressBar.tick(progress)
  ).then(() => {
    log(`Successfully released update to "${command.deploymentName}"`);
  });
}
```

**SDK Release Method**:
```typescript
public release(
  appName: string,
  deploymentName: string,
  filePath: string,
  targetBinaryVersion: string,
  updateMetadata: PackageInfo,
  uploadProgressCallback?: (progress: number) => void
): Promise<void> {
  return Promise((resolve, reject) => {
    updateMetadata.appVersion = targetBinaryVersion;
    
    const request = superagent.post(
      this._serverUrl + `/apps/${appName}/deployments/${deploymentName}/release`
    );

    this.attachCredentials(request);

    // Package file (create ZIP if directory)
    this.packageFileFromPath(filePath).then((packageFile) => {
      const file = fs.createReadStream(packageFile.path);
      
      request
        .attach("package", file)
        .field("packageInfo", JSON.stringify(updateMetadata))
        .on("progress", (event) => {
          if (uploadProgressCallback && event.total > 0) {
            const progress = (event.loaded / event.total) * 100;
            uploadProgressCallback(progress);
          }
        })
        .end((err, res) => {
          if (packageFile.isTemporary) {
            fs.unlinkSync(packageFile.path);
          }
          
          if (err) {
            reject(this.getCodePushError(err, res));
          } else {
            resolve();
          }
        });
    });
  });
}
```

---

### 4. Release React Native

```bash
code-push-standalone release-react MyOrg/MyApp ios -d Production
```

**Flow**:
1. Validates React Native project (checks `package.json`)
2. Determines entry file (`index.ios.js` or `index.js`)
3. Auto-detects app version from `Info.plist` (iOS) or `build.gradle` (Android)
4. Creates output folder in `/tmp/CodePush`
5. Runs `react-native bundle` command
6. Checks if Hermes is enabled (from `Podfile` or `build.gradle`)
7. If Hermes: compiles JS bundle to bytecode
8. If private key provided: signs the bundle
9. Calls general `release()` command
10. Cleans up temp folder

**Code**:
```typescript
function releaseReact(command: cli.IReleaseReactCommand): Promise<void> {
  const outputFolder = command.outputDir || path.join(os.tmpdir(), "CodePush");
  const platform = command.platform.toLowerCase();
  const bundleName = command.bundleName || (platform === "ios" ? "main.jsbundle" : `index.${platform}.bundle`);

  return sdk.getDeployment(command.appName, command.deploymentName)
    .then(() => {
      // Get project name from package.json
      const projectPackageJson = require(path.join(process.cwd(), "package.json"));
      const projectName = projectPackageJson.name;

      // Determine entry file
      let entryFile = command.entryFile || `index.${platform}.js`;
      if (!fs.existsSync(entryFile)) {
        entryFile = "index.js";
      }

      // Get app version
      return command.appStoreVersion
        ? Q(command.appStoreVersion)
        : getReactNativeProjectAppVersion(command, projectName);
    })
    .then((appVersion: string) => {
      throwForInvalidSemverRange(appVersion);
      
      // Create temp folder
      return createEmptyTempReleaseFolder(outputFolder)
        .then(() => deleteFolder(`${os.tmpdir()}/react-*`))  // Clear RN cache
        .then(() => runReactNativeBundleCommand(bundleName, command.development, entryFile, outputFolder, platform, command.sourcemapOutput));
    })
    .then(async () => {
      // Check Hermes
      const isHermesEnabled = command.useHermes ||
        (platform === "android" && await getAndroidHermesEnabled(command.gradleFile)) ||
        (platform === "ios" && await getiOSHermesEnabled(command.podFile));

      if (isHermesEnabled) {
        log("Running hermes compiler...");
        await runHermesEmitBinaryCommand(bundleName, outputFolder, command.sourcemapOutput, command.extraHermesFlags, command.gradleFile);
      }
    })
    .then(async () => {
      // Code signing
      if (command.privateKeyPath) {
        log("Signing the bundle...");
        await sign(command.privateKeyPath, outputFolder);
      }
    })
    .then(() => {
      // Release
      log("Releasing update contents to CodePush:");
      const releaseCommand: cli.IReleaseCommand = {
        ...command,
        package: outputFolder
      };
      return release(releaseCommand);
    })
    .then(() => {
      if (!command.outputDir) {
        deleteFolder(outputFolder);
      }
    });
}
```

**React Native Bundle Command**:
```typescript
function runReactNativeBundleCommand(
  bundleName: string,
  development: boolean,
  entryFile: string,
  outputFolder: string,
  platform: string,
  sourcemapOutput: string
): Promise<void> {
  const args = [
    path.join("node_modules", "react-native", "cli.js"),
    "bundle",
    "--assets-dest", outputFolder,
    "--bundle-output", path.join(outputFolder, bundleName),
    "--dev", development,
    "--entry-file", entryFile,
    "--platform", platform,
  ];

  if (sourcemapOutput) {
    args.push("--sourcemap-output", sourcemapOutput);
  }

  log(`Running: node ${args.join(" ")}`);

  const reactNativeBundleProcess = spawn("node", args);

  return Promise((resolve, reject) => {
    reactNativeBundleProcess.stdout.on("data", (data) => log(data.toString()));
    reactNativeBundleProcess.stderr.on("data", (data) => console.error(data.toString()));
    
    reactNativeBundleProcess.on("close", (exitCode) => {
      if (exitCode) {
        reject(new Error(`react-native bundle exited with code ${exitCode}`));
      } else {
        resolve();
      }
    });
  });
}
```

---

### 5. Promote

```bash
code-push-standalone promote MyOrg/MyApp Staging Production --des "Promoted to production"
```

**Flow**:
1. Gets latest release from source deployment (Staging)
2. Creates new release in destination deployment (Production)
3. Copies exact code and metadata
4. Can override: description, mandatory, disabled, rollout, targetBinaryVersion

**Code**:
```typescript
function promote(command: cli.IPromoteCommand): Promise<void> {
  const packageInfo: PackageInfo = {
    appVersion: command.appStoreVersion,
    description: command.description,
    label: command.label,
    isDisabled: command.disabled,
    isMandatory: command.mandatory,
    rollout: command.rollout,
  };

  return sdk.promote(
    command.appName,
    command.sourceDeploymentName,
    command.destDeploymentName,
    packageInfo
  ).then(() => {
    log(`Successfully promoted from "${command.sourceDeploymentName}" to "${command.destDeploymentName}"`);
  });
}
```

---

### 6. Rollback

```bash
code-push-standalone rollback MyOrg/MyApp Production --targetRelease v34
```

**Flow**:
1. Gets deployment history
2. Finds target release (default: previous release)
3. Creates new release with exact code/metadata from target
4. Users running latest version will roll back to target

**Code**:
```typescript
function rollback(command: cli.IRollbackCommand): Promise<void> {
  return confirm("Are you sure?").then((wasConfirmed) => {
    if (!wasConfirmed) {
      log("Rollback cancelled");
      return;
    }

    return sdk.rollback(
      command.appName,
      command.deploymentName,
      command.targetRelease
    ).then(() => {
      log(`Successfully rolled back "${command.deploymentName}"`);
    });
  });
}
```

---

## Authentication Flow

### 1. Register

```
User                    CLI                    Browser                Server
  │                      │                        │                      │
  │─register────────────▶│                        │                      │
  │                      │─open browser──────────▶│                      │
  │                      │                        │─GET /auth/register──▶│
  │◀─prompt for key─────│                        │                      │
  │                      │                        │◀─auth page──────────│
  │                      │                        │                      │
  │                      │                        │─GitHub/MS OAuth─────▶│
  │                      │                        │◀─callback───────────│
  │                      │                        │                      │
  │                      │                        │◀─access key page────│
  │                      │                        │                      │
  │─paste key───────────▶│                        │                      │
  │                      │─POST /authenticated────────────────────────▶│
  │                      │◀─200 OK─────────────────────────────────────│
  │                      │─save to ~/.code-push.config                  │
  │◀─success────────────│                        │                      │
```

### 2. Login

Similar flow to register, but uses `/auth/login` endpoint.

### 3. Access Key Login

```bash
code-push-standalone login --accessKey mykey
```

Bypasses browser, directly validates key.

---

## Release Flow

### Complete Release Flow (React Native)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  1. User runs: code-push-standalone release-react MyApp ios     │
│                                                                  │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Command Parser                                               │
│  ────────────────                                                │
│  • Parses arguments                                              │
│  • Creates IReleaseReactCommand object                           │
│  • Extracts: appName, platform, deploymentName, etc.             │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Command Executor - releaseReact()                            │
│  ──────────────────────────────────                              │
│  • Check authentication                                          │
│  • Validate deployment exists                                    │
│  • Validate React Native project                                │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Detect App Version                                           │
│  ────────────────────                                            │
│  iOS: Read Info.plist → CFBundleShortVersionString               │
│  Android: Parse build.gradle → android.defaultConfig.versionName │
│  • Validate semver format                                        │
│  • Output: "Using version 1.0.0 from Info.plist"                │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Bundle React Native App                                      │
│  ─────────────────────────                                       │
│  • Create temp folder: /tmp/CodePush/                            │
│  • Clear RN bundler cache                                        │
│  • Run: node node_modules/react-native/cli.js bundle            │
│      --platform ios                                              │
│      --entry-file index.js                                       │
│      --bundle-output /tmp/CodePush/main.jsbundle                 │
│      --assets-dest /tmp/CodePush                                 │
│      --dev false                                                 │
│  • Output: main.jsbundle + assets                                │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Hermes Compilation (if enabled)                              │
│  ─────────────────────────────────                               │
│  • Check Podfile (iOS) or build.gradle (Android) for Hermes     │
│  • If enabled:                                                   │
│      - Run: hermes -emit-binary -out main.jsbundle.hbc ...      │
│      - Replace .jsbundle with .jsbundle.hbc                      │
│  • Output: Bytecode bundle                                       │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Code Signing (if private key provided)                       │
│  ───────────────────────────────────────                         │
│  • Read private key from --privateKeyPath                        │
│  • Sign bundle files                                             │
│  • Create .codepushrelease with signatures                       │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. Upload to Server                                             │
│  ──────────────────                                              │
│  • Create ZIP from /tmp/CodePush/ folder                         │
│  • POST /apps/MyApp/deployments/Staging/release                  │
│  • Headers:                                                      │
│      Authorization: Bearer cli-<accessKey>                       │
│      tenant: <orgId> (if multi-tenant)                           │
│  • Body (multipart/form-data):                                   │
│      - package: <zip-file-stream>                                │
│      - packageInfo: {                                            │
│          appVersion: "1.0.0",                                    │
│          description: "...",                                     │
│          isMandatory: false,                                     │
│          rollout: 100                                            │
│        }                                                         │
│  • Show progress bar during upload                               │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  9. Server Processing                                            │
│  ───────────────────                                             │
│  • Extracts ZIP                                                  │
│  • Calculates package hash                                       │
│  • Stores files in blob storage                                  │
│  • Creates Package record in database:                           │
│      - label: v1 (auto-incremented)                              │
│      - appVersion: 1.0.0                                         │
│      - packageHash: abc123...                                    │
│      - uploadTime: <timestamp>                                   │
│      - releasedBy: user@email.com                                │
│  • Returns: 200 OK                                               │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  10. CLI Success                                                 │
│  ──────────────                                                  │
│  • Delete temp folder                                            │
│  • Output: "Successfully released update to Staging deployment" │
│  • Exit                                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### CLI to Server Communication

```
┌──────────────┐
│   CLI User   │
└──────┬───────┘
       │
       │ Commands
       ▼
┌──────────────────────────────────────────────────────┐
│              Command Executor                         │
│                                                       │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ App Mgmt   │  │ Deployment   │  │  Release    │  │
│  │ Commands   │  │ Commands     │  │  Commands   │  │
│  └────────────┘  └──────────────┘  └─────────────┘  │
└───────────────────────┬───────────────────────────────┘
                        │
                        │ HTTP Requests
                        ▼
┌──────────────────────────────────────────────────────┐
│           Management SDK (AccountManager)            │
│                                                       │
│  HTTP Methods:                                       │
│  • GET    /apps, /deployments, /accessKeys           │
│  • POST   /apps, /release, /promote                  │
│  • PATCH  /apps, /deployments                        │
│  • DELETE /apps, /deployments                        │
│                                                       │
│  Authentication:                                     │
│  • Header: Authorization: Bearer cli-<accessKey>     │
│  • Header: tenant: <orgId>                           │
└───────────────────────┬───────────────────────────────┘
                        │
                        │ REST API
                        ▼
┌──────────────────────────────────────────────────────┐
│              CodePush Server (Express)               │
│                                                       │
│  Routes:                                             │
│  • /auth/* - Authentication                          │
│  • /apps/* - App management                          │
│  • /deployments/* - Deployment management            │
│  • /accessKeys/* - Access key management             │
│  • /updateCheck - Mobile client update checks        │
│                                                       │
│  Storage:                                            │
│  • Database - Metadata (apps, deployments, packages) │
│  • Blob Storage - Package files (ZIP bundles)        │
└───────────────────────┬───────────────────────────────┘
                        │
                        │ Response
                        ▼
┌──────────────────────────────────────────────────────┐
│              CLI Output/Display                       │
│                                                       │
│  • Tables (using cli-table)                          │
│  • JSON (using --format json)                        │
│  • Progress bars (using progress)                    │
│  • Colors (using chalk)                              │
└──────────────────────────────────────────────────────┘
```

---

## Mobile App Update Flow

```
┌──────────────────┐
│  Mobile App      │
│  (React Native)  │
└────────┬─────────┘
         │
         │ codePush.sync()
         ▼
┌─────────────────────────────────────────────┐
│  CodePush React Native SDK                  │
│  • Gets current package info                │
│  • Gets deployment key from config          │
└────────┬────────────────────────────────────┘
         │
         │ queryUpdate()
         ▼
┌─────────────────────────────────────────────┐
│  Acquisition SDK                            │
│  • Build update request:                    │
│    - deploymentKey                          │
│    - appVersion                             │
│    - packageHash (current)                  │
│    - clientUniqueId                         │
└────────┬────────────────────────────────────┘
         │
         │ GET /updateCheck?...
         ▼
┌─────────────────────────────────────────────┐
│  CodePush Server                            │
│  • Lookup deployment by key                 │
│  • Get latest package for deployment        │
│  • Check eligibility:                       │
│    - appVersion matches targetBinaryVersion │
│    - packageHash != current hash            │
│    - rollout % (if specified)               │
│  • Return update info or null               │
└────────┬────────────────────────────────────┘
         │
         │ Response: { updateInfo: {...} }
         ▼
┌─────────────────────────────────────────────┐
│  CodePush React Native SDK                  │
│  • If update available:                     │
│    - Download package from downloadURL      │
│    - Extract to local storage               │
│    - Apply update (restart or next resume)  │
│  • Report status:                           │
│    - POST /reportStatus/download            │
│    - POST /reportStatus/deploy              │
└─────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. **Deployment Keys**
- Each deployment (Staging, Production) has a unique key
- Mobile apps configure which deployment to receive updates from
- Keys are used for authentication when checking updates

### 2. **Package Versioning**
- Each release gets an auto-incremented label: v1, v2, v3, ...
- `targetBinaryVersion` specifies which app store versions are eligible
- Supports semver ranges: `1.0.0`, `^1.2.0`, `*`

### 3. **Mandatory Updates**
- CLI flag: `--mandatory` or `-m`
- Mobile SDK can enforce mandatory updates (block app until installed)
- Server automatically converts optional→mandatory if intermediate mandatory release

### 4. **Rollout**
- Phased rollout: `--rollout 25` (25% of users)
- Based on stable hash of deployment key + client ID
- Can increase rollout: `patch --rollout 50%`
- Cannot decrease or create new release until completed (100%)

### 5. **Multi-Tenant Support**
- Organizations can isolate apps
- Format: `OrgName/AppName`
- SDK sends `tenant` header with org ID
- Server filters apps/deployments by tenant

---

## Configuration Files

### 1. `~/.code-push.config`
```json
{
  "accessKey": "abc123...",
  "preserveAccessKeyOnLogout": false,
  "customServerUrl": "http://localhost:3000"
}
```

### 2. `package.json` (React Native project)
```json
{
  "name": "MyApp",
  "dependencies": {
    "react-native": "^0.72.0",
    "react-native-code-push": "^8.0.0"
  }
}
```

### 3. `Info.plist` (iOS)
```xml
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>

<key>CodePushDeploymentKey</key>
<string>YOUR-DEPLOYMENT-KEY</string>

<key>CodePushPublicKey</key>
<string>-----BEGIN PUBLIC KEY-----...</string>
```

### 4. `build.gradle` (Android)
```groovy
android {
    defaultConfig {
        versionName "1.0.0"
    }
}
```

---

## Error Handling

### Common Errors

1. **Not authenticated**
   ```
   Error: You are not currently logged in. 
   Run 'code-push-standalone login' to authenticate.
   ```

2. **Invalid app name**
   ```
   Error: 404: The specified app "MyApp" does not exist.
   ```

3. **Invalid semver**
   ```
   Error: Please use a semver-compliant target binary version range,
   for example "1.0.0", "*" or "^1.2.3".
   ```

4. **Active rollout**
   ```
   Error: Cannot release new update while active rollout in progress.
   Complete rollout first with: patch --rollout 100
   ```

---

## Best Practices

### 1. **Development Workflow**
```bash
# 1. Create apps for each platform
code-push-standalone app add MyApp-iOS
code-push-standalone app add MyApp-Android

# 2. Release to Staging
code-push-standalone release-react MyApp-iOS ios -d Staging
code-push-standalone release-react MyApp-Android android -d Staging

# 3. Test on Staging

# 4. Promote to Production
code-push-standalone promote MyApp-iOS Staging Production
code-push-standalone promote MyApp-Android Staging Production
```

### 2. **Phased Rollouts**
```bash
# Release to 10% of users
code-push-standalone release-react MyApp ios -d Production -r 10

# Monitor for issues

# Increase to 50%
code-push-standalone patch MyApp Production --rollout 50

# Complete rollout
code-push-standalone patch MyApp Production --rollout 100
```

### 3. **Emergency Rollback**
```bash
# Rollback to previous version
code-push-standalone rollback MyApp Production

# Or rollback to specific version
code-push-standalone rollback MyApp Production --targetRelease v34
```

---

## Summary

The CodePush CLI is a well-architected command-line tool that:

1. **Parses** commands using yargs
2. **Authenticates** via access keys stored locally
3. **Executes** commands by calling SDK methods
4. **Communicates** with server via REST API
5. **Manages** the entire OTA update lifecycle

Key features:
- Type-safe command handling
- Progress indicators for uploads
- Multi-tenant organization support
- React Native integration with auto-detection
- Hermes bytecode compilation
- Code signing for security
- Phased rollouts for safe deployments

The CLI seamlessly integrates with the CodePush server to provide developers with a powerful tool for deploying updates without app store approval.

---

## Additional Resources

- **README**: Comprehensive command documentation
- **API Routes**: See `/api/script/routes/management.ts`
- **Mobile SDK**: React Native CodePush plugin
- **Server**: Express.js REST API

---

*This documentation was generated to explain the complete internal flow and architecture of the CodePush CLI.*

