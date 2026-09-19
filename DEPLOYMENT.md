# Deployment

This repo keeps **CI**, **GitHub Pages**, and **npm publish** in separate workflows so pull requests never receive deploy credentials.

| Workflow | File | Runs on | Secrets / write access |
| --- | --- | --- | --- |
| CI | `.github/workflows/ci.yml` | every PR + pushes to `main` | none (`contents: read` only) |
| Pages | `.github/workflows/pages.yml` | push to `main` + manual | OIDC for Pages only |
| npm | `.github/workflows/npm-publish.yml` | GitHub Release / `v*.*.*` tags | OIDC trusted publishing |

## 1. GitHub Pages

1. Open the repo on GitHub → **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, choose **GitHub Actions** (not "Deploy from a branch").
3. Merge these workflows to `main` (or push them), then wait for the **Deploy GitHub Pages** workflow.
4. The site URL will look like: `https://faleij.github.io/codemirror-lang-ejs/`
5. Optional: **Settings** → **Environments** → `github-pages` — add required reviewers if you want a human gate before each Pages deploy.

No personal access token is required. Deploy uses GitHub’s OIDC + `actions/deploy-pages`.

## 2. npm publish (Trusted Publishing — preferred)

Avoid long-lived `NPM_TOKEN` secrets when you can.

1. Create an account (or org) on [npmjs.com](https://www.npmjs.com/) and enable 2FA.
2. Use `@faleij/codemirror-lang-ejs` (unscoped `codemirror-lang-ejs` is taken). First publish under your npm account creates it.
3. On npm: **Access** / package settings → **Trusted Publishers** → add GitHub Actions:
   - **Organization or user**: `Faleij`
   - **Repository**: `codemirror-lang-ejs`
   - **Workflow filename**: `npm-publish.yml` (exact name under `.github/workflows/`)
   - **Environment name**: `npm` (must match the workflow `environment:`)
4. On GitHub: **Settings** → **Environments** → create **`npm`**.
   - Recommended: enable **Required reviewers** and/or a wait timer so a tag alone cannot publish without approval.
5. Publish a version:
   - Bump `version` in `package.json` on `main`.
   - Create a GitHub Release (or push a tag like `v0.1.0`).
   - Approve the `npm` environment deployment if you enabled protection rules.
   - The workflow runs tests, then `npm publish --provenance --access public`.

### Fallback: granular automation token

Only if Trusted Publishing is unavailable:

1. npm → Access Tokens → generate a **granular** token with **write** only for `@faleij/codemirror-lang-ejs` (not a classic publish token with broad access).
2. GitHub → **Environments** → `npm` → **Environment secrets** → `NPM_TOKEN`.
3. In `.github/workflows/npm-publish.yml`, uncomment the `NODE_AUTH_TOKEN` `env` block under the Publish step.

Never put `NPM_TOKEN` on the CI workflow or as a repository-wide secret used by PR jobs.

## 3. Security checklist

- [x] PR workflow has no `id-token`, `pages`, or publish steps
- [x] Pages and npm workflows do **not** use `pull_request` or `pull_request_target`
- [x] npm publish gated by GitHub Environment `npm`
- [x] Prefer OIDC trusted publishing + `--provenance` over long-lived tokens
- [ ] (You) Enable Pages source = GitHub Actions
- [ ] (You) Configure npm trusted publisher + GitHub Environment `npm`
