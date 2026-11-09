# SwatchKit source audit and holiday-site integration

## Summary

SwatchKit 6.4.0 is a **CSS-first scaffolder + pattern-library generator**, not a prebuilt CSS framework import. Consume the real reset, element defaults, fluid tokens, compositions, and generated utilities by scaffolding into a project-owned CSS tree, running the generator, and linking its `main.css` entry (with its complete import tree) or a bundled version from the static site's HTML. Font stacks are tokens only: **SwatchKit supplies no font files, font loading, variable-axis configuration, or `@font-face` declarations**.

Audit source root: `/Users/cwebley/src/swatchkit` (all SwatchKit paths below are relative to this root). Read the full README, token reference, hand-rolled integration guide, CSS blueprints, templates and relevant generator/build code. No SwatchKit source was modified; `git status --short` was empty after the experiment. Only this notes file was added to the holiday site.

## 1. Actual CSS sources, not a look-alike theme

- `package.json`: version 6.4.0; CLI is `build.js`; published files include `src/`, `docs/`, and `build.js`. There is no package CSS export such as `swatchkit/base.css`.
- `src/blueprints/main.css`: canonical CSS entry. Layer order is `reset, tokens, elements, compositions, swatches, app, utilities`.
- `src/blueprints/global/reset.css`: box-sizing, margin reset, responsive images, inherited form fonts, heading balance, scroll margin, etc. It disables automatic text-size inflation; test phone accessibility rather than assuming browser defaults remain unchanged.
- `src/blueprints/global/tokens.css`: authored colors, font stacks, weights, leading, full fluid type/space scales, and viewport documentation tokens.
- `src/blueprints/global/variables.css`: `--gutter: var(--space-m-l)`, `--measure: 65ch`, transition timings, borders and radii.
- `src/blueprints/global/elements.css`: real body defaults, headings, lists, tables, form controls, focus-visible, SVG defaults, details/summary and media styling. Body uses `--step-1`, `--font-base`, `--leading-standard`; headings h1/h2/h3 use steps 6/5/4. This is substantial global CSS, not just a reset.
- `src/blueprints/compositions/index.css`: imports eight actual layout primitives.
- `src/blueprints/utilities/index.css`: imports generated `utilities.css` plus `visually-hidden.css` and `region.css`.
- `src/blueprints/utilities/utilities.css`: **placeholder only in the package source**. A build replaces the project copy with actual generated rules. Simply copying the blueprint and calling it “generated CSS” would omit the utilities.
- `src/blueprints/swatchkit-ui.css` and `swatchkit-preview.css`: documentation-only chrome. Do not load these in the tournament page.

The correct browser entry is `main.css`; loading only tokens or the generated utility file does not load the reset, global elements, compositions, or layer declaration. `cssCopy: true` copies the tree but **does not bundle** imports. Keep every imported file at its relative location if deploying the copied tree directly.

## 2. Verified build, isolated from the original repository

I ran the following against the installed local source, from a fresh temporary working directory:

```sh
T=$(mktemp -d /tmp/husky-swatchkit-research.XXXXXX)
cd "$T"
node /Users/cwebley/src/swatchkit/build.js init --cssDir ./src/css
node /Users/cwebley/src/swatchkit/build.js
```

Actual artifact directory: `/tmp/husky-swatchkit-research.a3P6Qm` (macOS resolves it to `/private/tmp/...`). The build succeeded, generated seven token documentation files and 18 preview pages. Artifacts:

- `src/css/global/{reset,tokens,variables,elements}.css`: real scaffolded source.
- `src/css/utilities/utilities.css`: **15,621 bytes of actual generated utility CSS**.
- `dist/swatchkit/css/main.css`: 2,254-byte copied entry, still containing imports.
- `dist/swatchkit/css/`: complete deployable CSS tree, including the generated utilities.
- `dist/swatchkit/index.html` and `preview/`: generated pattern library, not the tournament page.

Examples verified in the generated file:

```css
.color\:color-dark { color: var(--color-dark); }
.background-color\:color-dark { background-color: var(--color-dark); }
```

