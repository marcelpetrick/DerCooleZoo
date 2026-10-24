# Repository instructions

## Product scope

- Read `visions.md` before implementing product behavior. It is the source of
  product requirements. If missing, obtain it from the user; do not invent it.
- Maintain a requirement-by-requirement implementation and validation plan.
- Make routine design decisions independently and finish the complete vision.
- Use a stack similar to AlliumAssault: TypeScript in strict mode, Vite,
  Babylon.js when 3D rendering is needed, Vitest with V8 coverage, and Playwright.
- Make the local application work before adding Docker packaging.

## Git and releases

- Work directly on `main`.
- Make small, atomic commits with Conventional Commit messages.
- Use semantic versioning. Bump the patch version in every commit; major product
  features advance the minor version and reset the patch version.
- Run all applicable checks successfully before every commit and push.
- Push verified commits continuously. Never claim remote checks passed without
  checking their actual results.

## Quality and automation

- Establish `localPipeline.sh` as early as possible and keep it the authoritative
  verification entry point.
- Include formatting, linting, TypeScript/static analysis, unit and integration
  tests, coverage, and production builds. Add end-to-end and Docker checks as
  those capabilities become available.
- Enforce at least 95% coverage for statements, branches, functions, and lines.
  Do not weaken thresholds or exclude application logic to pass checks.
- Mirror the local pipeline in GitHub Actions. Add Docker build and GHCR image
  publication workflows once the local product works.
- Write small reusable scripts for repetitive tasks and document their usage.
- Use meaningful unit, integration, and end-to-end tests where appropriate.

## Licensing and documentation

- License the project under GPLv3, with a proper `LICENSE` and copyright/license
  headers in appropriate source and script files.
- Document setup, usage, tests, pipeline, scripts, and Docker in `README.md`.
- Use badges comparable to `~/repos/myLastFmPlayer` or `cullendula`, and include
  at least one real screenshot of the running UI.

## Completion gate

- Run the `reviewBranch` skill, resolve its findings, then run `githubAbout`.
- Reconcile every requirement in `visions.md` with the implementation and tests.
- Run the complete local pipeline and verify the Docker image actually works.
- Verify GitHub Actions are green and all intended changes are pushed.
- Leave a clean working tree and report any unmet requirement honestly.
