# CLI Extraction: Step-by-Step Guide

## 🎯 Current Status

✅ **All technical issues resolved**
✅ **CLI is fully functional**  
✅ **Package configured for npm**
✅ **No breaking dependencies**

**You are ready to extract NOW!**

---

## 🚀 Choose Your Path

### Path A: Publish from Monorepo (Easiest)

**Use Case**: Keep CLI in the same repo as API, but publish to npm as a standalone package

**Pros**: No code changes needed, easier to maintain

**Steps**:
```bash
# 1. Navigate to CLI directory
cd /Users/jatinkhemchandani/code-push-server/cli

# 2. (Optional) Verify build
npm run build
node ./bin/script/cli.js --version  # Should output: 0.0.1

# 3. Login to npm (if not already)
npm login

# 4. Publish!
npm publish --access public
```

**Done!** Users can now install with:
```bash
npm install -g code-push-cli
# OR
npm install --save-dev code-push-cli
```

---

### Path B: Extract to Separate Repository (Full Separation)

**Use Case**: Create a separate `code-push-cli` repository

**Pros**: Complete separation, independent versioning

**Steps**:

#### Step 1: Create New Repository

```bash
# On GitHub, create new repo: code-push-cli
# Then clone it locally:
git clone https://github.com/YOUR_ORG/code-push-cli.git
cd code-push-cli
```

#### Step 2: Copy CLI Files

```bash
# Copy all CLI files from the monorepo
cp -r /Users/jatinkhemchandani/code-push-server/cli/* .

# Copy root license
cp /Users/jatinkhemchandani/code-push-server/LICENSE.txt .
```

#### Step 3: Initialize Git

```bash
git add .
git commit -m "Initial commit: Extract CLI from monorepo

- All code functional and tested
- TypeScript compilation fixed (rootDir set)
- Package configured for npm publishing
- No dependencies on API code"

git push origin main
```

