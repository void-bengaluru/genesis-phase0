#!/usr/bin/env bash
# publish_pages.sh — Push current repo contents to gh-pages branch for GitHub Pages
# Usage: ./publish_pages.sh [remote]  (default remote: origin)
set -euo pipefail
REMOTE=${1:-origin}
BRANCH=gh-pages
TMP_BRANCH=tmp-publish-$$

echo "Publishing to ${REMOTE}/${BRANCH}..."
# create an orphan branch locally with only the files we want
git checkout --orphan ${TMP_BRANCH}
# remove all files from index
git reset --hard
# copy working tree files into index
git add -A
# ensure .nojekyll exists so GitHub Pages doesn't run Jekyll
if [ ! -f .nojekyll ]; then touch .nojekyll && git add .nojekyll; fi
# commit
git commit -m "Publish site (auto)"
# force-update the remote gh-pages branch
git push --force ${REMOTE} ${TMP_BRANCH}:${BRANCH}
# return to previous branch
git checkout -f -
# delete temporary branch
git branch -D ${TMP_BRANCH}

echo "Published to ${REMOTE}/${BRANCH}. Visit https://${REMOTE%%/*}.github.io/REPO/ (replace REPO with your repo name)."
