# CodePush CLI - npm Package Shipping Summary

This document summarizes everything needed to ship the CodePush CLI as an npm package that users can install and use in their projects.

---

## 📦 What We've Set Up

### 1. **Updated package.json** ✅

**Key Changes:**
- Added `bin` field with two command aliases:
  - `code-push-standalone` (full name)
  - `codepush` (short alias)
- Added `files` field to include only compiled JS (not TypeScript source)
- Added lifecycle scripts:
  - `prepare`: Runs on install (builds TypeScript)
  - `prepack`: Runs before creating tarball
  - `prepublishOnly`: Runs before publishing (lint + test)
- Added keywords for npm discoverability
- Added engines specification (Node >= 14)

### 2. **Created .npmignore** ✅

Excludes from published package:
- TypeScript source files (`script/`)
- Test files
- Config files (tsconfig.json, .eslintrc.json, etc.)
- IDE files
- Only ships compiled JavaScript in `bin/` directory

### 3. **Verified CLI Entry Point** ✅

`cli/script/cli.ts` already has the required shebang:
```typescript
#!/usr/bin/env node
```

This makes the file executable when installed.

### 4. **Created Documentation** ✅

- **NPM_PUBLISHING_GUIDE.md**: Complete guide for maintainers to publish
- **USAGE_EXAMPLES.md**: Examples for end users on how to use the CLI
- **CLI_FLOW_DOCUMENTATION.md**: Internal architecture (already existed)
- **CLI_QUICK_REFERENCE.md**: Command reference (already existed)

---

## 🚀 How It Works

### The Magic of the `bin` Field

When users install your package, npm creates symlinks:

```json
{
  "bin": {
    "code-push-standalone": "./bin/script/cli.js",
    "codepush": "./bin/script/cli.js"
  }
}
```

**Global Install:**
```bash
npm install -g @your-org/code-push-cli

# npm creates symlinks in:
# - /usr/local/bin/code-push-standalone -> /usr/local/lib/node_modules/@your-org/code-push-cli/bin/script/cli.js
# - /usr/local/bin/codepush -> /usr/local/lib/node_modules/@your-org/code-push-cli/bin/script/cli.js

# Users can now run:
code-push-standalone app ls
codepush app ls
```

**Local Install (Dev Dependency):**
```bash
cd my-react-native-project
npm install --save-dev @your-org/code-push-cli

# npm creates symlinks in:
# - node_modules/.bin/code-push-standalone
# - node_modules/.bin/codepush

# Users can run via:
npx code-push-standalone app ls
npm exec code-push-standalone app ls
yarn code-push-standalone app ls

# Or in package.json scripts:
{
  "scripts": {
    "deploy": "code-push-standalone release-react MyApp ios"
  }
}
```

---

## 📝 Publishing Checklist

### Before First Publish:

- [ ] Update `name` in package.json (e.g., `@your-org/code-push-cli`)
- [ ] Set initial version (e.g., `1.0.0`)
- [ ] Verify repository URL is correct
- [ ] Ensure LICENSE.txt exists
- [ ] Update README.md with installation instructions
- [ ] Create CHANGELOG.md

### Every Publish:

```bash
# 1. Ensure code is up to date
git pull origin main

# 2. Install dependencies
cd cli/
npm install

# 3. Run tests and linting
npm test
npm run lint

# 4. Build
npm run build

# 5. Test locally
npm link
code-push-standalone --version
npm unlink -g @your-org/code-push-cli

# 6. Check what will be published
npm pack --dry-run

# 7. Bump version
npm version patch  # or minor, or major

# 8. Publish
npm publish --access public

# 9. Tag and push
git push origin main --tags
```

---

## 👥 How Users Will Use It

### Installation Options:

**1. Global Install (CLI tools)**
```bash
npm install -g @your-org/code-push-cli
code-push-standalone app ls
```

**2. Project Dev Dependency (Recommended for teams)**
```bash
npm install --save-dev @your-org/code-push-cli
```

**3. No Install (npx)**
```bash
npx @your-org/code-push-cli app ls
```

### Usage Examples:

**Direct CLI Commands:**
```bash
code-push-standalone login
code-push-standalone app add MyOrg/MyApp-iOS
code-push-standalone release-react MyOrg/MyApp-iOS ios -d Staging
code-push-standalone promote MyOrg/MyApp-iOS Staging Production
```

**npm Scripts (Most Common):**
```json
{
  "scripts": {
    "codepush:staging": "code-push-standalone release-react MyOrg/MyApp ios -d Staging",
    "codepush:prod": "code-push-standalone release-react MyOrg/MyApp ios -d Production --mandatory",
    "codepush:promote": "code-push-standalone promote MyOrg/MyApp Staging Production"
  }
}
```

```bash
npm run codepush:staging
npm run codepush:prod
```

**CI/CD (GitHub Actions):**
```yaml
- name: Deploy to CodePush
  run: npx @your-org/code-push-cli release-react MyApp ios -d Production
  env:
    CODEPUSH_ACCESS_KEY: ${{ secrets.CODEPUSH_ACCESS_KEY }}
```

---

## 🔧 Technical Details

### Package Structure (What Gets Published):

```
@your-org/code-push-cli@1.0.0/
├── package.json
├── README.md
├── LICENSE.txt
└── bin/                        # Compiled JavaScript only
    └── script/
        ├── cli.js             # Entry point (has shebang)
        ├── command-parser.js
        ├── command-executor.js
        ├── management-sdk.js
        └── ... (all other .js files)
```

**NOT included:**
- `script/` directory (TypeScript source)
- `test/` directory
- Config files (tsconfig.json, .eslintrc.json)

### Build Process:

