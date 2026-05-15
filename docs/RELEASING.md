# Releasing DYAD (#76 / #77 / #78)

End-to-end playbook for building, signing, notarizing, and shipping a
DYAD macOS binary. Assumes you have an Apple Developer Program account
($99/yr) and a Developer ID Application certificate in Keychain.

## 0. One-time setup

1. Enroll in the Apple Developer Program.
2. In Xcode → Settings → Accounts → Manage Certificates, create a
   **Developer ID Application** cert. Download + add to Keychain.
3. Verify with:
   ```bash
   security find-identity -v -p codesigning
   # → 1) ABC1234567 "Developer ID Application: Your Name (TEAMID)"
   ```
4. Generate an **app-specific password** at appleid.apple.com (Security
   → App-Specific Passwords). Save it in 1Password / Keychain — you'll
   pass it via `APPLE_APP_SPECIFIC_PASSWORD`.

## 1. Configure tauri.conf.json

In `apps/mac/src-tauri/tauri.conf.json`, replace the placeholder team id:

```json
"macOS": {
  "signingIdentity": "Developer ID Application: Your Name (ABC1234567)",
  "providerShortName": "ABC1234567"
}
```

(Or leave as `YOUR_TEAM_ID` and use `APPLE_SIGNING_IDENTITY` env var with
the full string at build time.)

## 2. Required env vars

```bash
export APPLE_TEAM_ID="ABC1234567"
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (ABC1234567)"
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="aaaa-bbbb-cccc-dddd"
```

Add the same secrets to your CI runner (GitHub Actions repository
secrets); never commit them.

## 3. Build

```bash
bun install --ignore-scripts
bun run --cwd apps/mac sidecar:build      # bun --compile → src-tauri/binaries/dyad-engine
bun run --cwd apps/mac tauri:build        # produces .app bundle
```

The Tauri bundler honours the `signingIdentity` in `tauri.conf.json` and
will sign the `.app` for you. The next step double-signs and packages a
DMG.

## 4. Package + notarize

```bash
bash scripts/package-dmg.sh
```

This script:
1. Re-signs `DYAD.app` with `codesign --options runtime --timestamp`
2. Builds `dist/DYAD-0.1.0.dmg`
3. Signs the DMG
4. Submits to `xcrun notarytool` (blocks until Apple replies)
5. Staples the ticket to both the `.app` and the `.dmg`
6. Verifies with `spctl -a -vv -t install`

Set `SKIP_NOTARIZE=1` to skip step 4–6 during iterative dev.

## 5. Verify on a clean Mac

Copy the `.dmg` to a Mac that has **never run a dev build**:

```bash
spctl -a -vv DYAD.app
# Expect: "source=Notarized Developer ID"
codesign -dv --verbose=4 DYAD.app | grep TeamIdentifier
# Expect: "TeamIdentifier=ABC1234567"
```

Open the DMG by double-clicking. macOS Gatekeeper should let it open
without the "damaged" or "cannot be opened" dialog.

## 6. Distribute

Upload the signed + notarized DMG to the demo machine, backup machine,
GitHub Releases, or wherever the demo audience will download from.

Filename convention: `DYAD-<version>.dmg`. Bump `version` in
`apps/mac/package.json` and `apps/mac/src-tauri/tauri.conf.json`
together.

## Common failures

| Symptom | Fix |
|---------|-----|
| `code object is not signed at all` | The `.app` wasn't signed; re-run step 4 |
| `The executable does not have the hardened runtime enabled` | `tauri.conf.json` → `macOS.hardenedRuntime: true` |
| `errSecInternalComponent` during signing | Keychain doesn't have the private key — re-add the cert |
| `Apple notarization failed`: missing entitlements | Add the missing key to `entitlements.plist`, re-build, re-notarize |
| Gatekeeper still shows warning | You stapled the wrong file; staple the `.app` *inside* the DMG |
