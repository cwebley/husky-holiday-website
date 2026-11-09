# Husky Holiday website

Static site for https://huskyholiday.win/. The 2026 page is at `/`. The original 2025 page is at `/2025/`, with no archive link on the current page.

## Repository layout

- `site/` is the complete public artifact. It requires no build step or package install.
- `tests/` contains artifact checks and local headless-Chrome browser suites.
- `docs/` contains implementation notes, inherited artwork references and the release checklist.
- `.github/workflows/pages.yml` publishes only `site/` through GitHub Actions after an approved push to `main` or manual workflow dispatch.

The 2026 implementation came from `2nd-annual/husky-holiday-swatchkit/` in the parent workspace. That source is unchanged. The 2025 archive came from commit `cd83b081fc077a36cadc4f89e19aa3cc950a2e75`, not the dirty poll-preview homepage. Archive files and both overlays have SHA-256 preservation checks in `tests/preserved-files.json`.

The streaming overlays remain at `/current-game-overlay.html` and `/standings-overlay.html`, with `/overlay.css`. They are preserved snapshots with inline tournament data, not live API clients. No backend is included in this release.

## Local preview

From this repository directory:

```sh
python3 -m http.server 8084 --bind 127.0.0.1 --directory site
```

Open http://127.0.0.1:8084/ or http://127.0.0.1:8084/2025/.

Never serve or publish the parent workspace. It contains private configuration, bot code and tournament data.

## Verification

Node 22 or later is required. The artifact check needs no server or browser:

```sh
node tests/verify-artifact.mjs
```

With `site/` served on port 8084:

```sh
SITE_URL=http://127.0.0.1:8084/ node tests/verify-room.mjs
PAGE_URL=http://127.0.0.1:8084/ node tests/verify-page.mjs
SITE_URL=http://127.0.0.1:8084/ node tests/verify-release.mjs
```

Browser suites use the installed Google Chrome through CDP, without npm dependencies. Set `CHROME_PATH` if it is not at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Screenshots go to the OS temporary directory or `/tmp` as printed by each suite. The room and page suites cover six screen sizes, reverse/restored scrolling, reduced motion, layout, disclosure controls, accessible text and scene regressions. Release checks exercise the actual root page, archive and both overlay URLs at phone and desktop widths, including failed network requests.

## Sharing metadata

The canonical URL and Open Graph/Twitter metadata live in `site/index.html`. The 1200×630 PNG is `site/images/social-card.png`. Edit `docs/social-card.html`, then regenerate it with:

```sh
node tests/render-social-card.mjs
```

The source template is not published. `/favicon.ico` wraps the existing helmet PNG for browsers that request the conventional favicon path, including on the unchanged overlays.

## Deployment

The user approved staging, committing, pushing and publishing this release, including switching Pages to GitHub Actions and enabling HTTPS enforcement. The workflow deploys on pushes to `main`.

Pages must use GitHub Actions rather than legacy publishing from the repository root. Do not switch back to root publishing with this layout, because that can expose repository files or serve a missing root homepage. Deployment results and live-site verification are reported separately after the workflow completes.

See [docs/RELEASE.md](docs/RELEASE.md) for the checks performed, backups, remaining review items and deployment order. [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) describes the cabin and accessibility implementation. Other inherited design notes are historical and do not override the release checklist.
