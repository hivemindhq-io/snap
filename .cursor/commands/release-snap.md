# release-snap

Release the Hive Mind Snap to npm with proper versioning.

## Instructions

When this command is invoked, perform the following steps:

### 1. Ask the user which version bump type they want

Present these options:
- **patch** (bug fixes, e.g., 1.2.1 → 1.2.2)
- **minor** (new features, e.g., 1.2.1 → 1.3.0)
- **major** (breaking changes, e.g., 1.2.1 → 2.0.0)

### 2. Calculate the new version

Read the current version from `packages/snap/package.json` and calculate the new version based on their choice.

### 3. Update version files

Update the version in BOTH:
- `packages/snap/package.json`
- `packages/snap/snap.manifest.json`

### 4. Run build and manifest validation

Execute these commands in sequence:
```bash
cd packages/snap
yarn build:clean
yarn mm-snap manifest
```

### 5. Commit and tag

Execute:
```bash
git add packages/snap/package.json packages/snap/snap.manifest.json packages/snap/dist/
git commit -m "chore: release v{NEW_VERSION}"
git tag -a "v{NEW_VERSION}" -m "Release v{NEW_VERSION}"
```

### 6. Push to remote

Execute:
```bash
git push origin HEAD
git push origin "v{NEW_VERSION}"
```

### 7. Publish to npm

First check if logged in:
```bash
npm whoami
```

If not logged in, tell the user to run `npm login` first and to publish from the command line themselves. Then we will continue.

If logged in, publish:
```bash
cd packages/snap
npm publish --access public # this should be executed from the packages/snap directory!
```

### 8. Confirm success

Tell the user the release was successful and provide:
- The new version number
- Link to npm package: https://www.npmjs.com/package/@hivemindhq/snap

## Notes

- Requires `git_write` and `network` permissions for terminal commands
- User must be authenticated with npm before running
- All version bumps follow semver conventions



