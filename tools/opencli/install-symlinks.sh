#!/usr/bin/env bash
# Idempotent bootstrap: link every in-repo opencli adapter and site folder
# into the user's ~/.opencli/ tree so opencli's loader finds them.
#
# Run from anywhere. Safe to re-run after adding/removing adapters.
#
#   bash tools/opencli/install-symlinks.sh

set -euo pipefail

# Resolve script location → repo root → tools/opencli root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_OPENCLI="$SCRIPT_DIR"
TARGET_BASE="${HOME}/.opencli"

CREATED=0
SKIPPED=0
REPLACED=0
ERRORS=0

mkdir -p "$TARGET_BASE/clis" "$TARGET_BASE/sites"

# Returns 0 if the symlink at $1 already points exactly at $2
links_to() {
  local link="$1" want="$2"
  [[ -L "$link" ]] || return 1
  local current
  current="$(readlink "$link")"
  [[ "$current" == "$want" ]]
}

link_one() {
  local source="$1" target="$2"
  if [[ -e "$target" || -L "$target" ]]; then
    if links_to "$target" "$source"; then
      ((SKIPPED+=1))
      return 0
    fi
    if [[ -L "$target" ]]; then
      printf "  REPLACE  %s\n" "$target"
      rm "$target"
      ln -s "$source" "$target"
      ((REPLACED+=1))
      return 0
    fi
    printf "  SKIP (real file in the way) %s\n" "$target"
    ((ERRORS+=1))
    return 0
  fi
  mkdir -p "$(dirname "$target")"
  ln -s "$source" "$target"
  printf "  LINK     %s -> %s\n" "$target" "$source"
  ((CREATED+=1))
}

echo "Bootstrapping opencli symlinks…"
echo "  source: $REPO_OPENCLI"
echo "  target: $TARGET_BASE"
echo

# clis/<site>/<name>.js
shopt -s nullglob
for site_dir in "$REPO_OPENCLI/clis"/*/; do
  site="$(basename "$site_dir")"
  for adapter_file in "$site_dir"*.js; do
    [[ -f "$adapter_file" ]] || continue
    name="$(basename "$adapter_file")"
    target="$TARGET_BASE/clis/$site/$name"
    link_one "$adapter_file" "$target"
  done
done

# sites/<site>/ — link the directory itself so any future fixtures auto-pick-up
for site_dir in "$REPO_OPENCLI/sites"/*/; do
  site="$(basename "$site_dir")"
  target="$TARGET_BASE/sites/$site"
  source="$site_dir"
  # readlink-friendly: drop trailing slash from source
  source="${source%/}"
  link_one "$source" "$target"
done

echo
printf "Summary: %d created, %d already-current, %d replaced, %d errors\n" "$CREATED" "$SKIPPED" "$REPLACED" "$ERRORS"
if (( ERRORS > 0 )); then
  echo "Some entries had real files at the target path. Inspect ~/.opencli/ and re-run."
  exit 1
fi
