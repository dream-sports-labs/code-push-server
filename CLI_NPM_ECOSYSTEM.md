# CodePush CLI - Complete npm Package Ecosystem

Visual guide showing how everything works together.

---

## 📦 Complete Ecosystem Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         npm Registry                                 │
│                  https://registry.npmjs.org                          │
│                                                                      │
│            @your-org/code-push-cli@1.0.0                            │
│            (Published package)                                       │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ npm install
                         │ npm install -g
                         │ npx
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌──────────────────┐            ┌──────────────────┐
│  Global Install  │            │  Local Install   │
│                  │            │  (Dev Dependency)│
└────────┬─────────┘            └────────┬─────────┘
         │                               │
         ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              User's System / Project                                 │
│                                                                      │
│  Global:                          Local:                             │
│  /usr/local/bin/                  node_modules/.bin/                 │
│    ├─ code-push-standalone        ├─ code-push-standalone           │
│    └─ codepush                    └─ codepush                       │
│         │                                 │                          │
│         │ (symlink)                       │ (symlink)               │
│         ▼                                 ▼                          │
│  /usr/local/lib/node_modules/     node_modules/@your-org/           │
│    @your-org/code-push-cli/         code-push-cli/                  │
│      └─ bin/script/cli.js           └─ bin/script/cli.js            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ User runs:                                                  │   │
│  │                                                             │   │
│  │ $ code-push-standalone app ls                              │   │
│  │ $ codepush release-react MyApp ios -d Production           │   │
│  │ $ npm run deploy                                            │   │
│  │ $ npx @your-org/code-push-cli app ls                       │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          │ HTTP Requests
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CodePush Server                                   │
│                    http://localhost:3000                             │
│                                                                      │
│  REST API Endpoints:                                                │
│    - POST /auth/login                                               │
│    - GET  /apps                                                     │
│    - POST /apps                                                     │
│    - POST /apps/:app/deployments/:deployment/release               │
│    - GET  /apps/:app/deployments/:deployment/history               │
│    - ...                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Installation Flow

### Global Install:

```
User runs:
$ npm install -g @your-org/code-push-cli

         ↓

npm downloads package from registry

         ↓

Extracts to: /usr/local/lib/node_modules/@your-org/code-push-cli/

         ↓

Creates symlinks in: /usr/local/bin/
  - code-push-standalone → .../code-push-cli/bin/script/cli.js
  - codepush → .../code-push-cli/bin/script/cli.js

         ↓

Sets executable permissions

         ↓

User can now run:
$ code-push-standalone app ls
$ codepush app ls
```

### Local Install (Dev Dependency):

```
User runs:
$ cd my-react-native-app
$ npm install --save-dev @your-org/code-push-cli

         ↓

npm downloads package from registry

         ↓

Extracts to: node_modules/@your-org/code-push-cli/

         ↓

Creates symlinks in: node_modules/.bin/
  - code-push-standalone → ../code-push-cli/bin/script/cli.js
  - codepush → ../code-push-cli/bin/script/cli.js

         ↓

Updates package.json:
{
  "devDependencies": {
    "@your-org/code-push-cli": "^1.0.0"
  }
}

         ↓

User can run via:
$ npx code-push-standalone app ls
$ npm exec code-push-standalone app ls
$ yarn code-push-standalone app ls

Or in package.json scripts:
{
  "scripts": {
    "deploy": "code-push-standalone release-react MyApp ios"
  }
}
$ npm run deploy
```

---

## 🎯 Usage Patterns

### Pattern 1: Direct CLI (Global Install)

```bash
# Install once globally
$ npm install -g @your-org/code-push-cli

# Use anywhere
$ cd ~/projects/app1
$ code-push-standalone app ls

$ cd ~/projects/app2
$ code-push-standalone release-react MyApp ios
```

**Pros:**
- ✅ Works everywhere
- ✅ Simple commands
- ✅ No project setup

**Cons:**
- ❌ Version conflicts between projects
- ❌ Harder to enforce team standards

---

### Pattern 2: npm Scripts (Local Install) - **RECOMMENDED**

```bash
# In project root
$ npm install --save-dev @your-org/code-push-cli
```

**package.json:**
```json
{
  "scripts": {
    "codepush:login": "code-push-standalone login",
    "codepush:staging": "code-push-standalone release-react MyApp ios -d Staging",
    "codepush:prod": "code-push-standalone release-react MyApp ios -d Production -m"
  },
  "devDependencies": {
    "@your-org/code-push-cli": "^1.0.0"
  }
}
```

**Usage:**
```bash
$ npm run codepush:staging
$ npm run codepush:prod
```

**Pros:**
- ✅ Version per project (no conflicts)
- ✅ Standardized commands
- ✅ Easy onboarding (just `npm install`)
- ✅ Documented in package.json
- ✅ Works in CI/CD

**Cons:**
- ❌ Slightly longer commands

---

### Pattern 3: npx (No Install)

```bash
# No installation needed
$ npx @your-org/code-push-cli app ls
$ npx @your-org/code-push-cli release-react MyApp ios
```