#### Step 4: Test in New Location

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
node ./bin/script/cli.js --version  # Should output: 0.0.1
node ./bin/script/cli.js --help     # Should show help
```

#### Step 5: Publish to npm

```bash
npm login
npm publish --access public
```

#### Step 6: Update Original API Repository

In the original `code-push-server` repository:

**File**: `/api/README.md` (line 136)

```diff
- For detailed usage instructions, please refer to the [CLI documentation](../cli/README.md#development-parameter).
+ For detailed usage instructions, please refer to the [CLI documentation](https://github.com/YOUR_ORG/code-push-cli#readme).
```

Commit and push:
```bash
cd /Users/jatinkhemchandani/code-push-server
git add api/README.md
git commit -m "Update CLI documentation link to separate repository"
git push
```

#### Step 7: (Optional) Archive CLI in Monorepo

In the monorepo, you can either:

**Option A**: Delete the CLI directory entirely
```bash
cd /Users/jatinkhemchandani/code-push-server
git rm -r cli/
git commit -m "Remove CLI directory (now in separate repo: code-push-cli)"
git push
```

**Option B**: Keep it but add a README redirect
```bash
cd /Users/jatinkhemchandani/code-push-server/cli
echo "# This CLI has moved to: https://github.com/YOUR_ORG/code-push-cli" > README.md
git add README.md
git commit -m "CLI moved to separate repository"
git push
```

---

## ✅ Verification Checklist

After extraction (either path), verify:

### Local Testing
```bash
# Install globally
npm install -g code-push-cli

# Test version
code-push-standalone --version

# Test short alias
codepush --version

# Test help
code-push-standalone --help
```

### npm Package Testing
```bash
# Create a test directory
mkdir /tmp/test-codepush-cli
cd /tmp/test-codepush-cli

# Install as dependency
npm init -y
npm install code-push-cli

# Test via npx
npx code-push-standalone --version

# Test via npm scripts
echo '{"scripts": {"deploy": "code-push-standalone --version"}}' > package.json
npm run deploy
```

### Against Live Server (Recommended)
```bash
# Set server URL (if using self-hosted)
export CODEPUSH_SERVER_URL=https://your-server.com

# Login
code-push-standalone login

# Test basic commands
code-push-standalone app list
code-push-standalone deployment list <app-name>
```

---

## 📦 Package Info

After publishing, your package will be available as:

```bash
# Global installation
npm install -g code-push-cli

# Local development dependency
npm install --save-dev code-push-cli

# One-time execution
npx code-push-cli
```

**Commands available**:
- `code-push-standalone` (original command)
- `codepush` (new short alias)

---

## 🔄 Updating After Extraction

### For Path A (Monorepo):
```bash
cd /Users/jatinkhemchandani/code-push-server/cli

# Make your changes
# ...

# Update version
npm version patch  # or minor, or major

# Build and publish
npm run build
npm publish
```

### For Path B (Separate Repo):
```bash
cd /path/to/code-push-cli

# Make your changes
# ...

# Update version
npm version patch

# Build and publish
npm run build
npm publish

# Commit version bump
git push --follow-tags
```

---

## 🐛 Troubleshooting

### Issue: `Cannot find module 'package.json'`
**Solution**: Already fixed! Make sure `/cli/tsconfig.json` has `"rootDir": "."`

### Issue: `npm publish` says package exists
**Solution**: Either:
1. Update version: `npm version patch`
2. Use a scoped package: Change `"name": "code-push-cli"` to `"name": "@your-org/code-push-cli"` in package.json

### Issue: CLI doesn't work when installed globally
**Solution**: Verify the shebang is present in `/cli/bin/script/cli.js`:
```javascript
#!/usr/bin/env node
```
(Already present and working ✅)

### Issue: Users can't find the command
**Solution**: Ensure they install globally:
```bash
npm install -g code-push-cli
```
Or use `npx`:
```bash
npx code-push-cli
```

---

## 📝 Post-Extraction Documentation Updates

### In CLI README.md

Add installation section:
```markdown
## Installation

### Global installation (recommended for CLI usage)
npm install -g code-push-cli

### Local installation (for CI/CD or npm scripts)
npm install --save-dev code-push-cli

## Usage

# Using global installation
code-push-standalone --version
codepush app list

# Using npx (no installation required)
npx code-push-cli --version

# Using npm scripts
{
  "scripts": {
    "deploy:ios": "code-push-standalone release-react MyApp ios",
    "deploy:android": "code-push-standalone release-react MyApp android"
  }
}
```

Add server configuration:
```markdown
## Server Configuration

By default, the CLI connects to the official CodePush server. To use a self-hosted server:

export CODEPUSH_SERVER_URL=https://your-codepush-server.com
code-push-standalone login
```

### In API README.md

Update references:
```markdown
## CLI Tool

The CodePush CLI is available as a separate npm package:

npm install -g code-push-cli

Documentation: https://github.com/YOUR_ORG/code-push-cli
npm package: https://www.npmjs.com/package/code-push-cli
```

---

## 🎯 Success Criteria

You'll know extraction is successful when:

- [x] ✅ CLI builds without errors: `npm run build`
- [x] ✅ CLI runs locally: `node ./bin/script/cli.js --version`
- [ ] 📦 Package published to npm: `npm view code-push-cli`
- [ ] 🌍 Users can install globally: `npm install -g code-push-cli`
- [ ] ⚡ Commands work: `code-push-standalone --version`
- [ ] 🔗 Short alias works: `codepush --version`
- [ ] 🏃 npx works: `npx code-push-cli --version`

---

## 🎉 You're Ready!

**Everything is prepared. Just choose your path (A or B) and follow the steps!**

**Recommended**: Start with **Path A** (publish from monorepo) to test everything, then optionally move to **Path B** (separate repo) later if needed.

**Questions?** Refer to:
- `CLI_EXTRACTION_SUMMARY.md` - Quick overview
- `CLI_EXTRACTION_ANALYSIS.md` - Deep technical analysis
- `NPM_PUBLISHING_GUIDE.md` (in /cli/) - Publishing details
- `USAGE_EXAMPLES.md` (in /cli/) - Usage examples for end users

---

## 💡 Pro Tips

1. **Version Numbering**: Use semantic versioning
   - `1.0.0` → First stable release
   - `1.0.1` → Bug fixes
   - `1.1.0` → New features (backward compatible)
   - `2.0.0` → Breaking changes

2. **Git Tags**: npm automatically creates git tags on `npm publish`
   - Make sure to push tags: `git push --tags`

3. **npm Scripts**: Add convenience scripts to package.json:
   ```json
   {
     "scripts": {
       "release:patch": "npm version patch && npm publish",
       "release:minor": "npm version minor && npm publish",
       "release:major": "npm version major && npm publish"
     }
   }
   ```

4. **CI/CD**: Consider setting up GitHub Actions for automated testing and publishing

5. **Changelog**: Maintain a CHANGELOG.md to track changes between versions

---

**Let's ship it! 🚀**

