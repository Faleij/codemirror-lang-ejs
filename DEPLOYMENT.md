# Deployment

This repo keeps **CI**, **GitHub Pages**, and **npm publish** in separate workflows so pull requests never receive deploy credentials.

| Workflow | File | Runs on | Secrets / write access |
| --- | --- | --- | --- |
| CI | `.github/workflows/ci.yml` | every PR + pushes to `main` | none (`contents: read` only) |
| Pages | `.github/workflows/pages.yml` | push to `main` + manual | OIDC for Pages only |
| npm | `.github/workflows/npm-publish.yml` | GitHub Release / `v*.*.*` tags | OIDC trusted publishing |

Workflows use **Node 24** (npm 11+) so Trusted Publishing OIDC works.

## 1. GitHub Pages

1. Open the repo on GitHub → **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, choose **GitHub Actions** (not "Deploy from a branch").
3. Merge/push workflows to `main`, then wait for **Deploy GitHub Pages**.
4. Site URL: `https://faleij.github.io/codemirror-lang-ejs/`
5. Optional: **Settings** → **Environments** → `github-pages` — required reviewers.

No personal access token is required. Deploy uses GitHub OIDC + `actions/deploy-pages`.

## 2. npm publish

Package name: `@faleij/codemirror-lang-ejs` (unscoped `codemirror-lang-ejs` is taken).

### 2a. Bootstrap (one-time) — create the package with a 0.0.0 stub

Trusted Publishing can only be attached after the package exists. Publish a throwaway stub once from your machine:

```bash
npm login
mkdir %TEMP%\ejs-npm-stub && cd %TEMP%\ejs-npm-stub
# minimal package.json with name @faleij/codemirror-lang-ejs, version 0.0.0, publishConfig.access public
npm publish --access public
```

Keep the repo version at `0.1.0` — do not commit the stub.

### 2b. Trusted Publishing (OIDC) — preferred for all later releases

1. On npmjs.com → `@faleij/codemirror-lang-ejs` → **Trusted Publisher** → GitHub Actions:
   - **Organization or user**: `Faleij`
   - **Repository**: `codemirror-lang-ejs`
   - **Workflow filename**: `npm-publish.yml`
   - **Environment name**: `npm`
2. On GitHub: **Settings** → **Environments** → **`npm`** (optional required reviewers).
3. Publish real versions with a Release or tag (`v0.1.0`). The workflow runs tests then `npm publish --provenance --access public`.

### Fallback: granular automation token

Only if Trusted Publishing is unavailable:

1. npm → Access Tokens → granular token with **write** only for `@faleij/codemirror-lang-ejs`.
2. GitHub → **Environments** → `npm` → **Environment secrets** → `NPM_TOKEN`.
3. In `.github/workflows/npm-publish.yml`, uncomment the `NODE_AUTH_TOKEN` env block.

Never put `NPM_TOKEN` on the CI workflow or on PR jobs.

## 3. Security checklist

- [x] PR workflow has no `id-token`, `pages`, or publish steps
- [x] Pages and npm workflows do **not** use `pull_request` or `pull_request_target`
- [x] npm publish gated by GitHub Environment `npm`
- [x] Prefer OIDC trusted publishing + provenance over long-lived tokens
- [ ] (You) Enable Pages source = GitHub Actions
- [ ] (You) Publish 0.0.0 stub, then configure npm trusted publisher