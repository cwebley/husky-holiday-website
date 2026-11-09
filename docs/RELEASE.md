# Release preparation

## Local status

Preparation and local verification are complete. The user subsequently approved staging, committing, pushing and publishing, including switching Pages to Actions and enabling HTTPS enforcement. This document records the pre-deployment checks and intended deployment order, not a claim that the deployment has completed.

User decisions for this release:

- Publish only `site/` using GitHub Actions.
- Put the finished 2026 page at `/` and the committed original 2025 page at `/2025/`.
- Keep the archive unlinked. It is public, not access-controlled. No sitemap or archive announcement was added.
- Keep current event details, confirmed during preparation: poll weekends of November 26, December 4 and December 11; $50/$25/$10 prizes, $1 bonus awards, 5 games for prize eligibility; existing poll, Discord and Twitch links.
- Publishing was initially withheld, then explicitly approved after the local preview review.

## Backups and provenance

Full pre-change backup: `/tmp/husky-release-backup.nJpX1S/`.

- `husky-holiday-swatchkit/` is the finished 2026 source before release preparation.
- `website-v3/` includes the complete website repository and its Git directory, dirty homepage, untracked overlays and preview stylesheet.
- `website-working.patch` also records the tracked working-copy diff.

The parent workspace, older experiments, bot and tournament data were not modified. The discarded poll-preview homepage and `preview.css` are in the backup, not the public artifact. Copy this backup to durable storage before relying on it long-term. OS temporary storage can be removed.

Archive source is commit `cd83b081fc077a36cadc4f89e19aa3cc950a2e75`. All archived HTML, CSS and images are unchanged. Relative paths work beneath `/2025/`. Overlay HTML and CSS are also unchanged. `tests/preserved-files.json` checks their exact bytes. Inspection found inline snapshot data and no active fetch/WebSocket endpoint in either overlay. Do not assume that these are live 2026 standings.

## Hosting inspection

Read-only `gh api repos/cwebley/husky-holiday-website/pages` reported:

- Current build type is `legacy`, branch `main`, source `/`.
- Custom domain is `huskyholiday.win`.
- Certificate state is `approved`, with `huskyholiday.win` and `www.huskyholiday.win` listed.
- HTTPS enforcement is currently off.

These observations were recorded before the approved hosting changes. They do not verify DNS or both live year paths after deployment. `site/CNAME` retains the existing custom domain. The prepared Actions workflow uploads only `site/`; it does not publish docs, tests or the parent workspace.

## Verification results

All run against the actual `site/` publication folder on local port 8084:

- Artifact check passed for 67 public files, including local HTML/CSS/SVG references, sharing-image dimensions, canonical URL, unlinked archive and preservation hashes.
- Room suite passed at 320, 390, 430, 700, 1440 and 1920 pixels, plus reduced-motion checks at 390 and 1440 pixels. Includes personalized tags, train depth, fireplace effects, accessible content and LAN winner finale.
- Page suite passed at the same six widths, plus enlarged-text, short-window and reduced-motion footer cases. No JavaScript exceptions or console errors.
- Release smoke suite passed on `/`, `/2025/`, `/current-game-overlay.html` and `/standings-overlay.html` at 390 and 1440 pixels. All images loaded, styles applied, and no failed network requests or JavaScript exceptions remained.
- An initial release check found an automatic `/favicon.ico` 404 from the unchanged overlays. Added a conventional icon using the existing PNG and reran successfully.
- Visually reviewed the generated share card and phone archive screenshot.
- Poll URL responded HTTP 200. Discord API resolved invite `SuCNdEVJbf` to `G's Husky Holiday`. Event links were confirmed by the user. Poll submission and Twitch playback were not exercised.

Chrome only. No cross-engine suite or manual screen-reader testing was performed. Accessibility-tree checks are not a substitute for VoiceOver/NVDA verification. Existing artwork and accessibility behavior were preserved, not redesigned.

## Remaining review before publication

- Review the local preview and share image.
- Review copyrighted Halo imagery, Fuzion Frenzy cover and the adapted controller emblem. Source notes identify these as third-party artwork; this work does not establish publication rights.
- Confirm that preserving the old snapshot overlay data at the existing URLs is still desired for production.
- Review the Git diff, including untracked files. Ordinary `git diff --stat` omits the new `site/` files until they are staged. Nothing has been staged during preparation.
- Preserve the safety backup somewhere durable if the dirty poll preview will be needed later.

## Approved deployment sequence

1. Obtain explicit approval to commit, push and publish. A push to `main` runs the prepared deployment workflow.
2. Switch GitHub Pages build source from legacy branch publishing to GitHub Actions before pushing this reorganization. Leaving legacy root publishing active can expose repository files or serve a missing root homepage.
3. Commit and push only this website repository. Do not initialize Git or publish from the parent workspace.
4. Check that the Pages workflow passes the artifact check and publishes `site/` with the custom domain retained.
5. Enable HTTPS enforcement after confirming the certificate/domain remain valid. This is a hosting setting change and requires approval.
6. Verify HTTPS, `/`, `/2025/`, sharing image, favicon, both overlays and all assets on the public domain. Verify that HTTP redirects to HTTPS once enforcement is enabled. Check canonical/sharing metadata and Discord/poll/Twitch destinations.
7. If rollback is necessary, restore the prior publication from commit `cd83b08` with its original layout and compatible Pages source. That restores the committed 2025 site, not the dirty 2026 poll preview. Do not publish the backup directory or Git metadata.
