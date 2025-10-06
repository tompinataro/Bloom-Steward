#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "branch: $BRANCH"

# show remote/HEAD first lines (detect LFS pointer)
git show origin/"$BRANCH":mobile/assets/palms.jpg 2>/dev/null | sed -n '1,6p' || echo "(missing on remote)"
git show HEAD:mobile/assets/palms.jpg 2>/dev/null | sed -n '1,6p' || echo "(missing in HEAD)"

# if pointer found, replace with the real splash image and force-add
if git show origin/"$BRANCH":mobile/assets/palms.jpg 2>/dev/null | sed -n '1,1' | grep -q 'version https://git-lfs.github.com/spec/v1' 2>/dev/null || \
   git show HEAD:mobile/assets/palms.jpg 2>/dev/null | sed -n '1,1' | grep -q 'version https://git-lfs.github.com/spec/v1' 2>/dev/null; then
  echo "Detected LFS pointer -> replacing with real palms_splash.jpg"
  cp mobile/assets/palms_splash.jpg /tmp/_palms.jpg
  mv mobile/assets/palms.jpg mobile/assets/palms.jpg.pointer.bak 2>/dev/null || true
  cp /tmp/_palms.jpg mobile/assets/palms.jpg
  git add -f mobile/assets/palms.jpg
  git commit -m "chore: replace LFS pointer with real palms.jpg for bundling" || true
  git push origin "$BRANCH" || true
else
  echo "palms.jpg not an LFS pointer (or missing)."
fi

# verify local bundling includes asset
npx react-native bundle --entry-file index.ts --platform android --dev false --bundle-output /tmp/main.bundle --assets-dest /tmp/assets || true
echo "---- /tmp/assets ----"
ls -l /tmp/assets | sed -n '1,200p' || true

# run interactive EAS build (will prompt to login if needed)
eas whoami || eas login
eas build --platform android --profile production --clear-cache
