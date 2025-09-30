# Publishing s9n-devops-agent to NPM

## Package Summary
- **Package Name**: s9n-devops-agent
- **Version**: 1.0.0
- **Size**: 71.3 kB (packed) / 268.6 kB (unpacked)
- **Total Files**: 21 files
- **License**: MIT
- **Repository**: https://github.com/SecondBrainAICo/CS_DevOpsAgent

## Files Included in Package
✅ Source code (src/)
✅ CLI entry point (bin/)
✅ Documentation (docs/, README.md)
✅ Scripts (start-devops-session.sh, cleanup-sessions.sh)
✅ License (LICENSE)
✅ Package metadata (package.json)

## Files Excluded
❌ Local deployment files
❌ Test scripts directory
❌ Node modules
❌ Git files
❌ Build artifacts
❌ Coverage reports
❌ IDE configurations

## Publishing Steps

### 1. Login to NPM
```bash
npm login
# Enter your NPM username, password, and email
# If using 2FA, enter the OTP code when prompted
```

### 2. Verify Package Name Availability
```bash
npm view s9n-devops-agent
# Should return "npm ERR! code E404" if available
```

### 3. Final Test (Optional)
```bash
# Create a test package locally
npm pack
# This creates s9n-devops-agent-1.0.0.tgz

# Test install locally
npm install -g ./s9n-devops-agent-1.0.0.tgz
s9n-devops-agent --help

# Uninstall test
npm uninstall -g s9n-devops-agent
```

### 4. Publish to NPM
```bash
# Publish the package
npm publish --access public

# Or if you want to test first:
npm publish --dry-run --access public
```

### 5. Verify Publication
```bash
# Check if package is available
npm view s9n-devops-agent

# Or visit:
# https://www.npmjs.com/package/s9n-devops-agent
```

## Post-Publication

### Update GitHub Repository
1. Create a release tag:
```bash
git tag -a v1.0.0 -m "Initial release of s9n-devops-agent"
git push origin v1.0.0
```

2. Create GitHub Release:
- Go to https://github.com/SecondBrainAICo/CS_DevOpsAgent/releases
- Click "Create a new release"
- Select the v1.0.0 tag
- Add release notes

### Test Installation
```bash
# Test global installation
npm install -g s9n-devops-agent
s9n-devops-agent --version

# Test local installation
mkdir test-install && cd test-install
npm install s9n-devops-agent
npx s9n-devops-agent --help
```

## Future Releases

### Version Bump
```bash
# For patch release (1.0.0 -> 1.0.1)
npm version patch

# For minor release (1.0.0 -> 1.1.0)
npm version minor

# For major release (1.0.0 -> 2.0.0)
npm version major
```

### Republish
```bash
npm publish
```

## Troubleshooting

### If "Package Name Exists" Error:
- The name might be taken or too similar to existing packages
- Try alternative names:
  - s9n-devops
  - s9n-git-agent
  - secondbrain-devops-agent

### If Authentication Fails:
```bash
# Check current user
npm whoami

# Re-login
npm logout
npm login
```

### If Permission Denied:
- Ensure you have publishing rights
- Check package.json has "publishConfig": { "access": "public" }

## Notes
- The package is configured for public access
- All dependencies are properly specified
- The CLI command `s9n-devops-agent` will be globally available
- The package works across platforms (macOS, Linux, Windows with WSL)