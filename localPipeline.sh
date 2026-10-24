#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Marcel Petrick
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail
cd "$(dirname "$0")"
npm run lint
npm run typecheck
npm run coverage
npm run build
if test -f playwright.config.ts; then
  # Firefox's native Linux headless backend cannot create WebGL on GitHub runners.
  # Keep the real Firefox/WebGL tests: run headed with Mesa under a virtual display.
  if test -n "${CI:-}"; then
    export LIBGL_ALWAYS_SOFTWARE=1
    export MOZ_WEBRENDER=1
    if test -z "${DISPLAY:-}"; then
      xvfb-run --auto-servernum --server-args="-screen 0 1440x1000x24" npm run e2e
    else
      npm run e2e
    fi
  else
    npm run e2e
  fi
fi
if test -f Dockerfile; then ./scripts/check-docker.sh; fi