**Pros:**
- ✅ No installation
- ✅ Always latest version (unless pinned)
- ✅ Good for one-off commands

**Cons:**
- ❌ Slower (downloads each time)
- ❌ Requires internet
- ❌ Version inconsistency

---

### Pattern 4: CI/CD

**GitHub Actions:**
```yaml
steps:
  - uses: actions/checkout@v3
  
  - name: Setup Node
    uses: actions/setup-node@v3
    with:
      node-version: '18'
  
  - name: Install dependencies
    run: npm ci
  
  # Option 1: If installed as dev dependency
  - name: Deploy to CodePush
    run: npm run codepush:prod
  
  # Option 2: Using npx
  - name: Deploy to CodePush
    run: npx @your-org/code-push-cli release-react MyApp ios -d Production -m
```

**Pros:**
- ✅ Automated deployments
- ✅ Consistent versioning
- ✅ No manual intervention

---

## 📊 Package Anatomy

### What Gets Published:

```
@your-org/code-push-cli@1.0.0.tgz (npm package)
│
├── package.json          # Metadata, bin field, dependencies
├── README.md            # User documentation
├── LICENSE.txt          # License
│
└── bin/                 # Compiled JavaScript (from TypeScript)
    └── script/
        ├── cli.js       # #!/usr/bin/env node (entry point)
        ├── command-parser.js
        ├── command-executor.js
        ├── management-sdk.js
        ├── acquisition-sdk.js
        ├── sign.js
        ├── react-native-utils.js
        ├── commands/
        │   └── debug.js
        ├── types/
        │   ├── cli.js
        │   ├── rest-definitions.js
        │   └── index.js
        └── utils/
            └── file-utils.js
```

### What Doesn't Get Published (via .npmignore):

```
cli/
├── script/              # TypeScript source (EXCLUDED)
├── test/                # Tests (EXCLUDED)
├── tsconfig.json        # TS config (EXCLUDED)
├── .eslintrc.json       # ESLint config (EXCLUDED)
├── prettier.config.js   # Prettier config (EXCLUDED)
└── jest.config.js       # Jest config (EXCLUDED)
```

---

## 🔐 Authentication Flow

```
User's Machine                                  CodePush Server
      │                                                │
      │ 1. code-push-standalone login                 │
      ├──────────────────────────────────────────────▶│
      │                                                │
      │                                        Opens browser
      │                                        /auth/login
      │                                                │
      │                                        User authenticates
      │                                        (GitHub/Microsoft)
      │                                                │
      │                                        Generates access key
      │                                                │
      │ 2. Enter access key (prompted in CLI)         │
      ◀──────────────────────────────────────────────┤
      │                                                │
      │ 3. POST /authenticated (validate key)         │
      ├──────────────────────────────────────────────▶│
      │                                                │
      │ 4. 200 OK (key valid)                         │
      ◀──────────────────────────────────────────────┤
      │                                                │
      │ 5. Save to ~/.code-push.config                │
      │    {                                           │
      │      "accessKey": "abc123...",                 │
      │      "serverUrl": "http://localhost:3000"      │
      │    }                                           │
      │                                                │
      │ 6. All future commands use this key           │
      │    Authorization: Bearer cli-abc123...        │
      │                                                │
```

---

## 🚀 Release Flow

```
Developer Machine                               CodePush Server
       │                                               │
       │ 1. npm run codepush:staging                  │
       │    (or: code-push-standalone release-react)  │
       │                                               │
       ├── Detect app version from Info.plist        │
       ├── Run: react-native bundle                  │
       ├── Compile with Hermes (if enabled)          │
       ├── Sign bundle (if key provided)             │
       ├── Create ZIP                                │
       │                                               │
       │ 2. POST /apps/MyApp/deployments/Staging/release
       │    Authorization: Bearer cli-abc123...       │
       │    Content-Type: multipart/form-data         │
       │                                               │
       │    Fields:                                    │
       │    - package: <zip-file-stream>              │
       │    - packageInfo: {                          │
       │        appVersion: "1.0.0",                  │
       │        description: "Bug fixes",             │
       │        isMandatory: false,                   │
       │        rollout: 100                          │
       │      }                                        │
       ├──────────────────────────────────────────────▶│
       │                                               │
       │                                       Validates auth
       │                                       Extracts ZIP
       │                                       Calculates hash
       │                                       Stores in blob storage
       │                                       Creates DB record
       │                                               │
       │ 3. 200 OK (success)                          │
       ◀──────────────────────────────────────────────┤
       │                                               │
       │ ✓ Successfully released update               │
       │                                               │
```

---

## 📱 Mobile App Update Check Flow

