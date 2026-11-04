# angular-sandbox

A sandbox for trying out Angular 22 and Angular Material (Material 3), deployed to GitHub Pages.

**Live site:** https://amundoyen.github.io/angular-sandbox/

## Pages

| Route         | What it shows                                                                                                                                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`           | Home.                                                                                                                                                                                                                                                                         |
| `/accordion`  | A `mat-accordion` with three panels of mock data. Drag a panel by its handle to reorder it; the order is saved in `localStorage`.                                                                                                                                             |
| `/image-mask` | Upload an image and drag a rectangle to mark the visible area. Preview it as a **crop** (the area scaled to fill its container) or **clip in place** (`clip-path: inset(...)`), with aspect-ratio presets and copyable CSS. The image is kept in memory for the session only. |

Feature pages are lazy-loaded from `src/app/pages/`.

## Tech stack

- Angular 22: standalone components, signals, zoneless change detection
- Angular Material and CDK 22 with a Material 3 theme (`src/styles.scss`) and Material Symbols icons
- Vitest with jsdom for unit tests
- Prettier for formatting

## Getting started

Angular CLI 22 needs Node.js `^22.22.3`, `^24.15.0` or `>=26`. The repo pins Node 24 in `.nvmrc`:

```bash
nvm use
npm ci
npm start
```

Then open http://localhost:4200/.

## Scripts

| Command                    | Description                                                        |
| -------------------------- | ------------------------------------------------------------------ |
| `npm start`                | Dev server with live reload.                                       |
| `npm test`                 | Unit tests in watch mode. Add `-- --watch=false` for a single run. |
| `npm run build`            | Production build to `dist/angular-sandbox/browser`.                |
| `npm run build:pages`      | Production build with the `/angular-sandbox/` base href for Pages. |
| `npx prettier --check src` | Check formatting.                                                  |

## Deployment

Every push to `main` runs `.github/workflows/deploy-pages.yml`, which:

1. installs dependencies with the Node version from `.nvmrc`,
2. runs the unit tests,
3. builds with `npm run build:pages`,
4. copies `index.html` to `404.html` so deep links such as `/accordion` work on reload,
5. publishes the build with `actions/deploy-pages`.

The workflow can also be started by hand from the Actions tab. In the repository settings, **Pages → Source** must be set to **GitHub Actions**, and the `github-pages` environment must allow deployments from `main`.

If a deploy times out or is cancelled on GitHub's side, re-running it for the same commit fails with "Deployment cancelled", because Pages uses the commit SHA as the deployment ID. Push a new commit to `main` to deploy again.
