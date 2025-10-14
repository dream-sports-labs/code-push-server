# CodePush CLI - Quick Reference Guide

## CLI Flow Summary

### Basic Command Flow

```
User Command → Parser → Executor → SDK → Server → Response
     ↓           ↓          ↓        ↓       ↓        ↓
  cli.ts    command-   command-  management  HTTP    Display
            parser.ts  executor   -sdk.ts    API     Result
```

## File Structure

```
cli/
├── script/
│   ├── cli.ts                    # Entry point
│   ├── command-parser.ts         # Parse CLI args (yargs)
│   ├── command-executor.ts       # Execute commands
│   ├── management-sdk.ts         # REST API client
│   ├── acquisition-sdk.ts        # Mobile update client
│   ├── sign.ts                   # Code signing
│   ├── react-native-utils.ts    # RN helpers (Hermes, version)
│   │
│   ├── commands/
│   │   └── debug.ts              # Debug command
│   │
│   ├── types/
│   │   ├── cli.ts                # Command interfaces
│   │   ├── rest-definitions.ts   # API types
│   │   └── index.ts              # Common types
│   │
│   └── utils/
│       └── file-utils.ts         # File helpers
│
├── test/                          # Unit tests
├── package.json
└── tsconfig.json
```

## Command Categories

### 1. Authentication
```bash
code-push-standalone register              # Create account
code-push-standalone login                 # Login
code-push-standalone login --accessKey KEY # Login with key
code-push-standalone logout                # Logout
code-push-standalone whoami                # Show account info
code-push-standalone link                  # Link another identity
```

### 2. App Management
```bash
code-push-standalone app add MyOrg/MyApp   # Create app
code-push-standalone app ls                # List apps
code-push-standalone app ls --org MyOrg    # List org apps
code-push-standalone app rm MyOrg/MyApp    # Remove app
code-push-standalone app rename Old New    # Rename app
code-push-standalone app transfer MyApp email@example.com  # Transfer ownership
```

### 3. Deployment Management
```bash
code-push-standalone deployment add MyApp Beta           # Add deployment
code-push-standalone deployment ls MyApp -k              # List with keys
code-push-standalone deployment rename MyApp Old New     # Rename
code-push-standalone deployment rm MyApp Beta            # Remove
code-push-standalone deployment history MyApp Staging    # View history
code-push-standalone deployment clear MyApp Staging      # Clear history
```

### 4. Releases
```bash
# General release
code-push-standalone release MyApp ./build 1.0.0 -d Production

# React Native
code-push-standalone release-react MyApp ios -d Production
code-push-standalone release-react MyApp android -d Staging --dev

# With options
code-push-standalone release-react MyApp ios \
  -d Production \
  --mandatory \
  --rollout 25 \
  --des "Bug fixes" \
  --privateKeyPath ./private.pem
```

### 5. Update Management
```bash
# Promote
code-push-standalone promote MyApp Staging Production
code-push-standalone promote MyApp Staging Production -r 25

# Rollback
code-push-standalone rollback MyApp Production
code-push-standalone rollback MyApp Production --targetRelease v34

# Patch
code-push-standalone patch MyApp Production -m           # Make mandatory
code-push-standalone patch MyApp Production -r 50        # Increase rollout
code-push-standalone patch MyApp Production -x true      # Disable
code-push-standalone patch MyApp Production -l v5 --des "Updated"
```

### 6. Collaboration
```bash
code-push-standalone collaborator add MyApp user@example.com
code-push-standalone collaborator ls MyApp
code-push-standalone collaborator rm MyApp user@example.com
```

### 7. Access Keys
```bash
code-push-standalone access-key add "CI Server"
code-push-standalone access-key add "CI Server" --ttl 90d
code-push-standalone access-key ls
code-push-standalone access-key patch "CI Server" --name "Build Server"
code-push-standalone access-key rm "CI Server"
```

### 8. Sessions
```bash
code-push-standalone session ls
code-push-standalone session rm "MachineName"
```

### 9. Organizations
```bash
code-push-standalone org ls              # List organizations
```

### 10. Debug
```bash
code-push-standalone debug ios           # iOS simulator logs
code-push-standalone debug android       # Android logs
```

## Key Options

### Common Flags
- `-d, --deploymentName` - Deployment name (default: Staging)
- `-t, --targetBinaryVersion` - App version (e.g., 1.0.0, ^1.2.0)
- `-m, --mandatory` - Mandatory update
- `-x, --disabled` - Disable release
- `-r, --rollout` - Rollout percentage (1-100)
- `--des, --description` - Release description
- `-k, --displayKeys` - Show deployment keys
- `--format json|table` - Output format

### Release-React Specific
- `-b, --bundleName` - Bundle file name
- `-e, --entryFile` - Entry file (default: index.{platform}.js)
- `-s, --sourcemapOutput` - Sourcemap output path
- `-o, --outputDir` - Output directory
- `--dev, --development` - Development build
- `-h, --useHermes` - Force Hermes compilation
- `-p, --plistFile` - iOS plist file path
- `-g, --gradleFile` - Android gradle file path
- `-k, --privateKeyPath` - Private key for signing

