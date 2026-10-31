#!/bin/sh
# Copies the source PDFs out of the research-archive branch into this folder,
# where git ignores them, and checks them against sources.sha256.
# Usage: sh research/fetch.sh
set -e
cd "$(dirname "$0")"
git fetch -q origin research-archive
for f in $(awk '{print $2}' sources.sha256); do
  git show "FETCH_HEAD:research/$f" > "$f"
done
sha256sum -c sources.sha256
