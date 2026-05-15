# Distribution Configuration — Issues #76-79

## Summary
Configured macOS distribution packaging with code signing, notarization, DMG installer, and app icon setup.

## Changes Made

### 1. Code Signing Configuration (`apps/mac/src-tauri/tauri.conf.json`)
Added macOS-specific bundle configuration:
- `signingIdentity`: Developer ID Application (placeholder: YOUR_TEAM_ID)
- `providerShortName`: Team ID (placeholder: YOUR_TEAM_ID)
- `hardenedRuntime`: Enabled for security
- `entitlementsInherit`: Inherit from entitlements.plist

### 2. DMG Packaging Script (`scripts/package-dmg.sh`)
Created bash script that:
- Codesigns the app bundle with Developer ID
- Verifies the signature
- Creates DMG installer
- Signs the DMG
- Prepares for notarization (commented out, requires Apple Developer account)
- Moves final DMG to dist/ directory

### 3. App Icon
- Icon path configured: `icons/icon.icns`
- Icon file should be 1024x1024 .icns format
- TODO: Create actual icon file

## Setup Instructions

### Prerequisites
1. Apple Developer Account (for code signing and notarization)
2. Xcode Command Line Tools installed
3. Developer ID Application certificate installed in Keychain

### Configuration Steps
1. Update `apps/mac/src-tauri/tauri.conf.json`:
   - Replace `YOUR_TEAM_ID` with your actual Apple Team ID
   - Example: `Developer ID Application: ABC123XYZ`

2. Create app icon:
   - Design 1024x1024 icon
   - Convert to .icns format using iconutil or online converter
   - Place in `apps/mac/src-tauri/icons/icon.icns`

3. Build the app:
   ```bash
   bun run tauri build
   ```

4. Package DMG:
   ```bash
   export APPLE_TEAM_ID=ABC123XYZ
   chmod +x scripts/package-dmg.sh
   ./scripts/package-dmg.sh
   ```

### Notarization Setup (Optional)
To enable automatic notarization:
1. Generate app-specific password at appleid.apple.com
2. Uncomment notarization steps in `scripts/package-dmg.sh`
3. Set environment variables:
   - `APPLE_ID`: Your Apple ID email
   - `APPLE_PASSWORD`: App-specific password
   - `APPLE_TEAM_ID`: Your Team ID

## Verification
After packaging, verify:
```bash
# Verify code signature
codesign --verify --verbose dist/DYAD-0.1.0.dmg

# Check if app launches without Gatekeeper warning
open dist/DYAD-0.1.0.dmg
```

## Status
✅ Code signing configuration added
✅ DMG packaging script created
⚠️ App icon file needs to be created
⚠️ Notarization requires Apple Developer account setup