```bash
npm run build
# Runs: tsc
# Compiles: script/**/*.ts -> bin/script/**/*.js
```

### Entry Point Execution Flow:

```
User runs: code-push-standalone app ls
    ↓
npm symlink: /usr/local/bin/code-push-standalone
    ↓
Points to: /usr/local/lib/node_modules/@your-org/code-push-cli/bin/script/cli.js
    ↓
Shebang: #!/usr/bin/env node
    ↓
Node executes: bin/script/cli.js
    ↓
Loads: command-parser.js, command-executor.js, etc.
    ↓
Executes command
```

---

## 🎯 Quick Start for New Users

**User's Project:**
```bash
cd my-react-native-app

# Install CLI
npm install --save-dev @your-org/code-push-cli

# Add to package.json
cat >> package.json << 'EOF'
{
  "scripts": {
    "codepush:login": "code-push-standalone login",
    "codepush:setup": "code-push-standalone app add MyOrg/MyApp-iOS && code-push-standalone app add MyOrg/MyApp-Android",
    "codepush:deploy:staging": "code-push-standalone release-react MyOrg/MyApp-iOS ios -d Staging",
    "codepush:deploy:prod": "code-push-standalone release-react MyOrg/MyApp-iOS ios -d Production --mandatory"
  }
}
EOF

# First time setup
npm run codepush:login
npm run codepush:setup

# Deploy updates
npm run codepush:deploy:staging
npm run codepush:deploy:prod
```

---

## 📊 Comparison: Before vs After

### Before (Manual Install):

```bash
# User has to clone repo
git clone https://github.com/your-org/code-push-server.git
cd code-push-server/cli

# User has to build
npm install
npm run build

# User has to install globally
npm install -g

# Hard to update, version control issues
```

### After (npm Package):

```bash
# One command install
npm install -g @your-org/code-push-cli

# Or project-specific
npm install --save-dev @your-org/code-push-cli

# Easy updates
npm update @your-org/code-push-cli

# Version pinning
npm install --save-dev @your-org/code-push-cli@1.2.3
```

---

## 🔄 Version Management Strategy

### Semantic Versioning:

- **Patch** (1.0.0 → 1.0.1): Bug fixes, no API changes
  ```bash
  npm version patch
  npm publish
  ```

- **Minor** (1.0.0 → 1.1.0): New features, backward compatible
  ```bash
  npm version minor
  npm publish
  ```

- **Major** (1.0.0 → 2.0.0): Breaking changes
  ```bash
  npm version major
  npm publish
  ```

### Pre-release Versions:

```bash
# Beta
npm version 1.1.0-beta.1
npm publish --tag beta

# Users install with:
npm install @your-org/code-push-cli@beta
```

---

## 🚨 Important Notes

### 1. Package Name

**If publishing under organization:**
```json
{
  "name": "@your-org/code-push-cli"
}
```

**If publishing as public package:**
```json
{
  "name": "code-push-cli"
}
```

Check availability: https://www.npmjs.com/package/code-push-cli

### 2. License

Ensure LICENSE.txt exists and is included in published package.

### 3. Breaking Changes

If you make breaking changes:
- Bump major version
- Update CHANGELOG.md
- Add migration guide
- Consider deprecating old version

### 4. npm Registry

Default: https://registry.npmjs.org

For private registry:
```bash
npm config set registry https://your-private-registry.com
npm publish
```

---

## 📚 Documentation Files

### For Package Maintainers:
- **NPM_PUBLISHING_GUIDE.md**: Step-by-step publishing instructions
- **CLI_FLOW_DOCUMENTATION.md**: Internal architecture details
- **CONTRIBUTING.md**: Contribution guidelines (create if needed)

### For End Users:
- **README.md**: Installation and basic usage
- **USAGE_EXAMPLES.md**: Common workflows and examples
- **CLI_QUICK_REFERENCE.md**: Command reference

---

## ✅ Final Checklist

### Code:
- [x] package.json configured with `bin`, `files`, and scripts
- [x] .npmignore created
- [x] CLI entry point has shebang
- [x] TypeScript compiles without errors
- [x] Tests pass (if any)

### Documentation:
- [x] Publishing guide created
- [x] Usage examples created
- [ ] README.md updated with installation instructions
- [ ] CHANGELOG.md created

### Publishing:
- [ ] npm account created/logged in
- [ ] Package name chosen and available
- [ ] Repository URL correct
- [ ] License file exists
- [ ] Tested locally with `npm link`
- [ ] Ready to run `npm publish`

---

## 🎉 Next Steps

1. **Update package name** in `cli/package.json` to your desired name
2. **Test locally**: `cd cli && npm run build && npm link`
3. **Create npm account**: https://www.npmjs.com/signup
4. **Login**: `npm login`
5. **Publish**: `npm publish --access public`
6. **Announce**: Share with users!

---

## 🆘 Support

If users have issues:

1. **Check installation**: `npm list @your-org/code-push-cli`
2. **Check PATH**: `npm bin -g`
3. **Try npx**: `npx @your-org/code-push-cli --help`
4. **Reinstall**: `npm uninstall -g @your-org/code-push-cli && npm install -g @your-org/code-push-cli`

---

## 📞 Contact

For issues and questions:
- GitHub Issues: https://github.com/your-org/code-push-server/issues
- Documentation: Link to your docs
- npm package: https://www.npmjs.com/package/@your-org/code-push-cli

---

**The CLI is now ready to be shipped as an npm package! 🚀**

Users will be able to:
- ✅ Install via npm/yarn/pnpm
- ✅ Run commands directly
- ✅ Use in npm scripts
- ✅ Integrate with CI/CD
- ✅ Update easily with npm/yarn

