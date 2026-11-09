# Husky Holiday, Swatchkit edition

These implementation notes were copied from the finished Swatchkit source. In this release repository, public files live in `site/`, tests in `tests/`, and notes in `docs/`. Preview commands and relative paths below describe the original workspace. Use the repository `README.md` for current preview and test commands, and `docs/RELEASE.md` for confirmed copy and deployment status.

A separate copy of `../husky-holiday-mobile-v2/`, including the latest small plasma pistol. The original site and earlier experiments are untouched. This pass changes the document's CSS foundations and layout, not the cabin artwork or tournament content.

## Preview

Serve this folder on its own port:

```sh
cd 2nd-annual/husky-holiday-swatchkit
python3 -m http.server 8083 --bind 127.0.0.1
```

Open http://localhost:8083. No package install, framework, or build step is required. The previous v2 preview remains on port 8082.

## Styles

The HTML loads these files in order:

| File | Responsibility |
| --- | --- |
| `vendor/swatchkit.css` | Actual Swatchkit reset, fluid tokens, variables, element defaults and layout compositions |
| `theme.css` | Self-hosted variable fonts, cabin palette, project token overrides and artwork aliases |
| `styles.css` | Existing cabin artwork, animation, and reset boundary |
| `page.css` | Document typography, shared panels and buttons, composition settings, responsive layout and sticky footer |

`vendor/swatchkit/` contains the CSS blueprints copied from `/Users/cwebley/src/swatchkit/src/blueprints`, revision `3937eec236dc27a46f3bb31f9e744f0cb0add50e`, version 6.4.0. It does not load Swatchkit's pattern-library UI, placeholder utilities, or sample components. This page uses compositions and authored classes, so no utility generation is necessary. Nothing was added to or changed in the Swatchkit source repository.

The vendor entry preserves Swatchkit's cascade layers. The project styles are unlayered and override those foundations. `vendor/scoped-elements.css` wraps the unchanged upstream element stylesheet in `@scope (:root) to (#room)` to keep document SVG and typography defaults out of the cabin. The original `vendor/swatchkit/global/elements.css` remains available for comparison. To refresh the scoped file, wrap that source's contents in the same scope block. Modern browsers with CSS `@scope` support are required for those element defaults.

### Tokens and compositions

Use Swatchkit's `--step-*` fluid typography and `--space-*` fluid spacing tokens. The hero uses a project `--step-display` extension with the same formula and an 88–256 authored-pixel range. The upstream scale interpolates between 330px and 1350px, with rem floors and ceilings that respect browser font preferences. In `theme.css`, override the `--fluid-step-*-min/max` or `--fluid-space-*-min/max` inputs to tune the scale without rewriting its clamp formulas.

The project palette and font stacks live in `theme.css`. Existing cabin names such as `--ground`, `--accent`, and `--bulb-1` alias these tokens so the artwork retains its colors. Page component settings live in `page.css`; adjust them there rather than adding inline layout styles.

Compositions such as `wrapper`, `flow`, `cluster`, `repel` and `grid` come from the vendored source. Page classes configure their custom properties. The fixed-coordinate cabin is deliberately exempt from this document-layout refactor.

### Variable fonts

`fonts/` contains full variable TTF files from the Google Fonts repository:

