#!/bin/sh
# Usage: tools/release.sh "commit message"   (bumps the ?v= cache version, copies to the repo, pushes)
set -e
cd "$(dirname "$0")/.."
old=$(grep -oE "pages-v[0-9]+" js/config.js | head -1); n=${old#pages-v}; new="pages-v$((n+1))"
day=$(TZ=Asia/Taipei date +%Y-%m-%d)
sed -i -E "s/[0-9]{4}-[0-9]{2}-[0-9]{2}-$old/$day-$new/g" index.html js/config.js
node tools/build.mjs >/dev/null
cp -r .gitignore index.html js css assets src tools test /home/claude/pharmacy-notes/
rm -f /home/claude/pharmacy-notes/test/.seed.json
cd /home/claude/pharmacy-notes && git add -A && git commit -q -m "$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011EhahcAtsGBXVnM4qastRT" && git -c push.negotiate=true push 2>&1 | tail -1
echo "released $day-$new"