## Important Concepts

### 1. App Naming Convention
```
Format: [OrgName/]AppName

Examples:
- MyApp              # Personal app
- MyOrg/MyApp        # Organization app
- acme-corp/mobile   # Organization app
```

### 2. Deployment Keys
- Each deployment has a unique key
- Mobile apps use keys to fetch updates
- Keys shown with: `deployment ls MyApp -k`

### 3. Version Targeting
```bash
# Exact version
code-push-standalone release MyApp ./build "1.0.0"

# Semver range
code-push-standalone release MyApp ./build "^1.2.0"  # 1.2.x, 1.3.x, ...
code-push-standalone release MyApp ./build "~1.2.0"  # 1.2.x only
code-push-standalone release MyApp ./build "*"       # All versions
```

### 4. Rollout Stages
```bash
# Initial 10% rollout
code-push-standalone release-react MyApp ios -r 10

# Increase to 25%
code-push-standalone patch MyApp Staging -r 25

# Increase to 50%
code-push-standalone patch MyApp Staging -r 50

# Complete (100%)
code-push-standalone patch MyApp Staging -r 100
```

### 5. Mandatory Updates
- `--mandatory` flag marks update as mandatory
- Mobile app can enforce (block usage until installed)
- Inherited during promote: Staging (mandatory) → Production (mandatory)

## Internal Flow

### 1. Authentication Flow
```
1. User runs: code-push-standalone login
2. CLI opens browser to: http://localhost:3000/auth/login
3. User authenticates with GitHub/Microsoft
4. Server generates access key
5. User copies and pastes key into CLI
6. CLI validates key: GET /authenticated
7. CLI saves to: ~/.code-push.config
```

### 2. Release-React Flow
```
1. Parse command arguments
2. Validate React Native project
3. Detect app version (Info.plist/build.gradle)
4. Create temp folder: /tmp/CodePush
5. Run: react-native bundle
   - Entry: index.ios.js or index.js
   - Output: main.jsbundle + assets
6. Check Hermes enabled (Podfile/build.gradle)
   - If yes: Compile to bytecode
7. Code signing (if --privateKeyPath)
8. Create ZIP of output folder
9. POST /apps/MyApp/deployments/Staging/release
   - Upload ZIP (multipart/form-data)
   - Send metadata (version, description, etc.)
10. Server stores package and returns success
11. CLI displays success message
```

### 3. Update Check Flow (Mobile App)
```
1. Mobile app calls: codePush.sync()
2. SDK queries: GET /updateCheck?deploymentKey=X&appVersion=1.0.0&packageHash=abc
3. Server checks:
   - Deployment exists?
   - App version matches target?
   - Package hash different?
   - Rollout eligible?
4. Server returns:
   - Update available: { downloadURL, packageHash, ... }
   - No update: { isAvailable: false }
5. SDK downloads and installs update
6. SDK reports: POST /reportStatus/deploy
```

## SDK Methods (Internal)

### AccountManager (management-sdk.ts)
```typescript
// Apps
sdk.getApps(): Promise<App[]>
sdk.addApp(appName: string): Promise<App>
sdk.removeApp(appName: string): Promise<void>

// Deployments
sdk.getDeployments(appName: string): Promise<Deployment[]>
sdk.addDeployment(appName: string, name: string): Promise<Deployment>

// Releases
sdk.release(appName, deployment, filePath, version, metadata): Promise<void>
sdk.promote(appName, sourceDeployment, destDeployment, metadata): Promise<void>
sdk.rollback(appName, deployment, targetRelease?): Promise<void>
sdk.patchRelease(appName, deployment, label, metadata): Promise<void>

// History
sdk.getDeploymentHistory(appName, deployment): Promise<Package[]>
sdk.getDeploymentMetrics(appName, deployment): Promise<DeploymentMetrics>

// Collaborators
sdk.getCollaborators(appName): Promise<CollaboratorMap>
sdk.addCollaborator(appName, email): Promise<void>

// Access Keys
sdk.getAccessKeys(): Promise<AccessKey[]>
sdk.addAccessKey(name, ttl?): Promise<AccessKey>
sdk.removeAccessKey(name): Promise<void>
```

### AcquisitionManager (acquisition-sdk.ts)
```typescript
// Used by mobile apps, not CLI
queryUpdateWithCurrentPackage(currentPackage, callback)
reportStatusDeploy(deployedPackage, status, callback)
reportStatusDownload(downloadedPackage, callback)
```

## Configuration Files

### ~/.code-push.config
```json
{
  "accessKey": "your-access-key",
  "preserveAccessKeyOnLogout": false,
  "customServerUrl": "http://localhost:3000"
}
```

