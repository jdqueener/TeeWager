# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Commit workflow

Don't commit unless the user asks. Make changes, let the user review/approve them, then once approved, commit and push immediately.

# EAS build numbers

`eas.json`'s `production` profile has `autoIncrement: true`, which bumps `buildNumber` in the local `app.json` at build time but does NOT commit that change to git. After every `eas build --profile production` run, check `git status` for a changed `buildNumber` in `app.json` and commit/push it immediately — otherwise the repo silently drifts from what's actually submitted to App Store Connect.
