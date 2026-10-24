# Development scripts and deployment

## Local verification

`./localPipeline.sh` is the release gate. Run it from any working directory; it
changes to the repository root, stops on the first failure, and runs the checks in
order. Node.js 24 and npm are required. Browser tests require the Playwright
Chromium and Firefox downloads and operating-system libraries:

```sh
npm ci
npx playwright install --with-deps chromium firefox
./localPipeline.sh
```

Coverage reports include every application TypeScript file. The configured minimum
is 95% for each of statements, branches, functions, and lines. Tests should exercise
behavior and invariants; exclusions and weakened thresholds do not replace tests.

Use `npm run format` before verification to apply Prettier. `npm run lint` checks
formatting without changing files. `npm run typecheck` performs static analysis
without generating output. `npm test` provides a faster unit/integration feedback
loop; the full gate additionally collects coverage, builds, runs browser tests,
and validates the container.

Linux CI runs Firefox with a real X display because its native headless backend
cannot create WebGL on the GitHub-hosted runner. The same local pipeline enables
Mesa software rendering and starts Xvfb when `CI` is set and `DISPLAY` is absent.
Playwright's `--with-deps` installation supplies Xvfb. To reproduce that path:

```sh
env -u DISPLAY CI=1 ./localPipeline.sh
```

Firefox tests still render the real WebGL scene and exercise the complete player
workflow; the virtual display does not skip or replace them.

## Container smoke test

`./scripts/check-docker.sh` requires a working Docker daemon, Git, Node.js, and curl.
With no arguments it builds the current checkout as `dercoolezoo:local`. Pass an
image reference (for example `./scripts/check-docker.sh ghcr.io/marcelpetrick/dercoolezoo:latest`)
to pull and verify an already-published image instead. It starts a temporary container
with a read-only filesystem, a temporary `/tmp`, all Linux capabilities removed,
and no-new-privileges enabled. It binds only to loopback on a random available port.

The script checks the health response, HTML, the actual JavaScript asset referenced
by the HTML, the distributed GPL license, the non-root user, and a missing-asset 404. A trap removes the temporary container and files on success or failure. The
local image and Docker build cache remain for reuse. The script does not publish
anything. Local builds require no registry credentials; pulling a private
published image requires an authenticated Docker registry session.

Container bases are pinned to multi-platform digests. To update a base, inspect
the upstream tag, change its digest in `Dockerfile`, and run the complete pipeline.
The runtime listens on port 8080 and uses nginx's unprivileged image. Its healthcheck
requests `http://127.0.0.1:8080/health` inside the container.

## Version changes

`npm run version:patch` runs `npm version patch --no-git-tag-version`.
`npm run version:minor` does the same for a minor release. Both update
`package.json` and `package-lock.json` together without making a commit or tag.

Choose the bump appropriate to the atomic change, run the full pipeline, then
commit with a Conventional Commit message and push `main`. Never commit failing
checks. Do not claim remote success until the actual Actions run is complete.

## GitHub Actions

[Pipeline](../.github/workflows/pipeline.yml) has three jobs:

1. **Local pipeline:** installs locked dependencies and both browser engines,
   runs `./localPipeline.sh`, uploads verification reports even on failure, and
   uploads the tested `dist/` as the Pages artifact on `main`.
2. **Deploy GitHub Pages:** requires successful verification and publishes the
   uploaded artifact using GitHub's Pages deployment action and OIDC permission.
3. **Publish GHCR image:** requires successful verification, authenticates using
   the short-lived workflow token, and publishes `latest`, the package version,
   and `sha-<full-commit>` tags. The image includes source, license, version, and
   revision OCI labels, provenance, and an SBOM. It then pulls the immutable commit
   tag and runs the same container smoke test against the published image.

Pages and GHCR jobs run only on `main`, never for pull requests. Workflow
concurrency cancels obsolete runs for the same branch. Verification has a timeout
and does not require any application secrets. The image job alone receives
`packages: write`; the Pages job alone receives Pages and OIDC permissions.

The repository's Pages build source must be **GitHub Actions**. The deployment URL
is <https://marcelpetrick.github.io/DerCooleZoo/>. Relative Vite asset URLs permit
hosting under this repository prefix without a separate build configuration.

Pushing `main` starts verification and publication automatically. To repeat the
release pipeline after its workflow exists on `main`, run:

```sh
gh workflow run pipeline.yml --ref main
gh run list --workflow pipeline.yml --branch main
```

This pipeline deploys the playable website and versioned container. It does not
create a GitHub Release page or a Git tag.

Publishing a GHCR package and making it public are distinct registry settings.
Check the package's visibility if unauthenticated pulls are required. Otherwise,
use a token with package-read permission when pulling a private image.

## Media

`docs/screenshot.png` is a capture of the actual running UI, produced during
browser verification when `CAPTURE_SCREENSHOT=1` is set. Run
`npm run build && CAPTURE_SCREENSHOT=1 npm run e2e -- --project=chromium`
to refresh it after meaningful visual changes; do not replace
it with an illustrative mockup.
