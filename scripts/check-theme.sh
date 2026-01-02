#!/usr/bin/env bash
set -u

pattern='bg-\[var\(--color-primary\)\][^\n]*\btext-white\b'

if command -v rg >/dev/null 2>&1; then
  rg -n "$pattern" screens components
  status=$?
else
  grep -R -n "bg-\\[var(--color-primary)\\]" screens components | grep -n "text-white"
  status=$?
fi

if [ "$status" -eq 0 ]; then
  echo "Found primary buttons using text-white. Use text-[var(--color-primary-text)] or <Button>."
  exit 1
elif [ "$status" -eq 1 ]; then
  exit 0
else
  exit "$status"
fi
