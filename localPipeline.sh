#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Marcel Petrick
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail
cd "$(dirname "$0")"
npm run lint
npm run typecheck
npm run coverage
npm run build
if test -f playwright.config.ts; then npm run e2e; fi
if test -f Dockerfile; then ./scripts/check-docker.sh; fi
