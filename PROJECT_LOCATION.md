# 🚨 CANONICAL PROJECT LOCATION — DO NOT IGNORE

> **The ONLY valid location for the nomadspeople-app project on this Mac is:**
>
> ```
> /Users/shospeople/Desktop/nomadspeople-app
> ```
>
> **DO NOT create, copy, clone, or work from any other folder.**

---

## Why this file exists

On 2026-04-25 we discovered we had **4 separate `nomadspeople` folders** on the Mac, and accidentally ran `eas build` from the wrong one — uploading 7-day-old code to Google Play with 146 commits missing including production-blocking bug fixes. This cost us a re-submission and ~4 hours of work.

This file is the lock that prevents it happening again.

---

## ❌ Folders that MUST NOT exist on this Mac

If any of these still exist, **delete them now**:

- `~/nomadspeople-app` (the wrong folder we built from by mistake — DELETE)
- `~/nomadspeople` (old/stale — DELETE)

To delete safely:
```bash
# Verify first that these are NOT the canonical Desktop folder
ls -la ~/nomadspeople-app 2>/dev/null
ls -la ~/nomadspeople 2>/dev/null

# If confirmed they're the duplicates, delete:
rm -rf ~/nomadspeople-app
rm -rf ~/nomadspeople
```

The Desktop folder (`~/Desktop/nomadspeople-app`) stays. That's the one with the real, latest code.

---

## ✅ Pre-flight checklist before EVERY `eas build`

Run this checklist before triggering any production build. It takes 30 seconds and prevents the "wrong build went to Google" disaster:

```bash
# 1. Confirm you're in the right folder
pwd
# Expected output: /Users/shospeople/Desktop/nomadspeople-app
# If anything else: STOP. cd to the correct folder.

# 2. Confirm you're on the latest commit + clean working state
git log -1 --oneline
git status --short | head -5
# HEAD should be the latest commit you remember making.
# Modified files should only be intentional uncommitted work.

# 3. Confirm the build will pull recent changes from GitHub if any
git fetch origin
git status -uno  # tells you if you're behind origin
# If "Your branch is behind 'origin/main' by N commits" → git pull first.

# 4. Confirm package.json has known-good dependencies
node -e "const p=require('./package.json'); console.log('async-storage:', p.dependencies['@react-native-async-storage/async-storage']); console.log('expo:', p.dependencies.expo);"
# Expected: async-storage: 2.2.0 (NOT ^3.x), expo: ~54.0.x

# 5. Confirm versionCode in app.json
grep versionCode app.json
# Should be the LAST USED versionCode. EAS will autoIncrement it.

# 6. Run the build
eas build --platform android --profile production --non-interactive
```

If all 5 checks pass, the build is safe to ship. If any check fails, stop and ask Claude what to do.

---

## ✅ Post-build verification (before uploading to Play Console)

After `eas build` completes and you download the AAB:

```bash
# 1. Confirm only ONE .aab file exists in Downloads (delete old ones)
ls -lah ~/Downloads/*.aab

# 2. Confirm the file is recent (timestamp = today)
stat -f "%Sm" ~/Downloads/application-*.aab

# 3. Confirm versionCode is what you expect
unzip -p ~/Downloads/application-*.aab base/manifest/AndroidManifest.xml | strings | grep -i versionCode
```

If you have multiple .aab files in Downloads, **delete all old ones first**:
```bash
rm ~/Downloads/application-*.aab  # then re-download from Expo
```

---

## Anti-patterns to NEVER do

1. **NEVER** clone the repo into a new folder. There is one canonical location, listed above.
2. **NEVER** copy/duplicate the project folder for "backups". Use git branches.
3. **NEVER** run `eas build` without doing the pre-flight checklist.
4. **NEVER** drag a `.aab` to Play Console without verifying the timestamp and versionCode.
5. **NEVER** trust file names alone — Mac Downloads adds `(1)`, `(2)` etc. when you re-download.

---

## Time-stamp of this lock

- Created: 2026-04-25 (after the wrong-build incident)
- Author: Barak + Claude
- Trigger: Production AAB built from outdated 7-day-old folder reached Google Review before catch