Use an unescaped colon in HTML: `class="font-size:step-1 font-weight:weight-bold"`; escape it only when writing a CSS selector. Utilities reference custom properties, so runtime theme overrides work.

**Build-side effects:** `build.js` regenerates `<cssDir>/utilities/utilities.css` and `<input>/tokens/*.html` even with `cssCopy: false`. Therefore never point `cssDir` or `input` at the original SwatchKit repository. The output directory is cleaned/rebuilt: never set `outDir` to the existing holiday-site directory. Sources: `build.js` build routine around lines 1530–1625; `src/generators/index.js`; `docs/tokens.md`.

## 3. Concrete recommended integration into this static site

Keep existing HTML, script and artwork. Do **not** use `init --app` here: its starter app/page generation is unnecessary for an existing static document. Scaffold in an empty scratch/project directory, then bring the generated CSS and optional pattern sources into this site's own directories.

Suggested layout inside `2nd-annual/husky-holiday-swatchkit/`:

```text
index.html
script.js
styles.css                     # existing scene styling; migrate incrementally
css/
  main.css                     # actual scaffold entry
  global/{reset,tokens,variables,elements}.css
  compositions/*.css
  utilities/{index,utilities,region,visually-hidden}.css
  swatches/*.css
  holiday-theme.css            # owned theme additions
  fonts.css                    # only if self-hosting
swatchkit/                     # optional pattern source, including layouts
swatchkit.config.cjs
fonts/                         # licensed, verified variable fonts if self-hosting
```

For the quickest working integration, copy the **entire** temporary build's `dist/swatchkit/css/` tree into this site's `css/`, then edit the owned tokens/theme and rebuild utilities whenever token names/blocks change. This gives real generated CSS immediately, with no runtime tooling. No such copy has been performed by this audit.

Change the document head to link the actual entry before the existing scene rules:

```html
<link rel="stylesheet" href="css/main.css">
<link rel="stylesheet" href="styles.css">
```

This staged approach leaves existing unlayered scene rules stronger than layered defaults, reducing disruption. It also means utilities **cannot** override conflicting unlayered rules or inline styles. Long term, move scene/application rules into the `app` layer and remove inline typography/layout declarations where compositions or utilities should control them. Do not pile on `!important` to fight the current design-canvas markup.

