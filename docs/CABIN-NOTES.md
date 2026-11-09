# Husky Holiday 2026 cabin experiment

This is an editable copy of `../husky-holiday-experiment/`. Leave both that version and `../husky-holiday-site/` unchanged. This iteration runs separately at http://localhost:8082.

Desktop iteration: the complete tree corner now sits to the right of the fireplace. The camera moves down from the maps to the rules, then right to the prizes. The tree sits directly beside the right window and chair, rather than in a separate bay. The final stop retains its previous full-height framing and includes the hearth edge. The battle rifle gift sits on the shared floor between the chair and tree and is visible during the rules stop. Desktop and mobile now share that composition. Only camera framing changes below 700px. Reduced motion shows the room without camera animation and opens the full rules list.

## Experiment changes

- Ceiling Christmas lights repeat across the full room, including above the LAN table. The SVG viewBox follows the shared room width while bulb size and spacing remain fixed in scene units.

- Podium gifts are three rectangular boxes arranged second, first, third, with first centered beneath the tree. They are slightly smaller: gold first place at 240 × 240, red second place at 200 × 190, and green third place at 165 × 155 scene units. All three bases sit at y=920, centered inside the train track rather than on its near rail. The near-side train passes in front of the boxes; the far-side train passes behind them. All 17 small gift boxes now sit together inside the track, clustered below the prize tags. There are no small boxes outside the rails or separate foreground/background gift layers. The stack is far-side train at 2, podium boxes at 5, all small boxes at 6 and near-side train at 7. Tests check that every small box fits inside the track ellipse. The engine leads with a -1.1s animation offset, followed by the green carriage at -0.55s and the gold carriage at 0s. Each car's facing direction and depth use its own synchronized offset. The helmet and Warthog are separate, unlabelled decorative gifts. The battle rifle is unchanged. Second place has moved inward from x=65 to x=95, and third place from x=575 to x=550; first place stays at x=300. Their sizes and shared y=920 base stay unchanged. Two new local illustrations, `needler-gift.svg` and `plasma-pistol-gift.svg`, hang on small wall hooks beneath the Halo 2 poster, to the tree's left. The Needler sits above the plasma pistol at fixed 180 × 115 and 90 × 74 scene-unit sizes. The plasma pistol was redrawn against the user's reference with broad curved upper and lower shells, open muzzle jaws on the left, a slanted cyan energy bridge and a rear grip on the right. It is about half its first version's size, centered beneath the Needler. Partial wrapping leaves the Needler's pink crystal bank exposed; the pistol has only a small ribbon and bow on its grip so its basic outline stays visible. No extra labels or prize promises were added. Local illustrations `spnkr-gift.svg` and `gravity-hammer-gift.svg` show ribboned power weapons leaning against the wall between the tree and LAN table. The SPNKr was redrawn from the user's side-profile references with long silver tubes, a dark central receiver, grips and rear collar. Both SVG canvases include their complete rotated silhouettes. The SPNKr remains 210 × 385 scene units, with a green star-paper band and red bow. The hammer is now doubled to 420 × 706 scene units, with candy-cane wrapping along its shaft and a gold bow. Both lean beside the tree, clear of the LAN monitors. Dollar amounts remain inherited demo copy, not newly confirmed awards.

