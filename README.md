# Satisfying Lab

A colorful browser physics playground built with Three.js and Rapier. All rendering and simulation run locally in the browser. There is no game backend or account requirement in the application itself.

## Play locally

From this folder, run `node server.mjs` and open http://127.0.0.1:4173/. Node.js 22 or later is recommended. The complete, prebuilt game is already in `dist/`; no installation is needed to serve that directory.

For another local port, set the `PORT` environment variable before starting the server. Use an HTTP server, rather than opening index.html as a file, because JavaScript modules require HTTP delivery.

## Experiments

- **Tower Smash:** solid, hollow, pyramid, and wall layouts; adjustable width, depth, height, and cube size. Aim by clicking the tower, then launch a ball. Ball diameter, mass, and launch speed are independent.
- **Marble Garden:** an ongoing cascade through a pegboard, a moving paddle, and collection channels. Adjust the marble size, flow rate, and paddle speed.
- **Domino Studio:** a spiral chain with adjustable count, spacing, and initial push.
- **The Tumbler:** a rotating drum containing marbles, cubes, or a mixture. Control direction, speed, starting fill, and object size.
- **Magnet Playground:** a movable artistic attraction/repulsion field. Click the tray in Aim mode to move it. This is an enjoyable force-field model, not a scientific magnetic simulation.

## Controls

- **Aim:** click a target in Tower Smash, or move the field in Magnet Playground.
- **Grab:** drag a body to lift it, then release to drop or flick. Requires the simulation to be running.
- **Orbit:** drag to rotate the camera. Scroll to zoom. The arrow button restores the scene camera.
- **F:** perform the scene action. **R:** rebuild the same starting layout. **Space:** pause/resume when focus is on the scene. **H:** hide/show the interface. Buttons retain their normal Space activation and sliders retain keyboard control.
- **1/4x, 1/2x, 1x:** simulation speed.
- **World physics:** gravity, bounce, friction, air resistance, and gravity direction tilt. Settings carry across scene changes; Restore earthling settings restores the defaults.
- **Marble finish:** real-time glossy glass, polished metal, or clear-coated candy resin. Applies to dynamic spherical objects, including tower projectiles. Materials use a generated studio reflection map; glass uses screen-space transmission.
- **Palettes:** Sorbet, Candy, and Ocean.
- **Save recipe:** save scene settings, palette, and marble finish. Recipes store the starting experiment, not a snapshot of the current pile. They are stored in the current browser and site origin; localhost and hosted copies have separate recipe boxes.
- **Sound:** opt-in synthesized collision sounds. Sound starts only after enabling it with a click.

The page adapts to narrow screens, with settings below the tray. Desktop is the primary target. Touch-device hardware performance and audible sound quality have not been separately verified.

## Development

Dependencies are pinned in package.json and package-lock.json. After modifying dependencies, run `npm ci` and `npm run build` to refresh the vendored browser modules. `npm test` runs the physics and recipe validation tests. The build step only copies dependencies; application source lives directly in `dist/`.

On a Windows installation with a broken npm shim, the equivalent commands are:

```powershell
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' ci
node scripts/vendor.mjs
node --test tests/*.test.mjs
```

Deploy the **contents of `dist/`** as a static site. Preserve all vendor files and serve `.js` and `.mjs` with a JavaScript MIME type. The Sites hosting identity is in `.openai/hosting.json`.

## Implementation and limits

- Fixed 60 Hz simulation with bounded catch-up after pauses and tab switching.
- Instanced rendering for all moving pieces; scene resets free the old physics world and generated scenery geometry.
- Up to 550 tower cubes and 650 total dynamic bodies. Marbles recycle after 260; objects far outside the scene are removed.
- Parameter extremes can intentionally make structures unstable. Very large/high-fill tumbler configurations can start with crowded pieces.
- Glass is a real-time approximation; it does not provide path-traced interreflection or full nested-glass refraction.
- Squishy/soft-body materials, liquids, cohesion/fracture, optional puzzle challenges, and a free-form scene editor are future extensions, not implemented features.

## Verification

Automated checks cover an unshot tower remaining stable, projectile impact displacing blocks, independent mass and size, repeatable reset for all tower shapes, live physics properties, domino propagation, scene actions, bounded marble recycling, and saved recipe validation.

Browser checks cover all five scenes, shooting, direct block grabbing, slider interaction, reset, pause, recipe save/refresh/load, desktop and narrow layouts, and glass/metal material switching. Browser console errors were checked after material switching. No claim is made about sustained performance on other devices or audible-media QA.

Third-party libraries: Three.js (MIT) and Rapier (Apache-2.0). Vendored license notices are in `dist/vendor/` where provided by the packages. The optional Google Fonts stylesheet has system-font fallbacks.
