# Stable mobile cabin height

The cabin uses an invisible `100svh` measurement instead of `window.innerHeight` for its available height after subtracting the site header. Stage height, camera framing and scroll distance share that measurement. Showing or hiding mobile browser controls should no longer resize the scene or move the scroll timeline.

Resize events still run layout. A ResizeObserver watches the measurement so rotation and other real small-viewport changes update the layout. Browsers without `svh` support retain the previous `innerHeight` behavior. Existing minimum stage heights remain unchanged, including their cropping behavior in very short landscape windows.

When browser controls hide, the cabin does not expand into the newly visible space. The page background or following content can show below it. The user approved this behavior after comparing the local `/test13/` experiment on a phone.

The homepage script URL has a new cache version. No artwork, camera coordinates, captions, gesture handling or timing changed.

## Regression check

With the site served locally:

```sh
SITE_URL=http://127.0.0.1:8084/ node tests/verify-stable-viewport.mjs
```

This checks five screen sizes, toolbar-dependent `innerHeight` changes with stable native `svh`, visible-area resizes with a fixed simulated small viewport, native viewport changes, forward/reverse scrolling, skip navigation, reduced motion and browser/network errors. Desktop headless Chrome does not reproduce the Android browser toolbar itself.

The other release checks remain `verify-artifact.mjs`, `verify-room.mjs`, `verify-page.mjs`, `verify-release.mjs`, `verify-cabin-progress.mjs` and `verify-cabin-gestures.mjs`.