For maintainable local generation (config relative to this site's directory):

```js
// swatchkit.config.cjs — works regardless of parent package's ESM mode
module.exports = {
  input: './swatchkit',
  outDir: './generated/swatchkit',
  cssDir: './css',
  cssCopy: true,
  tokenSources: ['./css/global/tokens.css', './css/holiday-theme.css'],
  order: { sections: ['tokens', 'compositions', 'swatches', 'utilities'] }
};
```

Run `node /Users/cwebley/src/swatchkit/build.js --config ./swatchkit.config.cjs` **with this site as cwd**. That generates utilities in this site's `css/`, never in SwatchKit. `cssCopy: true` is simplest for a separate, self-contained library. Alternatively, if deploying the library at `swatchkit/` next to the site's `css/`, set `cssCopy: false, cssPath: '../css/'`; separately copy the docs UI/preview CSS since `main.css` does not import them. `explicitHtmlLinks: true` is available for static servers that do not resolve directory indexes.

For a single production bundle, use the official esbuild pattern (`src/templates/app/scripts/build-assets.js`, `docs/app-setup-handrolled.md`):

```js
await esbuild.build({
  entryPoints: ['css/main.css'],
  bundle: true,
  outfile: 'assets/swatchkit.css',
  minify: true,
  loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' }
});
```

Then link `assets/swatchkit.css`, not also `css/main.css`. Order is **generate utilities first → bundle second → deploy CSS plus emitted assets**. No bundle was produced during this audit; the copied import tree was actually generated and verified. Avoid the guide's simplistic concat appendix: concatenating index files without resolving nested imports and layer assignments is not equivalent to the canonical entry.

### Theme wiring

Add this import near the other token imports at the top of project-owned `css/main.css`, after `global/variables.css`, before regular rules:

```css
@import "holiday-theme.css" layer(tokens);
/* Optional self-hosted font definitions: */
/* @import "fonts.css"; */
```

Suggested theme fragment (preserves original site palette; not SwatchKit defaults):

```css
:root {
  --ground: #12354e;
  --accent: #f99d1b;
  --muted: rgb(255 247 234 / 74%);
  --color-light: #fff7ea;
  --color-dark: #0b1110;
  --color-primary: var(--accent);
  --font-base: "Nunito", system-ui, sans-serif;
  --font-display: "Fraunces", Georgia, serif;
  --wrapper-max-width: 1200px;
}
```

In `@layer app`, explicitly apply dark-theme body styling (`background: var(--ground); color: var(--color-light)`) and display heading fonts. The element blueprint assumes a light page and uses `--color-light` for background / `--color-dark` for text; don't blindly swap those semantic values because the same properties also affect selection, controls, code and media. Retain the existing `--glass`, bulb and artwork tokens as needed. Place new documented font/color tokens in `@swatchkit` blocks; plain overrides outside blocks still work at runtime but don't create new utility classes.

## 4. Fluid typography and spacing: actual configuration

Source: `src/blueprints/global/tokens.css`; full mathematical contract in `docs/tokens.md`.

- Shared unitless settings: `--vw-min: 330`, `--vw-max: 1350`, `--root-base: 16`.
- Type steps `--step--2` through `--step-6`; each has `--fluid-step-<n>-min/max` inputs and an explicit `clamp()` using rem bounds plus viewport interpolation.
- Examples at default root size: `--step-0` = 15→18 px, `--step-1` = 16.88→21.6 px, `--step-6` = 30.41→53.75 px over the configured viewport interval.
- Space tokens: xs, s, m, l, xl, 2xl, 3xl, 4xl and s-l, xs-l, m-l, s-m, 2xl-4xl. For example `--space-m-l` = 21→40 px and `--space-2xl-4xl` = 56→120 px.
- Configure public token **inputs**, not an imaginary JS fluid generator: override `--fluid-step-1-min: 18; --fluid-step-1-max: 21;`, then consume `font-size: var(--step-1)`.
- Keep inputs unitless and outside token blocks. Keep `--root-base: 16` unless changing the authored numerical base; it is not a browser font-size detector. Do not force the HTML root to a fixed pixel size.
- Updating existing inputs needs no generator run for browser behavior. New/renamed token declarations or block-output settings need a rebuild to update docs/utilities.
- Hero currently spans 88→256 px; SwatchKit's largest default step is much smaller. Add a dedicated documented `--size-hero` clamp with rem bounds, or a new min/max pair and corresponding clamp, instead of stretching every heading or pretending step 6 matches the hero.
- Viewport tokens include units (`--viewport-mid: 760px`) and are documentation-only; they are distinct from unitless `--vw-*`. CSS variables do not work in standard media-query conditions.

## 5. Compositions worth using, and exact controls

All sources: `src/blueprints/compositions/<name>.css` (demos at `src/templates/compositions/<name>/index.html`).

| Composition | Real behavior / holiday use |
|---|---|
| `.wrapper` | centered, max width `--wrapper-max-width` (1360px default), inline gutter. Use for nav and text sections; set 1200px for current site. |
| `.flow` | `> * + *` margin using `--flow-space` (1em fallback). FAQ answers, heading/body stacks. |
| `.cluster` | wrapping flex, `--gutter`, horizontal/vertical alignment variables. Nav links and CTA group. |
| `.repel` | wrapping flex with space-between; `--repel-vertical-alignment`; `[data-nowrap]` disables wrapping. Header brand vs navigation. |
| `.switcher` | flex switches at `--switcher-target-container-width` (40rem); five or more children always stack. Two-column intro/details, not a many-card gallery. |
| `.sidebar` | first child sidebar by default, target 20rem; last child main min 50%; `data-direction="rtl"` swaps sizing, `data-reversed` reverses flow. Useful for details/schedule. |
| `.grid` | auto-fill minmax, `--grid-min-item-size: 16rem`, `--grid-placement`; 50-50 and thirds data layouts. Map cards. Set `--grid-min-item-size: min(100%, 16rem)` locally if the container can be narrower than the minimum. |
| `.prose.flow` | reading rhythm, constrained text, heading wrapping, table/media spacing; useful for full rule reference. |

`.region` is a utility, not a composition; padding uses `--region-space`, fallback `--space-m`. Its `[data-disable-space-top]` rule is empty in this source; do not assume that attribute works.

Use compositions for document flow, **not** the fixed-coordinate room/scene artwork. Preserve `data-scene` camera coordinates and animation hooks. Remove conflicting inline display/gap/width styles when adopting composition classes.

## 6. Variable fonts: explicit configuration required

Verified absence: searching `src/`, README and docs found font-stack tokens and font asset loaders, but no supplied `@font-face`, font binaries or axis API. `fonts` token blocks only generate `.font-family:<token>` and documentation; `text-weights` generates weight utilities. `src/generators/index.js` implements these directly.

The current site's `index.html` requests Fraunces with a continuous `opsz` range but selected weights (600/800/900 normal and 600 italic), and Nunito with selected weights (400/600/700/800). That URL is **not** a request for a continuous weight range. For genuinely variable-weight hosted loading, use a range request, then verify returned CSS and actual network fonts in the target browser:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&amp;family=Nunito:wght@200..1000&amp;display=swap">
```

This is a proposed configuration, **not a fetched/verified font response**. For self-hosting, obtain licensed variable WOFF2 files and verify their supported axes/ranges, then define them explicitly (example assumes the downloaded files actually cover these ranges):

```css
/* css/fonts.css; paths resolve relative to this CSS file */
@font-face {
  font-family: "Nunito";
  src: url("../fonts/nunito-latin-variable.woff2") format("woff2");
  font-style: normal;
  font-weight: 200 1000;
  font-display: swap;
}
@font-face {
  font-family: "Fraunces";
  src: url("../fonts/fraunces-latin-variable.woff2") format("woff2");
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: "Fraunces";
  src: url("../fonts/fraunces-latin-italic-variable.woff2") format("woff2");
  font-style: italic;
  font-weight: 100 900;
  font-display: swap;
}
```

Use `font-weight` and `font-style` normally; apply `font-optical-sizing: auto` to Fraunces headings. Do not set a fixed `font-variation-settings: "wght" ...` globally: it can override semantic weight selection. Optional custom axes need verified font metadata before using them. Match only actual shipped ranges; do not label static files variable. Preserve italic loading if retaining the page's italic text. A `fonts` token alone never downloads a font.

With a browser import tree, deploy `fonts/` at the path above. With esbuild, its file loaders emit/rewrite font URLs: deploy those emitted files too. Google-hosted fonts need links in both project-owned pattern templates (`swatchkit/_swatchkit.html`, `_preview.html`) as well as the main page, otherwise previews use fallback fonts. Self-hosted `@font-face` imported by shared main.css avoids that duplication. `HEAD_EXTRAS` is a template placeholder, not a documented font config option.

## 7. Regression checks and remaining gaps

- Existing document is dominated by inline CSS: linking SwatchKit alone cannot demonstrate token-driven type or composition layouts. Refactor selected text/content blocks deliberately.
- Reset/global CSS can alter heading margins, SVG sizing (`svg:not([class]) { height: 1lh }`), table/form styling and focus outlines. Inline SVG heights often win here, but audit all decorative SVGs and mobile layouts.
- Verify 330px, 640px, 760px, 1350px, 200% zoom, increased default text size, keyboard focus, reduced motion, and horizontal overflow. Keep the existing reduced-motion logic for scene animation; the reset does not replace it.
- Serve over HTTP and inspect CSS/font requests from both site and nested preview URLs. Check computed font family/weight, fluid sizes and layer assignments.
- Source findings and temporary generator run are verified. No visual browser regression test, font download/metadata inspection, remote font response verification, or esbuild bundling was performed. No production CSS, HTML or font integration was applied; this deliverable is the requested implementation brief.

## Follow-up: approved no-generator vendoring, verified font sources, cabin isolation

**The proposed no-generator integration is valid:** vendor `global/{reset,elements,tokens,variables}.css` and compositions under `vendor/swatchkit/`, import those in layers from `vendor/swatchkit.css`, and apply project-owned `theme.css`. Fluid tokens are authored CSS, so no generator is needed unless you want generated utility classes or token docs. Do not import the placeholder generated utilities and claim they're functional. Keep all nested composition imports and the original source provenance.

### Reliable self-host font sources (web-verified)

1. **Google Fonts source of truth:**
   - Fraunces directory: https://github.com/google/fonts/tree/main/ofl/fraunces
   - Exact normal filename: `Fraunces[SOFT,WONK,opsz,wght].ttf`; italic: `Fraunces-Italic[SOFT,WONK,opsz,wght].ttf`.
   - Metadata confirms weight **100–900**, optical size **9–144**, `SOFT` **0–100**, `WONK` **0–1**: https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/METADATA.pb
   - Nunito directory: https://github.com/google/fonts/tree/main/ofl/nunito
   - Exact normal filename: `Nunito[wght].ttf`; italic: `Nunito-Italic[wght].ttf`.
   - Metadata confirms weight **200–1000** (not 200–900): https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/METADATA.pb
   - Use GitHub Raw/download links, not HTML blob pages. Pin a repository revision if using these as reproducible build inputs. TTF is usable with `format("truetype")`, but WOFF2 is preferable for delivery.

2. **Ready-to-host, version-pinned WOFF2 via Fontsource:**
   - Recommended Fraunces normal **full-axis** Latin file: https://cdn.jsdelivr.net/npm/@fontsource-variable/fraunces@5.2.9/files/fraunces-latin-full-normal.woff2
   - Recommended Nunito normal Latin file: https://cdn.jsdelivr.net/npm/@fontsource-variable/nunito@5.2.7/files/nunito-latin-wght-normal.woff2
   - Download those public files into your own `fonts/`; the CDN is a distribution source, not a runtime dependency.
   - Verified source CSS for Fraunces full: https://cdn.jsdelivr.net/npm/@fontsource-variable/fraunces@5.2.9/full.css
   - Verified source CSS for Nunito: https://cdn.jsdelivr.net/npm/@fontsource-variable/nunito@5.2.7/index.css
   - **Important:** Fraunces `index.css` references `*-wght-normal.woff2`; use `full.css` / `*-full-normal.woff2` to retain optical-size and custom axes rather than assuming the weight-only build contains them. The exact axis tables of the binary were not inspected in this audit.
   - Fontsource's CSS family names are `Fraunces Variable` and `Nunito Variable`. When writing your own `@font-face`, name them `Fraunces` and `Nunito` to preserve the current HTML/CSS; when copying Fontsource's declarations verbatim, update all family references instead.
   - Latin subset CSS includes basic Latin, smart punctuation U+2000–206F, euro, trademark, etc.; check actual site glyph coverage before excluding Latin-ext. Obtain italic counterparts if the page uses actual italic text; normal and italic are separate files, not one `ital` axis binary.

3. **Licenses:** Google metadata declares both OFL. Fraunces's actual license was read: https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/OFL.txt — SIL Open Font License **1.1**, permits self-hosting/embedding/redistribution, requires preserving copyright and license with distributed font copies, prohibits selling fonts alone, and has Reserved Font Name conditions for modified fonts. Obtain Nunito's corresponding https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/OFL.txt alongside its download (that exact license body was not separately fetched). Ship `fonts/Fraunces-OFL.txt` and `fonts/Nunito-OFL.txt`, record download version/source, retain notices from the font distribution. Do not apply the site's code license to the fonts.

Recommended declarations in project-owned theme.css (relative URLs assume theme.css at the site root):

```css
@font-face {
  font-family: Fraunces;
  src: url("fonts/fraunces-latin-full-normal.woff2") format("woff2");
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: Nunito;
  src: url("fonts/nunito-latin-wght-normal.woff2") format("woff2");
  font-style: normal;
  font-weight: 200 1000;
  font-display: swap;
}
h1, h2, h3, .display { font-optical-sizing: auto; }
```

Keep `font-weight` semantic; don't globally freeze the `wght` axis. Avoid overriding `SOFT`/`WONK` unless intentionally changing the design. Remove Google Fonts links after local loading is confirmed, and optionally preload just the above-the-fold Fraunces file with `as="font" type="font/woff2" crossorigin` (same-origin font preloads still need crossorigin).

### Cabin/scene isolation from global elements

**Do not use `all: initial` or `all: revert` across the cabin.** They would reset positioning/display/inheritance that the artwork depends on. `isolation: isolate` creates a stacking context, not CSS isolation; add it only if changing z-index behavior is intended. A shadow root would isolate CSS but is a disproportionate rewrite and changes selector/JS behavior.

The best surgical override is **`revert-layer`**, provided the scene exceptions live in the **same `elements` layer** as the imported global elements. This removes those element-layer declarations and exposes the original reset/UA/attribute styling rather than replacing the scene's inline styles:

```css
/* In theme.css, after vendor/swatchkit.css has established its layers. */
@layer elements {
  /* .cabin-art must wrap only the illustration, not prose/nav/FAQ content. */
  .cabin-art svg:not([class]) {
    width: revert-layer;
    height: revert-layer;
  }
  .cabin-art svg[role="img"][width][height] {
    width: revert-layer;
    height: revert-layer;
    background: revert-layer;
    padding: revert-layer;
  }
}
```

**Do not put these `revert-layer` rules in the later `app` layer**: that would reveal, rather than cancel, the earlier elements layer's `height: 1lh`. `revert` is an alternative in a later layer when UA/attribute defaults are explicitly desired, but it rolls back the whole author origin for that property and may discard other authored stylesheet sizing. Inline sizing still wins ordinary stylesheet rules.

The current artwork already sets many SVG dimensions inline; leave those authoritative. For SVGs lacking explicit `height` but relying on viewBox scaling, use a named class and explicit `height:auto` / intended width rather than trusting intrinsic defaults. Adding a class avoids `svg:not([class])` entirely, but not the `svg[role="img"][width][height]` rule, which must still be considered. If using `[data-scene]` instead of `.cabin-art`, keep scope limited to the illustration; the rosette in the hero is outside that selector and needs its own class/check.

Other reset effects to review inside artwork: universal `box-sizing:border-box` changes bordered geometry; global `img,picture` become block/max-width, and `picture` gets width:max-content. Do not turn off border-box everywhere blindly—first compare against the scene's original sizing. On known affected scene images/pictures only, same-layer `revert-layer` exceptions for `display`, `width`, `height`, `max-width` can remove global-element changes; reset-layer rules require separate decisions. Preserve existing `data-scene` transforms, camera viewport, absolute coordinates, JS hooks and reduced-motion rules.

**Verification gap:** font CSS, upstream metadata and Fraunces license were fetched successfully; actual font binaries, italic Fontsource URLs, Nunito license body and browser rendering were not fetched/tested. Fontsource install-page search snippets understated Nunito's maximum weight, so prefer the actual source CSS plus upstream metadata above.

## Implementation chosen

The final integration uses **actual vendored SwatchKit foundations without running the generator**:

- `vendor/swatchkit.css` establishes cascade layers and imports the vendored reset, tokens, variables, scoped element defaults, and compositions. No generated token utilities or pattern-library UI CSS are required or included. Compositions and fluid scales are ordinary authored CSS and work directly without generation.
- `scoped-elements.css` wraps the original global element rules in `@scope (:root) to (#room)`, excluding the room boundary and its descendants from those selectors, notably the classless-SVG `height: 1lh` rule. Global reset rules and inherited properties remain applicable; this is not complete style isolation.
- `theme.css` owns site-specific token overrides and self-hosted font-face declarations. Full variable TTF files for Fraunces and Nunito, normal and italic styles, plus their licenses, were obtained from the Google Fonts repository. These replace the need for runtime Google Fonts loading.
- `page.css` contains application/page styling, separate from the vendored foundations and theme.

Earlier sections describe research alternatives, not additional implementation requirements: **neither a generator nor generated utilities are needed to consume the reset, global defaults, fluid tokens or compositions**. The original `/Users/cwebley/src/swatchkit` files remain untouched. This follow-up edits only this notes file; it does not implement or verify the integration itself.