- [Fraunces](https://github.com/google/fonts/tree/main/ofl/fraunces), normal and italic. Verified axes: weight 100–900, optical size 9–144, SOFT 0–100, WONK 0–1.
- [Nunito](https://github.com/google/fonts/tree/main/ofl/nunito), normal and italic. Verified weight axis: 200–1000.

Each family includes its SIL Open Font License. `theme.css` declares the actual weight ranges with `@font-face`, and font stacks are Swatchkit font tokens. No Google Fonts stylesheet or external font request is needed. Headings use normal CSS weights and automatic optical sizing rather than forcing the weight axis with `font-variation-settings`.

## Footer

`main` and `footer` are siblings. Main has an opaque page background and z-index 1. The footer has z-index 0 and `position: sticky; bottom: 0`. Scrolling main away uncovers the footer without a transform, scroll callback, measured spacer, or animation frame loop. The old `revealFooter()` JavaScript was removed. At widths up to 43.75rem, heights up to 45rem, or with reduced motion, the footer uses normal flow. This keeps its opening lines reachable when enlarged text makes it taller than the viewport. The header also uses normal flow in short windows so it cannot cover most of the reading area.

## Verification

With this folder serving on port 8083:

```sh
node tests/verify-room.mjs
node tests/verify-page.mjs
```

Both use local headless Chrome over CDP and Node's built-in WebSocket. No browser automation dependency is required. Override `CHROME_PATH` if Chrome is not at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. The room test also supports `SITE_URL` for comparison with another preview.

The room regression suite checks six viewport sizes, unchanged prop geometry, train depth and order, all five rule beats, caption and bubble bounds, the final LAN shot and readable winner plaque, reverse scrolling, resize, restored scroll and reduced motion. Page checks cover document layout, fluid sizes, font loading, links and disclosures, and CSS footer positioning. Screenshots go to the OS temporary directory.

## Accessibility

The scoring example labels each game visibly. Screen-reader text explains each result as a win or loss, its point change, and the total across four games. The visual score notation is hidden from assistive technology so it is not read as subtraction.

Visually hidden sections below the cabin provide stable level-two headings and text for maps and prizes. The shared house rules remain in a native expandable `details` panel for both sighted and screen-reader users. Reduced motion opens that panel by default. The entire animated caption band and cabin artwork are hidden from assistive technology to avoid duplication. The caption's rules link is removed from the keyboard tab order because its parent is hidden from assistive technology. Clicking it opens the shared panel and focuses its summary. Keyboard and screen-reader users can reach the panel's native summary directly. No scroll-driven live announcements or current-rule ARIA descriptions are used. A stable visually hidden section gives the 2025 winner and flag differential, equivalent to the decorative LAN plaque. There is no duplicate visible winner caption.

The room suite checks Chrome's accessibility tree for stable maps and prizes headings through forward and reverse scrolling. The page suite checks the spoken scoring explanations, keyboard disclosure behavior, and expanded rule content. These are browser accessibility-tree checks, not manual VoiceOver or NVDA testing.

## Later visual revisions

- The toy train is now a miniature Covenant convoy: one purple Wraith followed by two smaller Ghosts. The original rails, 16-second route, spacing delays, direction flips, depth switching and reduced-motion behavior remain. Artwork is in `images/props/toy-wraith.svg` and `toy-ghost.svg`, with visual references from Halopedia's Type-26 Wraith and Type-32 Ghost game-render galleries. Existing `.train` and `.trainbody` classes remain as animation hooks.
- Fireplace rule order is now clock, flags, friendly fire, radar, then sitting out. The expandable rules list matches that order.
- Captured blue flag poles now render between the container's rear rim and front lip, visibly entering the opening. Three holly sprigs sit fully on its front face, clear of the rim and handle.

- The Christmas tree's 18 baubles are replaced by nine UNSC-style frag grenades and nine Covenant-style plasma grenades, using reusable inline SVG definitions. Plasma ornaments have steady cyan halos and luminous markings. An upright split-blade energy sword replaces the star. Tree geometry, existing string lights, gifts and train placement are unchanged. All remain decorative and hidden from assistive technology. Visual references are recorded in `TREE-REFERENCES.md`.

- Needler and plasma pistol bows are now twice the size of their first enlarged revisions, at SVG scales 3.6 and 5 respectively. Their knots moved inward to keep the enlarged bows within their existing canvases. Weapon dimensions and scene positions are unchanged.
- The favicon is copied from `../../website/v3/images/favicon.png`. The same original helmet-and-Santa-hat artwork replaces the emblems on the red flag and all three blue flags. Its PNG is embedded inside `ctf-flags.svg` so the prop remains self-contained. The pedestal retains its UNSC lettering.
- The SPNKr is at z-index 1, behind both train layers, 2 and 7. Other train and gift depth rules are unchanged.
- Fireplace rules now use cream corner brackets with dark outlines instead of amber target dots. Each frame surrounds its actual prop and keeps a constant screen-space stroke as the camera moves. The flags frame surrounds the blue captured standards and container, not the red home flag. Captions sit above their frames and stay within viewport bounds.
- All five rule effects follow scroll position. The clock gives two small size pulses; blue flag cloth rises from inside the container; the Drop Wall expands from its floor hub; Rudolph's nose emits three expanding red rings that fade with distance, then softly flickers and fades off; cocoa steam curls upward during the chair beat. Pausing scroll holds the effect. Reversing, skipping and restoring scroll reconstruct the same state without entry timers. The camera route and prop coordinates are unchanged.
- Reduced motion shows raised flags, a deployed shield, an unlit nose and static cocoa steam. It hides the brackets and animated rule bubbles, keeps the clock still and opens the shared house-rules disclosure.
- The volunteer tally has a fifth diagonal mark, revealed through an animated SVG mask. Its eight-second loop holds the completed tally for about 5.7 seconds. Reduced motion shows all five marks without animation.

- Four stockings hang across the mantel with cuff names: GoodSport, TeamPlayer, HypeMan and GraciousRival. The four LAN monitors use the same gamertags, each followed by lowercase "ready" beside a green dot. They replace the two unnamed stockings, have no animation and add no rule beat. Cuffs and fabric mirror together around the same center, with unmirrored text so the names stay readable. Slim legs and shallow toes hang beneath the wide cuffs. Loops pin to the wooden mantel at scene-wrapper y=478, and the middle pair sit farther apart with toes facing away from the fire. Like the rest of the cabin artwork, they remain decorative and hidden from assistive technology.
- The friendly-fire caption and written rule call out "New this year." Radar uses "Radar: off," and the chair caption reads "Come and go as you please." In the written rules, "No equipment use while carrying the flag" starts on its own line beneath unlimited captures.

## Fireplace animation maintenance

`script.js`, inside `room()`, owns `effects(t)` and the active frame. The timeline is now `t = progress * 11`, with clock, flags, shield, radar and chair starting at 2, 3, 4, 5 and 6. Flag raising and shield deployment run from local progress .12 to .82, followed by a held final state. Radar holds its light through local progress .18, then flickers and fades off by .72. Its three concentric rings expand from radius 10 to 46 in SVG units, fade outward and disappear with the nose light. Ring phases follow scroll position, including reverse and restored scroll. Reduced motion hides them. Clock pulses and steam exist only during their own beats. The existing tree/prize pass stays at 7–9, then 9–10 pans to the LAN area and 10–11 holds. Each timeline unit still spans one stage height of physical scrolling, so the earlier beats keep their pacing. The caption band fades and collapses during the final pan; the winner information appears only on the plaque.

The animated flags and Drop Wall are inline SVGs in `index.html`, copied from the external artwork with prefixed IDs. Edit these inline copies for the cabin. `images/props/ctf-flags.svg` and `images/drop-wall.svg` remain static reference artwork and are no longer loaded by this scene. The captured cloth group moves independently inside the reusable flag definition. A clip at the container mouth and the front wall hide lowered cloth while poles remain in place. Paint order remains rear rim, standards, front wall, then holly. The shield field group scales from the projector while the hub stays visible.

`focusBounds` uses scene coordinates, including the artwork wrapper's 80px inset. Update these bounds if prop geometry changes. The room suite compares frames against rendered object bounds, samples initial/middle/final effects in both scroll directions, checks restored effects and reduced-motion states, and captures extra flag/shield state screenshots at 390px and 1440px in the OS temporary directory.

- LAN cocoa mugs now have shaded ceramic, highlighted handles and rims, cocoa surfaces, three marshmallows each, peppermint stirrers, static steam and stitched snowflake bands in red and green. They remain two instances of the reusable `#mug` definition in `images/props/holiday-lan.svg`.
- All 17 little wrapped gifts have cream $1 price tags representing bonus categories. Rear-row tags sit above their lids so front-row presents do not hide them. Main podium values, gift coordinates and train depths stay unchanged. The prize caption and stable text also identify the bonus awards as $1 each; the 17 illustrated gifts do not establish a final category count.
- The LAN SVG has 64 units of transparent left bleed so the first monitor's halo fades before the image edge instead of clipping. Its viewBox is `-64 0 1064 700`. The image is 904.4×595 at wrapper x=3345.6, compensating for the extra canvas at the original .85 artwork scale. The table and monitors remain at their original coordinates and sizes. Tests check both the compensated anchor and the halo bounds.
- The shelf trophy's star is replaced with a pale-gold, classic MLG-style tilted controller silhouette and looped cable. The trophy cup, handles, stem and base are unchanged. Artwork is the inline `data-trophy-emblem="controller"` group in `images/props/lan-trinket-shelf.svg`. Visual reference: https://seeklogo.com/vector-logo/326623/major-league-gaming. This is a hand-drawn single-color adaptation, not the full red/blue MLG badge or wordmark.
- Shelf game cases now have molded green edges, Xbox header bands, small lower labels and distinct spine colors. Titles are Halo: Combat Evolved, Halo 2, Fuzion Frenzy and Soulcalibur II. `images/props/lan-trinket-shelf.svg` owns that artwork. Tests check each title fits inside its own spine and capture separate shelf/LAN previews.

## Personalized weapon tags

The five weapon gifts have cream, italic handwritten-style tags tied to their bows: gravity hammer to Victory, SPNKr to scrof, Needler to Chan, BR to FourthString and plasma pistol to SDot. These are the user's personal associations, not weapon-stat awards.

Each original image sits inside a same-sized `.weapon-gift` wrapper in `index.html`. An inline `.weapon-gift-tag` SVG supplies the cord and label, with shared styling in `styles.css`. Visible SVG overflow lets SDot's tag hang directly below the small pistol without resizing its artwork. The launcher tag hangs to its left, clear of the podium and helmet. All tags inherit their weapon's depth, including the launcher's z-index 1 behind both train depths. The old BR75 paper label and hammer checkmark label were removed from their assets to avoid duplicate tags. Weapon geometry and enlarged bows remain unchanged.

These tags are decorative, static and hidden from assistive technology. The room suite checks exact pairings, one tag per weapon, text fit, original prop geometry and train depth. The desktop tree screenshot shows all five tags; the existing phone camera crops some wall gifts as before.

## Previous winner and LAN finale

A small dark-wood and muted-brass winners board above the LAN monitors has two rows: 2025, Victory is BACK, +17 flag diff.; and 2026, Your name here, with no score yet. The 2025 row uses the saved first-place entry from `../../api/data/session-summaries/session-summary-session_1765672193977.json`, under `tournamentStandings`. The 2026 row is an invitation, not a recorded result. No top-three list or tiny trophy inscription is added. The trophy remains on the shelf, which moved up from y=142 to y=110. The board is at wrapper coordinates 3700,365, sized 400×138, reduced from the original 500×150 plaque. Its center and the final camera shot are unchanged.

After the prizes, the camera visits the LAN area without a separate trophy zoom. Phones frame the full plaque and nearby stations, while desktop shows the full table. The plaque carries the visible information, with no winner caption above the scene. A visually hidden section supplies the equivalent stable heading and text for assistive technology. Reduced motion retains the static room overview and stable text alternatives.

The room suite checks plaque bounds and minimum rendered name/score sizes at six widths, a collapsed caption band, reverse travel, and a stable accessible winner heading. It captures `husky-room-{390|1440}-lan-winner.png` in the OS temporary directory.

## Cabin and content notes

See `CABIN-NOTES.md` for the inherited scene geometry, artwork sources, publication caveats, timeline and tournament-copy uncertainties. It is the v2 README captured before this refactor; its port 8082 instructions describe the original copy. `SWATCHKIT-NOTES.md` records the source audit and integration alternatives, not a list of files all used by this implementation.

Prize amounts, eligibility and some operational copy remain inherited demo content. The external guest-friendly date poll is preserved. No deployment or merge into earlier versions has been performed.