```
Mobile App                  CodePush Server                Mobile App
(React Native)                                           (React Native)
     │                            │                            │
     │ 1. App starts              │                            │
     │    codePush.sync()         │                            │
     │                            │                            │
     │ 2. GET /updateCheck?       │                            │
     │    deploymentKey=xyz       │                            │
     │    appVersion=1.0.0        │                            │
     │    packageHash=abc         │                            │
     ├───────────────────────────▶│                            │
     │                            │                            │
     │                    Checks latest package               │
     │                    Matches version range               │
     │                    Checks rollout eligibility          │
     │                            │                            │
     │ 3. Response:               │                            │
     │    {                       │                            │
     │      isAvailable: true,    │                            │
     │      downloadURL: "...",   │                            │
     │      packageHash: "def",   │                            │
     │      isMandatory: false    │                            │
     │    }                       │                            │
     ◀───────────────────────────┤                            │
     │                            │                            │
     │ 4. Download package        │                            │
     │    from downloadURL        │                            │
     ├───────────────────────────▶│                            │
     ◀───────────────────────────┤                            │
     │                            │                            │
     │ 5. POST /reportStatus/download                         │
     ├───────────────────────────▶│                            │
     │                            │                            │
     │ 6. Install package         │                            │
     │    (extract, verify)       │                            │
     │                            │                            │
     │ 7. Restart app             │                            │
     ├──────────────────────────────────────────────────────▶│
     │                            │                            │
     │                            │      8. App runs new code  │
     │                            │                            │
     │ 9. POST /reportStatus/deploy (success)                 │
     ├───────────────────────────▶│                            │
     │                            │                            │
```

---

## 🎯 Real-World Example

### Team Setup:

**Project: MyCompany-MobileApp**

```bash
my-mobile-app/
├── package.json
├── .codepushrc           # Config
├── android/
├── ios/
└── scripts/
    └── codepush-deploy.sh
```

**package.json:**
```json
{
  "name": "my-mobile-app",
  "version": "2.3.1",
  "scripts": {
    "codepush:login": "code-push-standalone login",
    "codepush:staging": "npm run codepush:staging:ios && npm run codepush:staging:android",
    "codepush:staging:ios": "code-push-standalone release-react MyCompany/MobileApp-iOS ios -d Staging --des \"v$npm_package_version\"",
    "codepush:staging:android": "code-push-standalone release-react MyCompany/MobileApp-Android android -d Staging --des \"v$npm_package_version\"",
    "codepush:prod": "npm run codepush:prod:ios && npm run codepush:prod:android",
    "codepush:prod:ios": "code-push-standalone release-react MyCompany/MobileApp-iOS ios -d Production --mandatory --des \"v$npm_package_version\"",
    "codepush:prod:android": "code-push-standalone release-react MyCompany/MobileApp-Android android -d Production --mandatory --des \"v$npm_package_version\""
  },
  "devDependencies": {
    "@your-org/code-push-cli": "^1.0.0"
  }
}
```

**Workflow:**

```bash
# Developer makes changes
git checkout -b feature/bug-fix

# Test locally
npm start

# Commit and push
git commit -am "Fix: Bug in login flow"
git push origin feature/bug-fix

# Create PR, get approved, merge to develop

# CI/CD automatically deploys to Staging
# (GitHub Actions triggers: npm run codepush:staging)

# QA tests on Staging deployment

# If good, merge to main

# CI/CD automatically deploys to Production
# (GitHub Actions triggers: npm run codepush:prod)

# Users get update within minutes (no app store review!)
```

---

## 🌟 Benefits Summary

### For Package Maintainers:
- ✅ Easy to publish and update
- ✅ Semantic versioning
- ✅ Automated with CI/CD
- ✅ Usage analytics via npm

### For End Users:
- ✅ Simple installation (`npm install`)
- ✅ Version management
- ✅ Works in CI/CD
- ✅ No manual compilation
- ✅ Auto-updates via npm/yarn
- ✅ Consistent team workflows

### For Teams:
- ✅ Standardized deployments
- ✅ Reproducible builds
- ✅ Version pinning per project
- ✅ Easy onboarding
- ✅ Documented in package.json

---

## 📈 Adoption Path

### Phase 1: Internal Testing
```bash
# Publish as beta
npm version 1.0.0-beta.1
npm publish --tag beta

# Test in real project
npm install --save-dev @your-org/code-push-cli@beta
```

### Phase 2: Limited Release
```bash
# Publish as RC
npm version 1.0.0-rc.1
npm publish --tag rc

# Share with early adopters
```

### Phase 3: Public Release
```bash
# Publish stable version
npm version 1.0.0
npm publish --access public

# Announce on:
- GitHub README
- Slack/Discord
- Blog post
- Twitter
```

### Phase 4: Ongoing Maintenance
```bash
# Regular updates
npm version patch  # Bug fixes
npm version minor  # New features
npm version major  # Breaking changes

# Support channels:
- GitHub Issues
- Documentation
- Community support
```

---

**The CLI is production-ready and can be shipped to npm! 🎉**

All pieces are in place:
- ✅ Package configuration
- ✅ Build system
- ✅ Entry points
- ✅ Documentation
- ✅ Usage examples
- ✅ Publishing guides

**Next step: `npm publish` 🚀**