- LAN monitor artwork is clipped to the rounded inner screen bounds. Fixed-size wall decorations above the table include a framed Fuzion Frenzy cover and an illustrated wooden shelf. Shelf order from left to right is Halo ringworld snow globe, trophy, Master Chief helmet, Xbox game cases and trailing plant. The four game spines read Halo, Halo 2, Fuzion Frenzy and Soulcalibur II, each with its text centered on the label, including the leaning fourth case. The cover is a local copy of [Wikipedia's North American box art](https://en.wikipedia.org/wiki/File:Fuzion_Frenzy_Coverart.png), downloaded from `https://upload.wikimedia.org/wikipedia/en/9/96/Fuzion_Frenzy_Coverart.png`. This is copyrighted game artwork, not a freely licensed asset; rights remain with its owners. Review usage before publication.

- Desktop prize scene includes a four-player Halo LAN table in the unused right-hand space. `images/props/holiday-lan.svg` contains four Halo menu monitors, Series X-style consoles, controllers, wooden chairs, screen glow, garland lights, cocoa, cookies, a tabletop tree, headset, Santa hat, plaid textiles and a spare wrapped gift. The setup stays at a fixed 850 × 595 scene units, matching the wider desktop composition. Smaller viewports crop the right side instead of shrinking the furniture. It shares the existing room camera scale, without moving the tree or adding a scroll phase. Present at every viewport size. The phone camera crops this furniture rather than shrinking or repositioning it.

- Full-bleed cabin viewport, preserving the scroll camera and reduced-motion mode.
- One shared layout below and above 700px. No mobile gallery, prop shifts, gift scaling or 1200-unit floor extension. Phone framing pans across the original map wall at a closer zoom, framing at most 480 scene units wide and 580 high to keep the fireplace below the map shot. It visits each rule prop at a slightly closer zoom, framing at most 500 units wide and 820 high, then moves right to the tree and pans across the podium. The desktop artwork, fixed LAN size, rifle and gift proportions are unchanged.
- Separate camera framing for the mantel, fireplace, and tree reveal. The fireplace view caps its visible scene width at 1480 units so wide screens cannot expose the tree early. The desktop final shot pans right and opens up for the tree and presents; lower shots stay anchored to the floor.
- Woven hearth rug, depth-aware toy train, and Halo-shaped wrapped gifts.
- Six local map photographs, enlarged 25%, with a wider Ronin frame. The bottom row sits closer together, candles decorate the outer mantel ends, and the string lights hang in front of the frames.
- Translucent amber Drop Wall in place of the brass fire screen. Rudolph's nose stays steadily lit until the radar beat, then switches off. Scrolling backward restores the light. Reduced motion shows the final off state.
- Framed Halo 2 poster to the left of the tree. The local JPEG is cropped and straightened from the user's supplied poster photograph. Halo artwork belongs to its respective owners.
- Tree skirt and train track share a center. The near-side train passes in front of the gifts; the far side passes behind them.
- One red CTF flag is planted in a broad UNSC-style capture pedestal beside the hearth. Three captured blue flags sit in a small open olive equipment container, with a holly sprig on the rim. Local illustration `images/props/ctf-flags.svg` preserves the red/blue cloth, gold edging and emblems from the crossed-flags trial. Both objects rest on the floor in front of the hearth edge with tight contact shadows, not crossed floating poles. Evergreen garland spirals all the way from the red flag pole's tip to its socket and drapes over the UNSC stand's rim, with red berries and small gold accents. The hearth cookie plate is removed. The LAN table illustration is unchanged. A dark wooden mantel clock with steady amber `8:00` digits and a holly sprig replaces the kitchen timer, using `images/props/mantel-clock.svg`. The clock rests at the mantel's left end; the existing three candles are grouped at the right end so the maps remain unobstructed. Rule anchors follow the new props, and the desktop timer beat lifts the camera toward the mantel. Rules appear as five separate scroll beats in the confirmed order: flags, timer, friendly fire, radar, chair. Only one bubble appears at a time; tips clamp inside the viewport.

Map images for Corpo, Megapolis, Merchant's Square, Ronin, and Scarlett's Landing were copied from `../../website/v3/images/`. Yuletide is from [Halo's official Operation Infinite announcement](https://www.halowaypoint.com/news/infinite-operation-launch), image [yuletide_004](https://wpassets.halowaypoint.com/wp-content/2025/11/yuletide_004-1024x576.jpg). The announcement credits map creators Sikamikanico, bullet2thehead9, and Whos Blaze. These remain Halo game images; copying them does not transfer ownership.

## Original demo notes

The 2nd annual Husky Raid Holiday Tournament landing page: cozy-cabin look, Sanzo Wada palette No. 2 ("Tyrian Night"), falling snow, and a scroll-driven "room" that shows the maps, the house rules and the prizes.

Plain HTML, CSS and JavaScript. No build step, no dependencies.

## Run it

Open `index.html` in a browser. A local server is nicer, since some browsers limit `file://`:

```sh
python3 -m http.server 8082 --bind 127.0.0.1
# Open http://localhost:8082
```

## Files

| File | What's in it |
|---|---|
| `index.html` | All the markup. Most styling is inline because it was exported from a design canvas. |
| `styles.css` | Palette variables (`:root`), animations (bulb twinkle, candle flicker, fire, toy train), phone tweaks |
| `script.js` | Background snow, window snow, the scroll room camera, the reveal footer |

## Page order

1. **Header:** sticky and frosted. On phones, only the logo and "Join Discord" show.
2. **Hero:** "Husky Raid" with the 2nd-annual rosette, and the date-survey card.
3. **How it works:** four steps, plus scoring.
4. **The room** (`#room`): a pinned, scroll-driven scene.
   - **Mantel close-up:** the six maps (three hung, three standing).
   - **Fireplace rules:** flags, 8-minute timer, friendly fire off, radar off, then the sit-out chair. One bubble per scroll beat.
   - **Pan right to the tree:** prize boxes in second, first, third order, with separate Halo gifts and the LAN table beyond the tree.
   - A normal HTML disclosure after the cabin contains all rules, including no gear while carrying a flag and the idle command. It opens automatically for reduced motion.
5. **Volunteers:** stat authenticators.
6. **FAQ.**
7. **Footer:** reveals as the page scrolls off it.

## How the room works

- The scene is at least **4370 × 1000 scene units**, with the camera's left bound at x=1100 and the tree center at x=3080. The wrapper starts at x=80. Ultrawide framing can extend the right wall. This geometry is shared by phones and desktops.
- `script.js → room()` separates shared geometry from viewport-specific camera shots. Desktop map, hearth and tree framing retain the previous composition, except for a small upward camera move during the clock beat. Phone cameras crop the same artwork without modifying prop coordinates.
- Normalized progress maps to nine timeline units. Maps occupy 0–1, approach 1–2, flags 2–3, timer 3–4, friendly fire 4–5, radar 5–6, chair 6–7, tree reveal 7–8 and prizes 8–9. Each unit takes one sticky-stage height of scroll travel.
- Rules use semantic `data-rule` identities, not coordinate equality. `data-at` holds the shared scene anchor. Bubbles have a short entry fade, a reading hold and an exit fade. On phones the camera moves at the beginning of each beat.
- Rudolph's state is derived directly from timeline position, switching off at t=5. There is no one-way scroll trigger.
- The caption band has only a rule count and a link to the full rules while the bubbles play. The linked disclosure stays accessible outside the artwork's `role="img"` and outside the sticky timeline.
- Reduced motion removes scroll travel, shows a static room overview and all captions, hides animated bubbles, opens the readable rules list and disables decorative animation. A preference change takes effect on reload.

### Verification

With the site serving on port 8082:

```sh
node tests/verify-room.mjs
```

Requires Node with built-in WebSocket support and local Chrome. Set `CHROME_PATH` if Chrome is not at the default macOS path. The test checks shared prop coordinates, fixed LAN dimensions, asset loading, five visible rule beats, bubble bounds, transition exclusivity, reverse scrolling, radar boundaries, restored scroll on reload, live resize and reduced motion. Viewports include 320×568, 390×844, 430×932, 700×900, 1440×900 and 1920×900. Beat screenshots for 390px and 1440px are saved in the OS temporary directory as `husky-room-{width}-{beat}.png`.

Phone views intentionally crop the artwork. The short map and prize pans reveal their contents over the course of the scroll rather than fitting everything into one miniature overview. The LAN table remains beyond the tree; there is no separate LAN phase.

## To do

- [x] Connect both date-survey buttons to https://app.rallly.co/poll/H9KAVvkKt5yb.
- [x] Add all six map screenshots as local images, cropped to the existing frames.
- [ ] Confirm prize amounts and the bonus-award list. Confirm the Twitch URL (last year's site listed two different URLs).
- [x] Share desktop scene geometry with phones, using camera-only framing.
- [x] Verify all five sequential bubbles at 320×568, 390×844 and 430×932, reverse scroll, live resize and reduced motion.
- [ ] User review of mobile camera crops and scroll pacing.
- [ ] Phones: the hero rosette could sit a touch lower.
- [ ] Refactor: pull the repeated inline styles (frosted panels, pills, frames, gifts) into classes in `styles.css`.
- [ ] Optional: self-host the fonts (Fraunces, Nunito) instead of loading them from Google Fonts.
- [ ] Review the experiment before deciding what to merge or deploy. Do not replace the original demo or live site automatically.

## Credits

Palette: Sanzo Wada, *A Dictionary of Color Combinations*, combination No. 2. All illustrations are hand-built in HTML/CSS/SVG for this page.