### Mobile App - Info.plist (iOS)
```xml
<key>CodePushDeploymentKey</key>
<string>YOUR-DEPLOYMENT-KEY-HERE</string>

<key>CodePushServerURL</key>
<string>http://localhost:3000</string>
```

### Mobile App - build.gradle (Android)
```groovy
buildConfigField "String", "CODEPUSH_KEY", '"YOUR-DEPLOYMENT-KEY"'
```

## Common Workflows

### Workflow 1: Initial Setup
```bash
# 1. Register account
code-push-standalone register

# 2. Create apps
code-push-standalone app add MyOrg/MyApp-iOS
code-push-standalone app add MyOrg/MyApp-Android

# 3. View deployment keys
code-push-standalone deployment ls MyOrg/MyApp-iOS -k
code-push-standalone deployment ls MyOrg/MyApp-Android -k

# 4. Configure mobile app with keys
# Copy Staging key to Info.plist or build.gradle
```

### Workflow 2: Release Update
```bash
# 1. Make code changes in React Native project

# 2. Release to Staging
cd /path/to/react-native-project
code-push-standalone release-react MyOrg/MyApp-iOS ios -d Staging
code-push-standalone release-react MyOrg/MyApp-Android android -d Staging

# 3. Test on Staging deployment

# 4. Promote to Production
code-push-standalone promote MyOrg/MyApp-iOS Staging Production --des "Bug fixes"
code-push-standalone promote MyOrg/MyApp-Android Staging Production --des "Bug fixes"
```

### Workflow 3: Phased Rollout
```bash
# 1. Release to 10% of Production users
code-push-standalone release-react MyOrg/MyApp ios -d Production -r 10

# 2. Monitor for issues (check metrics)
code-push-standalone deployment ls MyOrg/MyApp

# 3. Increase rollout
code-push-standalone patch MyOrg/MyApp Production -r 25
code-push-standalone patch MyOrg/MyApp Production -r 50
code-push-standalone patch MyOrg/MyApp Production -r 100
```

### Workflow 4: Emergency Rollback
```bash
# 1. Check current deployment status
code-push-standalone deployment history MyOrg/MyApp Production

# 2. Rollback to previous version
code-push-standalone rollback MyOrg/MyApp Production

# 3. Or rollback to specific version
code-push-standalone rollback MyOrg/MyApp Production --targetRelease v42
```

## Debugging

### View CLI Version
```bash
code-push-standalone --version
```

### View Help
```bash
code-push-standalone --help
code-push-standalone app --help
code-push-standalone release-react --help
```

### Debug Logs (Mobile App)
```bash
# iOS Simulator
code-push-standalone debug ios

# Android Emulator/Device
code-push-standalone debug android
```

### Check Authentication
```bash
code-push-standalone whoami
```

### View Session File
```bash
cat ~/.code-push.config
```

## Troubleshooting

### Issue: "Not logged in"
```bash
# Solution: Login
code-push-standalone login
```

### Issue: "App not found"
```bash
# Solution: Check app name (case-sensitive, include org if needed)
code-push-standalone app ls
```

### Issue: "Invalid semver"
```bash
# Bad:  "1.0"
# Good: "1.0.0"
# Or use auto-detection for release-react (no -t flag)
```

### Issue: "Cannot release during active rollout"
```bash
# Solution: Complete current rollout
code-push-standalone patch MyApp Production -r 100

# Then release new update
```

### Issue: "Entry file not found"
```bash
# Solution: Specify entry file
code-push-standalone release-react MyApp ios -e src/index.js
```

## Advanced Features

### Code Signing
```bash
# 1. Generate keys
openssl genrsa -out private.pem
openssl rsa -pubout -in private.pem -out public.pem

# 2. Release with signing
code-push-standalone release-react MyApp ios -k ./private.pem

# 3. Configure mobile app with public key
# Add public key to Info.plist or strings.xml
```

### Custom Server URL
```bash
# Login to custom server
code-push-standalone login https://my-codepush-server.com

# Or set during register
code-push-standalone register https://my-codepush-server.com
```

### CI/CD Integration
```bash
# 1. Create long-lived access key
code-push-standalone access-key add "CI Server" --ttl 365d

# 2. Use key in CI
code-push-standalone login --accessKey $CODEPUSH_ACCESS_KEY

# 3. Release in CI pipeline
code-push-standalone release-react MyApp ios -d Production --mandatory
```

---

## Summary

The CodePush CLI provides a complete solution for managing over-the-air updates:

- **Simple**: Intuitive commands with sensible defaults
- **Powerful**: Supports phased rollouts, rollbacks, code signing
- **Flexible**: Works with any CodePush server
- **Type-Safe**: Built with TypeScript for reliability
- **Well-Tested**: Comprehensive test suite

For detailed architecture and internal flow documentation, see `CLI_FLOW_DOCUMENTATION.md`.

---

**Binary**: `code-push-standalone`  
**Source**: `/cli/script/`  
**Config**: `~/.code-push.config`  
**Server**: `http://localhost:3000` (default)

