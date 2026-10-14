# Sculpt engine "next": what changed (2026-10-13 / 14)

The new engine behind the same contract as `bst_vr_sculpt.js` (see `sculpt_next_README.md`). Plug-in: copy every `scripts/sculpt_next_*.js` file into the app's `lib/` folder (flat, no sub-folders; this replaces the slot file `sculpt_next_engine.js`), and replace `lib/vr_core.js` with the one here if you want the new wrist-menu pages, your head position for your avatar and avatar loading (small, guarded hooks; without them the engine still works behind the existing tiles). In the headset: **Sculpt > More tools > "Engine: next"**, leave Sculpt, enter it again. If the next engine fails to load, the page falls back to the current engine by itself (unchanged behaviour of `vr_core.js`).

## The choice: what the clay is made of

**Hybrid.** New clay is a **narrow-band signed distance field** (the way Substance 3D Modeler keeps clay): 8×8×8-sample bricks, only round the surface (a fist-sized lump is a few hundred kB), 5 mm samples by default (Detail: 3 / 5 / 10 mm). It is turned into triangles with **Surface Nets** in 16-cell chunks, in a **Web Worker** (main-thread fallback with a 4 ms budget). Every heavy operation (each dab, shape, saw pass, merge, remesh, the emblem, a long rod, a gradient over 67k points, a newcomer's snapshot) is **sliced**: it pauses between bricks, rows or pieces, and a per-frame budget (about 4 ms) runs what fits; the rest continues next frame, so no single frame carries a big job.

**Figures, clothes, props stay triangle meshes.** On them the brushes move points inside **shape keys** (never the rest shape the bones are bound to), so skeleton, skin weights and keys survive; tested below. The **current engine runs inside the next one** for the mesh tools that already work (saw and whole-plane cut, Carve, Erase, Heal edge, Close hole, Wrinkle, Stamp, Squeeze: `bst_cut.js` does the geometry exactly as before); the saw is the same saw. On clay those tools have clay versions. One undo stack covers both.

**Rods, balls and the emblem are smooth meshes** (Ruth 2026-10-14: "take a rectangular rod (not flattened), twist it, and then bend it, and then stretch the end of it and taper it off"): a rectangular section, twisted, laid along the drawn path with frames that turn as little as possible, the end drawn out and tapered; colours as vertex colours, so every brush, the Gradient tool and the Look tool work on them and they save as they look.

**Sculpting together sends hands, not clay.** Each headset sends what its hands did this frame and every menu tap (30 to 100 bytes a frame) to a small relay that numbers every message and echoes it to everyone, the sender too; every headset works the messages in that one order, each as a job in the clay queue, so all of them build the same work. A newcomer gets a snapshot at an exact point in that order; a checksum every few seconds catches any headset that drifted and re-sends it the work.

Why not dynamic-topology triangles for everything: a figure's triangles carry bones, weights, uvs and keys; re-topologising them under the brush would break exactly what must survive. Why not voxels for figures: same reason. The two halves meet through **Make clay** (a closed object becomes clay), **Stamp** (clay can be pressed into a figure or object as a cutter) and **Save** (clay is baked to plain meshes).

## Measured cost (headless Chromium, SwiftShader GL; CPU slowed 4× and 6× as a rough stand-in for the Quest's phone-class CPU; the Quest GPU was NOT measured)

Engine time per XR frame (ms), avg / worst, three r128 (the Atelier), meshing on the page thread unless "worker":

| What | 1× | 4× | 6× |
|---|---|---|---|
| Clay stroke, 2 cm, 360 × 6 symmetry | 8.4 / 10.3 | 9.7 / 20.8 | 10.1 / 23.9 |
| Clay stroke, 8 cm brush | 8.2 / 10.2 | 8.7 / 13.1 | 9.5 / 28.5 |
| Smooth, 8 cm | 6.1 / 14.1 | 11.3 / 21.6 | 13.1 / 41.5 |
| Clay stroke with the worker (2 cm) | 2.4 / 13 | 9.4 / 19.3 | 11.8 / 35.7 |
| Saw sweep through clay | 4.1 / 6.6 | 7.5 / 13.3 | 9.6 / 16.2 |
| Remesh a layer at 3 mm (spread over ~120 frames) | 3.2 / 5.1 | 3.7 / 6.9 | 4.0 / 12.9 |
| Brushes on a figure (keys, mirror) | 0.1 / 4 | 0.4 / 11 | 0.6 / 16.3 |
| Busy Build-mode room, 60 hover frames (whole run) | 59 | 327 | 396 |

The same busy-room run on the **current** engine: 560 ms at 1× (about 9× more). Worst frames stay under 50 ms (the 20 fps floor) at 6×; the 72 fps aim (13.9 ms) holds on average at 4×, not on every frame. Work per dab (sum of its slices, 1×): clay 2 cm ≈ 0.7 ms per copy, 8 cm ≈ 8 ms, smooth 4 cm ≈ 1 ms, flatten ≈ 1.7 ms, pinch ≈ 3.3 ms, grab ≈ 1.4 ms. Meshing ≈ 0.3 ms per chunk (1.8 ms at 6×). Other one-offs: Make clay of a 10 cm box 52–68 ms (in the worker when there is one), decimating a 100k-triangle copy to 20k 0.6 s (in the worker when there is one), glb export of a clay work 0.1 s.

**Rods and the emblem.** A drawn rod (12k triangles) builds as you draw (0.2 ms a frame on average). The emblem (67,584 triangles: two rods and two heads) is built in 29 slices over a few frames: 37–84 ms in all at 1×, the largest slice about 5 ms once the code has run once (20 ms the very first time). The rod builder was rewritten for this: 25 ms → 11 ms per emblem body.

**Sculpting together** (2 and 4 engines in one page over the in-page relay, and two separate browser tabs over the real relay, Node and Python):

| What | measured |
|---|---|
| Frame time with two people sculpting the same clay at once (1×, per engine) | 5.8 avg / 9–12 worst |
| Four people drawing clay at once (1×) | 7.8 avg / 13–17 worst |
| Two tabs over the real relay, whole session (1×) | 0.3 avg, 0.8 at the 99th percentile, 24–32 worst |
| Same at 4× | 1.0 avg, 3.4 at the 99th percentile; the first use of a tool in a page (code not yet compiled) 60–120 ms once; the same figure stroke the second time: 12 ms worst |
| What a headset sends per frame | 30–100 bytes (2–7 kB/s at 72 fps) |
| Joining late (snapshot of clay + a rod, 657 kB) | 102–216 ms from tap to sculpting at 1×, 284–684 ms at 4×; built in 5–25 ms of slices, taken in 6–9 ms |
| Checksum rounds (every 480 messages) over a 2-minute two-tab session | 51 of 51 equal, 0 repairs needed (a hand-wiped brick in another test was repaired by itself) |
| Figure preparation (posed copy, neighbours) | 9.5 → 1.9 ms on the test figure (number keys instead of text keys); a real figure prepares once per session |
| Avatars (built-in figure, 5,716 triangles each) | both people sculpting with avatars: 5.3 avg / 19–26 worst (the worst is the first frame an avatar appears) |

## What each tool does now (Substance 3D Modeler's set, and more)

- **Brushes, on clay and on figures/objects:** Clay (round tube or flat ribbon; trigger pressure sets thickness), Smooth, Flatten, Pinch (crease in subtract, ridge in add), Inflate, Grab, Scrape, Smear, Dots (stamp along the stroke: balls, rings, cubes, spikes), plus the current Indent and Melt. **Mode on every brush and shape:** add / subtract / paint / intersect. Edge (falloff): smooth / linear / sharp / flat. Size, strength.
- **Symmetry on every tool:** off / mirror / 360 / mirror + 360. On clay: the work's middle plane and upright; on a figure: left and right keys, 360 round the nearest bone (as before).
- **Shapes with a hand gizmo:** sphere, cube, cylinder, cone, torus, capsule. Pinch inside to move and turn, pinch a knob to stretch a side, both hands to resize and turn; Apply in add (clay), subtract (carves clay, or cuts a figure or object with `bst_cut.js`), intersect, paint. Blend hard / soft.
- **Rod, Ball, Join pieces:** Rod draws a solid rectangular rod along your line, twisted (0–540°), its end drawn out and tapered (or blunt); Ball: pinch where its middle goes and pull out to its size; both come out in the current gradient. Join pieces makes every rod, ball and emblem one object for Hold, Spin and Save. Together, the emblem can be made by hand by two people at once (tested).
- **Colour (Ruth 2026-10-14: "a color wheel, with the ability to build gradients from it, and transparencies"):** the **Colour wheel** floats beside your hand: pinch and slide on it for the colour (round it) and its strength (outwards), a light bar, a see-through bar, and the gradient strip: + adds the colour, tap a marker to change that colour, slide it to move it, − takes it out. **Gradients:** your own from the wheel, or 20 ready ones (your emblem's blue and orange, sunset, ocean, aurora, forest, fire, lava, rose gold, candy, peacock, midnight, neon, mint, earth, skin tones, gold, silver, rainbow, from your colour). See-through stops make rods, balls and painted objects fade to clear.
- **Gradient tool and skins:** drag across an object or clay and the gradient lies along your line; a tap lays it bottom to top. **Skin** turns it into a pattern made of the gradient's colours: marble, wood, scales, speckle, stripes, spots, camo, clouds (3D noise in the object's own space: no seams, kept as vertex colours, so they save in the .glb).
- **Look tool (shaders):** matte, satin, gloss, metal, chrome, glow (glows in the object's own colours), glass, pearl, velvet, candy, toon, on any object or clay layer, with the wheel's see-through. People keep their own skin design (the tools say so and leave a figure alone; Paint still colours a figure).
- **Cutter:** the saw (unchanged code on meshes; a swept slab on clay) and the whole-plane cut; Carve, Erase, Stamp on clay too; clay works as a Stamp into figures and objects.
- **Layers and groups:** new, pick, hide, lock, duplicate, merge down (add / cut out / keep shared), group with below, ungroup, merge group, delete, remesh (3 / 5 / 10 mm), a look per layer, one undo per change.
- **Undo / redo:** one stack for clay, layers, shapes, Hold, keys, rods, balls, gradients, looks and the current engine's mesh tools. Together, Undo takes back **your own** last step, and refuses (and says why) when someone has since changed the same thing.
- **Stroke stabiliser (Steady):** the brush trails the fingertip on a string (0 / 1 cm / 2.4 cm).
- **Hold (two-hand grab):** takes what your hand is on (clay, rod, ball, emblem, a room object); one hand moves and turns it, two hands resize and turn it (upright turns only). Figures are moved with Pose > Move as before.
- **Remesh / decimate / export:** Remesh resamples a layer; Make clay voxelizes an object; Save clay / Save figure write a .glb to the library (three r128 and r186) with looks and vertex colours; a triangle Budget thins only the saved COPY of objects, never the work in the room and never people.
- **Flow:** while one hand sculpts, a pinch with the other hand smooths; a tracked hand turned palm up swaps to the partner (add <-> subtract); a soft haptic tick per dab on controllers.
- **Emotion in motion:** every sculpted key plays as an **expression** (a smooth pulse, 0.3 s micro-expression to 1.5 s, never shorter than 0.2 s, never more than one rise a second); **Record face** turns played expressions into an animation clip that Save figure keeps in the .glb. **Spin** turns any work slowly (eases in and out) and saves as an animation.
- **Story assets apart from bodies:** **New asset** sets the figure aside and starts a separate work; Save clay keeps it as its own library object.
- **Your emblem:** **Make the emblem** brings the two-figure emblem (two rods twisted, bent, stretched and tapered, two heads, in its own gradients) beside you, turning slowly.
- **Sculpt together (2 tested; built and tested for 4):** one tap joins the room. Everyone's hands and taps go through the relay in one order, so every headset builds the same work; each person has their own tools, settings, picked layer, shape and undo. You see the others as **people**: an avatar under their head, arms reaching to their real hands, legs on the floor, in the **look and gradient they chose** (My avatar, My avatar colours), with their name; a MakeHuman export (or a Mixamo / Blender-named rig) is used as their avatar when the page can load it (bones found by name, only head and arms moved). Joining late: everyone's strokes end, the first person sends the work, undo starts fresh. A drifted headset is matched again by itself.

### From the Quest collaborative-creation report (`research/Quest_Collaborative_Creation_Engineering_Reference_2026.pdf`)

The report (Substance 3D Modeler, Gravity Sketch, Horizon Worlds, Multibrush) agrees with how this is built: clay edits go through one ordered stream (its "globally ordered operation list for overlapping regions"), undo is per person ("never revert unrelated edits from other users"), four editors, heavy work sliced across frames and meshed in a worker, a support hand and a tool hand. Taken from it now:
- **Private rooms:** the relays let in only headsets on the home network, and with a room key (`--key <words>`) only those who bring it (`localStorage.sculptTogetherKey` or `host.collabKey()` on each headset). Ruth's rule: LAN only, with the key.
- **Your stroke at once:** while a frame travels to the relay and back, a light line follows your fingertip; the real clay or rod replaces it as it comes back (the report's "first plausible preview in the same frame").
- **Keep work:** Layers > Keep work keeps the clay, rods, balls and emblem on this headset, still editable; Open kept work brings it back as clay (the report: "glTF is not sufficient to preserve editable clay").
- **Draw strokes** (Multibrush / Gravity Sketch): Stroke: rod, tube, ribbon or ink, in the current gradient, see-through included.
- **Fewer tiles at a time** (its five-tab layout): CLAY (brushes and their settings), SHAPES (shapes, ball, join, emblem, spin, Hold), DRAW, COLOUR (wheel, gradients, skins, looks), LAYERS (with Keep work), TOGETHER (sculpt together, your avatar, controls), EXPRESSIONS. The Palette's pages turn in that order with the tool stick.
- **Who made it:** rods, balls, the emblem and joined pieces carry their maker's name (`userData.author`, saved in the .glb as extras).
- **Dropping out and coming back** mid-stroke: tested; the stroke so far stays, the rejoining headset gets the work again.

Not taken yet (each a system of its own): Gravity Sketch's editable surfaces and SubD cages, Horizon's world objects with behaviours, voice, viewer-only visitors.

### How to sculpt together

1. On a computer on the same network as the headsets, start a relay: `node tools/sculpt_next_relay.mjs --key "your words"` or `python3 tools/sculpt_next_relay.py --key "your words"` (nothing to install; port 8787; any number of rooms; only headsets on this network get in, and only with the key). On each headset, put the same words in `localStorage.sculptTogetherKey` once.
2. Each headset finds it at `ws://<the page's host>:8787/?room=atelier` by default; set another address with `localStorage.sculptTogetherUrl` or the page's `host.collabUrl()`. A page served over **https** needs **wss://** (put the relay behind the same TLS proxy as the page).
3. In the headset: Clay & shapes ▸ **Sculpt together**. With clay of your own in the room the first tap only warns (joining someone shows their work instead); tap again. **My avatar** and **My avatar colours** set how you look to the others.

## Substance's controls (from Ruth's report, `research/Adobe_Substance_3D_Real_Screenshots_and_Controls.html`, built from Adobe's own controller map)

Inside Sculpt, with **Controls: Substance** (the default; the tile switches to **Atelier** for the page's old layout), the controllers work as in Substance 3D Modeler. Adobe names hands by role: the **tool hand** sculpts, the **support hand** helps (`sculpt_next_controls.js`; `vr_core.js` passes both hands' buttons and sticks to it):

| Control | Substance 3D Modeler | Here |
|---|---|---|
| Tool trigger | use the tool | the same |
| Support lower button (S2) | hold: the Palette | hold: the Palette (CLAY pages) while held; a quick tap pins it or puts it away |
| Support upper button (S1) | placement: Free / Gizmo | Gizmo (a shape with knobs) / Free (your brush) |
| Support stick left / right | undo / redo | the same (your own steps when sculpting together) |
| Support stick up / down | scope in / out | in: the layer under your tool hand (or the next); out: the whole work |
| Support stick click | colour pick | the same: the next trigger pull takes the colour your tool hand touches |
| Support trigger | modifier (alternate smooth...) | while the tool hand sculpts, smooths |
| Tool stick up / down | brush size | the same |
| Tool stick left / right | hardness | edge: soft, even, sharp, flat |
| Tool lower button (T2) | quick-swap partner tool | add <-> take away (Clay <-> Erase) |
| Tool upper button (T1) | Quicktune / select | tap: select (a clay layer, a rod, ball or emblem); hold and move your hand: strength (up/down) and size (sideways) |
| Palette open + tool stick left / right | expand Palette / Actions | turns the Palette's pages |
| Either grip / both grips | move / scale the world | the page's own world grab, unchanged (the same as Modeler) |
| Touching a button | tooltip | rest your thumb on it for half a second: its job is said |
| Tool stick click | (not used by Modeler) | **freeze / resume everything** (Ruth's comfort rule stays one click away) |

Outside Sculpt nothing changes. Adobe's pages say the brush size moved between sticks across versions (the report notes it); this follows the current controller map (tool stick). With tracked hands (no controllers) the gestures stay: pinch, the other hand's pinch smooths, palm up for the partner tool. **Controller map** (a tile) says the whole layout aloud.

Still to match from the report's tool list (next): Split and Crop, Flip selection, Raise, Buildup, Elastic, a Select tool with the gizmo, stretching the brush unevenly (T1 held while moving), and Free / Gizmo / Surface placement for every brush (here Gizmo means the Shapes tool).

## Files

New (all in `scripts/`, flat, go to `lib/`):

| File | What |
|---|---|
| `sculpt_next_engine.js` | `createVrSculpt(THREE, core, host)` and `makeSculpt(THREE)`: the contract, routing clay vs mesh, one undo stack, stabiliser, clay versions of saw / cut / carve / erase / stamp, the current engine inside, Rod, Ball, Join, Gradient and Look tools, the per-person context for sculpting together, avatars |
| `sculpt_next_sdf.js` | the clay field (bricks), sliced operations, shapes, voxelize |
| `sculpt_next_mesher.js` | Surface Nets chunk mesher (page and worker) |
| `sculpt_next_worker.js` | the worker: mesh, voxelize, decimate jobs |
| `sculpt_next_clay.js` | works, layers, groups, merge, remesh, Make clay, strokes with symmetry, the job queue (ordered, sliced), layer looks, painting a layer, snapshots |
| `sculpt_next_surface.js` | brushes on triangle meshes (superset of `bst_sculpt_core.js`) |
| `sculpt_next_figure.js` | hand strokes on figures into keys, paint, keys page, wardrobe save hand-off |
| `sculpt_next_shapes.js` | shapes with the hand gizmo; Hold |
| `sculpt_next_export.js` | bake, budget, glb export, library save |
| `sculpt_next_decimate.js` | quadric-error decimation (pure, runs in the worker) |
| `sculpt_next_motion.js` | expressions (pulse), recorded key animation, Spin |
| `sculpt_next_rod.js` | the rod: rectangular section, twist, bend, stretch, taper, front / back gradients, see-through, sliced |
| `sculpt_next_emblem.js` | Ruth's emblem from rods and spheres (pure; also used by the preview page) |
| `sculpt_next_wheel.js` | the colour wheel (vertex colours only, no canvas) |
| `sculpt_next_looks.js` | gradients (library and your own), skins (patterns), looks (materials) |
| `sculpt_next_collab.js` | sculpting together: the shared order, joining, checksums, WebSocket and in-page transports, snapshot encoders |
| `sculpt_next_controls.js` | Substance 3D Modeler's controller layout inside Sculpt (tool hand / support hand), tooltips on touch, colour pick, Quicktune |
| `sculpt_next_store.js` | Keep work: editable clay, rods and balls kept in the headset browser's own database |
| `sculpt_next_avatar.js` | the people you sculpt with: built-in figure and rigged figures (MakeHuman, Mixamo, Blender names) posed to head and hands |
| `sculpt_next_ui.js` | wrist-menu pages, picture-tile icons, lessons, tile list |
| `sculpt_next_testkit.js` | a built skinned figure, and a stand-in with MakeHuman's bone names, for the self-test |
| `sculpt_next_selftest.js` | the next engine's own checks (run by the self-test page) |
| `sculpt_next_CHANGES.md` | this file |

Changed:

| File | What |
|---|---|
| `sculpt_next_engine.js` | was the slot re-exporting the current engine; now the next engine |
| `bst_vr_sculpt_selftest.html` | `?engine=current\|next`; falls back to the built figure; runs the next engine's checks; `?only=` sections |
| `vr_core.js` | +22 lines, all guarded: the engine's icons merged into ICONS (existing names untouched), its pages 10–13 (CLAY, SHAPES, LAYERS, EXPRESSIONS) and the "Clay & shapes ▸" entry tile, a palm-up flag on tracked hands, a soft haptic tick, an idle call so a spin (and a shared session) keeps going after Sculpt closes, and two host functions: `head()` (the XR camera's pose, for your avatar on the others' headsets) and `loadAvatar(url)` (a .glb through the page's GLTFLoader); inside Sculpt with Substance controls, both hands' buttons and sticks go to the engine (the tool hand's stick click still freezes everything, the grips still move the world). The current engine uses none of these, so with it nothing changes. |
| `sculpt_next_README.md` | the contract's new optional parts |

Untouched and reused as they are: `bst_vr_sculpt.js`, `bst_sculpt_core.js`, `bst_cut.js`, `bst_shapekeys.js`, `bst_squeeze.js`, `bst_wrinkle.js`, `wardrobe_core.js` (its cut saving sees each brushed piece of clothing as changed, because the piece gets a buffer-sharing new geometry object after the stroke).

Dev tools (not shipped, in `tools/`): `sculpt_next_serve.mjs` (serves `scripts/` as `/pe_lib/` with three r128 and r186.1 from npm and a pretend library), `sculpt_next_run.mjs` (headless runner with CPU throttling), **`sculpt_next_relay.mjs` and `sculpt_next_relay.py` (the room relay: these two ARE meant to run, on a computer on the headsets' network)**, `sculpt_next_together.html` + `sculpt_next_together_run.mjs` (two browser tabs sculpting together over the real relay: `node tools/sculpt_next_together_run.mjs [--py] [--cpu 4] [--three 128]`), `sculpt_next_looks_shot.html`, `sculpt_next_avatars_shot.html`, `sculpt_next_emblem_shot.html`, `sculpt_next_rod_shot.html` (pictures: `sculpt_next_looks_shot.png`, `sculpt_next_avatars_shot.png`), `sculpt_next_emblem_page.mjs`, `sculpt_next_debug.html`.

## Tests (no headset)

`bst_vr_sculpt_selftest.html?three=128|186&engine=next` (append `&only=clay,brushes,shapes,cutter,layers,hold,figure,export,worker,timing,flow,emblem,rod,looks,together,avatars,controls,report,menu` for parts). Every existing check of the current engine passes on the next engine (r128 and r186), then about 300 more (375 values in all on each revision): clay watertight with exact undo / redo, mirror / 360 / both, each brush's effect with exact undo (12/12), shapes and gizmo, booleans, saw (one undo per sweep), plane cut, carve, erase, stamp into clay, clay as a stamp into an object, mixed undo with the current engine's saw, every layer operation, Hold, the stabiliser, the support-hand smooth, the palm-up swap, haptic ticks, the asset bench, expression pulses, a recorded expression saved and reloaded from the .glb, the emblem (parts, colours, depth, spin, Spin clip in the .glb, brushable, undo, built in slices), the rod (follows the path, undo / redo), **the colour wheel** (hue, strength, light, see-through, building a gradient with + and −, sculpting beside it, closing), see-through rods, the Gradient tool along a line and its undo, a marble skin, a gradient on clay, looks on rods and clay (chrome, glass with see-through, pearl), people left alone, a dressed rod saved with its metal, **sculpting together** (alone, a late join with the same work, both on the same clay at once, a shape from one person's menu, undo refused and then allowed, the emblem and its spin the same on both, a figure key, the emblem built **by hand** by two people at once and joined, spun and saved, dressing it together, four people, someone leaving, a drifted headset repaired), **avatars** (two people sculpting, each seen by the other in their own look and gradient; one as a rigged MakeHuman-named figure with head and wrist exactly on the person's, one built-in; a look change seen live; leaving removes it), **Substance controls** (undo and redo on the support stick, size and edge on the tool stick, the partner swap, Gizmo / Free, the Palette held and pinned, its pages, freeze, colour pick taking the clay's exact colour without sculpting, select, Quicktune, scope in and out, tooltips, the Atelier layout switching it all off), **from the report** (tube round, ribbon flat, ink fine; work kept, emptied and opened again identical; your stroke shown at once over a 60 ms relay and cleared when the rod comes back; the maker's name on both headsets and in the .glb; dropping out mid-stroke and rejoining with the same work; relays refusing no key and a wrong key, letting the right one in), the menu (every icon resolves, every SVG parses, every lesson one step). **Figures:** after every brush, the saw and a shape cut, the skin indices, skin weights, rest shape, an existing key ("Smile"), the bones, bone inverses and bind matrix are byte-identical; the .glb reloads with 11/11 bones, its weights and all keys.

## What could not be tested here

- Real fingertips on Ruth's Quest, the Quest's own frame rate (GPU) and the headset log beats; module workers in the Quest Browser (the engine falls back to the page thread if the worker does not start).
- **Two real headsets** over a real network: only two browser tabs on one computer over the real relay (and 2 or 4 engines in one page). Latency over the internet, a dropped Wi-Fi link, and a Quest Browser and a desktop Chrome together (the shared order needs the same maths on each; a mismatch would be caught and repaired by the checksum, at the cost of a moment's resend) were not tried.
- **A real MakeHuman export**: none was in the package, so the rigged path was tested on a stand-in built with MakeHuman's "default" bone names. Mixamo and Blender (Rigify) names are in the list but untested. MakeHuman's exports are free to use (CC0).
- The shared room itself (`VRCore` carrying and object poses are another module, not in the package): sculpting together assumes both headsets see the same room in the same place, the same figure and the same room objects by name.
- Metal, chrome and pearl need the room's environment light (the Atelier's `scene.environment`); without one they look dark. Glass is see-through by opacity (not refraction), which is lighter for the Quest. The toon look saves as a standard material in the .glb (glTF has no toon).
- The first use of a tool in a page runs slower once while the browser compiles its code (measured above); later uses are fast.
- The palm-up detection and the haptic tick on real hardware; the `vr_core.js` hooks inside the live Atelier / BSA pages (those pages, `female.glb` and the app's models were not in the package; the hooks pass a syntax check and are guarded).
- The existing check `renderedChange` fails on the built test figure for both engines (camera framing written for `female.glb`), so it says nothing either way here.
- Textures from the Atelier's library and its skin shaders on clay: clay works are not in the Atelier's own object list (`VRObjects`, not in the package), so its Style panel cannot pick them; clay and objects have the wheel, gradients, skins and looks meanwhile.
- Adobe's own help pages (blocked), so Substance's full controller table.

## New wrist-menu tiles (with their picture-tile icon names)

| Page | Tile | Picture-tile icon |
|---|---|---|
| Sculpt (first page) | Clay & shapes ▸ | `sculptNextIc` |
| CLAY | Clay | `clayIc` |
| CLAY | Smooth | `smoothIc` |
| CLAY | Flatten | `flattenIc` |
| CLAY | Pinch | `pinchIc` |
| CLAY | Inflate | `inflateIc` |
| CLAY | Grab | `grabIc` |
| CLAY | Scrape | `scrapeIc` |
| CLAY | Smear | `smearIc` |
| CLAY | Dots | `dotsIc` |
| CLAY | Mode: add / subtract / paint / intersect | `opAddIc` / `opSubIc` / `opPaintIc` / `opIntersectIc` |
| CLAY | Size N cm | `brushSize` |
| CLAY | Strength N% | `strengthBars` |
| CLAY | Symmetry: off / mirror / 360 / mirror + 360 | `symOff` / `symMirror` / `symRound` / `symBoth` |
| CLAY | Steady: off / some / lots | `steadyIc` |
| CLAY | Edge: smooth / linear / sharp / flat | `falloffIc` |
| CLAY | Clay: round / ribbon (when Clay is picked) | `clayIc` |
| CLAY | Dots: balls / rings / cubes / spikes (when Dots is picked) | `dotsIc` |
| CLAY | Other hand smooths: on / off | `supportIc` |
| SHAPES | New asset / Back to the figure | `assetIc` / `backFigureIc` |
| TOGETHER | Controls: Substance / Atelier | `controllerIc` |
| TOGETHER | Controller map | `controllerIc` |
| TOGETHER | Sculpt together / Together: N people | `togetherIc` |
| TOGETHER | My avatar: <look> | `lookIc` |
| TOGETHER | My avatar colours: my colour / <gradient> | `gradientIc` |
| DRAW | Draw: rod / tube / ribbon / ink, Stroke, Twist: N°, Rod end: tapered / blunt | `rodIc`, `twistIc`, `taperIc` |
| SHAPES | Make the emblem | `emblemIc` |
| SHAPES | Ball | `ballIc` |
| COLOUR | Colour wheel (opens the wheel: colour, light, see-through, gradient strip with + and -) | `wheelIc` |
| COLOUR | Gradient: from Colour / emblem blue / emblem orange / sunset / ocean / ... / custom | `gradientIc` |
| COLOUR | Gradient tool | `gradientIc` |
| COLOUR | Skin: smooth / marble / wood / scales / speckle / stripes / spots / camo / clouds (when the Gradient tool is picked) | `skinIc` |
| COLOUR | Look tool | `lookIc` |
| COLOUR | Look: matte / satin / gloss / metal / chrome / glow / glass / pearl / velvet / candy / toon | `finishIc` |
| SHAPES | Join pieces | `joinIc` |
| SHAPES | Spin: on / off | `spinIc` |
| CLAY | Expressions ▸ | `motionIc` |
| EXPRESSIONS | ▶ <shape key> (one tile per key, tap to play it) | `pulseIc` |
| EXPRESSIONS | Pulse: quick / normal / slow | `pulseSpeedIc` |
| EXPRESSIONS | Plays: once / 3 times | `repeatIc` |
| EXPRESSIONS | Record face / Stop recording | `recordFaceIc` |
| EXPRESSIONS | Play the move | `playMoveIc` |
| CLAY | Undo stroke / Redo stroke | `undoStroke` / `redoStroke` |
| CLAY | Shapes ▸ / Draw ▸ / Colour ▸ / Layers ▸ / Together ▸ / Expressions ▸ | `shapesIc` / `rodIc` / `wheelIc` / `layersIc` / `togetherIc` / `motionIc` |
| CLAY | Shapes ▸ | `shapesIc` |
| CLAY | Layers ▸ | `layersIc` |
| SHAPES | Place a shape | `placeShapeIc` |
| SHAPES | Shape: sphere / cube / cylinder / cone / torus / capsule | `primSphere` / `primCube` / `primCylinder` / `primCone` / `primTorus` / `primCapsule` |
| SHAPES | Apply shape | `applyShapeIc` |
| SHAPES | Drop shape | `dropShapeIc` |
| SHAPES | Blend: hard / soft / very soft | `blendIc` |
| SHAPES | Make clay | `makeClayIc` |
| SHAPES | Hold | `holdIc` |
| SHAPES | Hold: whole work / picked layer | `holdIc` |
| SHAPES | Clay on figure: skin / new clay | `clayFigIc` |
| LAYERS | (one tile per layer, tap to pick) | `layerPickIc` |
| LAYERS | New layer | `layerAddIc` |
| LAYERS | Hide layer / Show layer | `eye` |
| LAYERS | Lock layer / Unlock layer | `lock` |
| LAYERS | Duplicate layer | `dupIc` |
| LAYERS | Merge down: add / cut out / keep shared | `mergeIc` |
| LAYERS | Group with below | `groupIc` |
| LAYERS | Ungroup | `ungroupIc` |
| LAYERS | Merge group | `mergeGroupIc` |
| LAYERS | Delete layer | `trashIc` |
| LAYERS | Detail: 3 / 5 / 10 mm | `detailIc` |
| LAYERS | Remesh layer | `remeshIc` |
| LAYERS | Budget: all / 5k / 20k / 50k / 100k | `budgetIc` |
| LAYERS | Save clay | `floppy` |
| LAYERS | Keep work / Open kept work ▸ | `keepIc` |
| KEPT WORKS | (one tile per kept work, tap to open it) | `keepIc` |

New icons in this package (65): `clayIc`, `flattenIc`, `pinchIc`, `scrapeIc`, `smearIc`, `dotsIc`, `opAddIc`, `opSubIc`, `opPaintIc`, `opIntersectIc`, `tintIc`, `symBoth`, `steadyIc`, `falloffIc`, `shapesIc`, `layersIc`, `primSphere`, `primCube`, `primCylinder`, `primCone`, `primTorus`, `primCapsule`, `placeShapeIc`, `applyShapeIc`, `dropShapeIc`, `blendIc`, `makeClayIc`, `holdIc`, `clayFigIc`, `layerAddIc`, `dupIc`, `mergeIc`, `groupIc`, `ungroupIc`, `mergeGroupIc`, `trashIc`, `remeshIc`, `detailIc`, `budgetIc`, `layerPickIc`, `assetIc`, `backFigureIc`, `finishIc`, `supportIc`, `motionIc`, `pulseIc`, `pulseSpeedIc`, `repeatIc`, `recordFaceIc`, `playMoveIc`, `emblemIc`, `spinIc`, `rodIc`, `twistIc`, `taperIc`, `wheelIc`, `gradientIc`, `skinIc`, `lookIc`, `ballIc`, `joinIc`, `controllerIc`, `keepIc`, `togetherIc`, `sculptNextIc`.

## One lesson step per tool (68)

| Tool | The step (shown on the lesson card, with a Show me button for the tile) | Tile it points to |
|---|---|---|
| Clay | Pick Clay, then pinch your thumb and finger together in the air and draw: a tube of clay follows your fingertip. Let go to finish the stroke; Undo takes it back. | Clay (`clayIc`) |
| Smooth | Pick Smooth, pinch on the clay or the skin and rub back and forth: the bumps even out. Hold longer for more. | Smooth (`smoothIc`) |
| Flatten | Pick Flatten, pinch on a rounded spot and slide: it settles to the flat plane under your finger. | Flatten (`flattenIc`) |
| Pinch | Pick Pinch, set Mode to subtract, then draw a line across the surface: it tightens into a crease. In add it makes a sharp ridge. | Pinch (`pinchIc`) |
| Inflate | Pick Inflate, pinch on the surface and hold still: it swells out while you hold. Mode subtract shrinks it instead. | Inflate (`inflateIc`) |
| Grab | Pick Grab, pinch on the surface and pull your hand away: a soft region comes with you. The Edge tile sets how soft. | Grab (`grabIc`) |
| Scrape | Pick Scrape, pinch and drag across a bump: the high part is shaved off flat, the rest stays. | Scrape (`scrapeIc`) |
| Smear | Pick Smear, pinch and drag along the surface: the clay is pushed along with your finger, like smudging. | Smear (`smearIc`) |
| Dots | Pick Dots, then draw a line: a ball is pressed in every few centimetres. The Dots tile below switches to rings, cubes or spikes. | Dots (`dotsIc`) |
| Add, subtract, paint, intersect | Tap the Mode tile to step through add, subtract, paint and intersect. Every brush and every shape follows it: build up, carve away, only colour, or keep only what you cover. | Mode: add (`opAddIc`) |
| Paint with your colour | Pick a colour on the colour wheel, then tap Mode until it says paint and brush over clay: it takes that colour. | Mode: add (`opAddIc`) |
| Mirror and 360 | Tap Symmetry once for mirror, twice for 360, three times for both. Then make one stroke and watch the copies appear with it. | Symmetry: off (`symOff`) |
| Steady | Tap Steady for more or less steadiness. With it on, the brush ball trails your fingertip on a short string, so a shaky line comes out smooth. | Steady: some (`steadyIc`) |
| Edge | Tap Edge to choose how the brush fades from its middle to its rim: soft, even, sharp or flat. | Edge: smooth (`falloffIc`) |
| Shapes | On the Shapes page tap Place a shape, then pinch in the air: a see-through ball sits at your finger. Pinch inside it to move it, then tap Apply shape. | Place a shape (`placeShapeIc`) |
| Shape kind | Tap the Shape tile to switch between sphere, cube, cylinder, cone, torus and capsule before you place one. | Shape: sphere (`primSphere`) |
| Stretch and resize a shape | With a shape placed, pinch one of its orange knobs and pull to stretch that side; pinch it with both hands and pull apart to make it bigger. | Place a shape (`placeShapeIc`) |
| Apply shape | Tap Apply shape: in add it becomes clay, in subtract it carves a hole in the clay or the piece under it, in intersect only what is inside it stays. | Apply shape (`applyShapeIc`) |
| Drop shape | Tap Drop shape to throw the placed shape away without changing anything. | Drop shape (`dropShapeIc`) |
| Blend | Tap Blend to choose how new clay and shapes meet the old: a hard edge or a soft fillet. | Blend: soft (`blendIc`) |
| Make clay | Pick an object with More > Pick stamp, then tap Make clay: it becomes clay, so every clay brush and boolean works on it. The original is hidden, not deleted. | Make clay (`makeClayIc`) |
| Hold | Tap Hold, then pinch with both hands and pull them apart: the whole work grows. Turn your hands round each other to turn it. | Hold (`holdIc`) |
| Hold what | Tap this to choose whether Hold moves the whole work or only the picked layer and its group. | Hold: whole work (`holdIc`) |
| Clay on a figure | Tap to choose what Clay does on a figure: build up the skin itself (kept in a shape key, the skeleton stays as it is) or put new clay on top. | Clay on figure: skin (`clayFigIc`) |
| Layers | Open Layers: each tile is a layer; tap one to pick it. New strokes go into the picked layer. | Layers ▸ (`layersIc`) |
| New layer | Tap New layer, then make a stroke: it goes on its own layer, which you can hide, move or delete without touching the rest. | New layer (`layerAddIc`) |
| Hide a layer | Tap Hide layer to hide the picked layer; no tool touches it while it is hidden. Tap again to show it. | Hide layer (`eye`) |
| Lock a layer | Tap Lock layer and the picked layer cannot be changed until you unlock it. | Lock layer (`lock`) |
| Duplicate | Tap Duplicate layer: an exact copy sits on top of the picked one, ready to move with Hold. | Duplicate layer (`dupIc`) |
| Merge down | Tap Merge down to put the picked layer into the one below. With Mode subtract it is cut out instead; with intersect only what both share stays. | Merge down: add (`mergeIc`) |
| Group | Tap Group with below to join the picked layer and the one under it in a group: Hold moves them together. | Group with below (`groupIc`) |
| Ungroup | Tap Ungroup to let the layers of the picked layer's group go their own way again. | Ungroup (`ungroupIc`) |
| Merge group | Tap Merge group to turn a whole group into one layer, so you can use it as one stamp or one cutter. | Merge group (`mergeGroupIc`) |
| Delete layer | Tap Delete layer to remove the picked layer. Undo brings it back. | Delete layer (`trashIc`) |
| Detail | Tap Detail to choose how fine new layers are: 3 mm for small work, 5 mm normal, 10 mm rough and light. | Detail: 5 mm (`detailIc`) |
| Remesh | Pick a layer, set Detail, then tap Remesh layer: the layer is made again at that detail, finer or lighter. | Remesh layer (`remeshIc`) |
| Budget | Tap Budget to set how many triangles a saved copy may have. Only the saved copy is thinned, and people are never thinned. | Budget: all (`budgetIc`) |
| Save clay | Tap Save clay to put your clay in the library as a .glb, without taking the headset off. | Save clay (`floppy`) |
| New asset | Tap New asset: the figure steps aside and your next clay starts an object of its own for the story. Save clay keeps it in the library; Back to the figure brings the figure back. | New asset (`assetIc`) |
| Look of a clay layer | Pick a clay layer on the Layers page, then tap Look to step through matte, satin, gloss, metal, chrome, glow, glass, pearl, velvet, candy and toon. | Look: satin (`finishIc`) |
| Other hand smooths | Sculpt with one hand; without letting go, pinch with your other hand and rub: that hand smooths while the first keeps its brush. | Other hand smooths: on (`supportIc`) |
| Expressions | Open Expressions and tap a shape key: the face moves into it and back, smoothly, like a real expression. | Expressions ▸ (`motionIc`) |
| Pulse speed | Tap Pulse to choose quick (a micro-expression, 0.3 s), normal or slow (1.5 s). | Pulse: normal (`pulseSpeedIc`) |
| Record a move | Tap Record face, play a few expressions, then Stop recording: it becomes an animation that Save figure keeps in the .glb. | Record face (`recordFaceIc`) |
| Play the move | Tap Play the move to watch the last recorded expression move once. | Play the move (`playMoveIc`) |
| Make the emblem | Tap Make the emblem: your two-figure emblem appears beside you, each body a rectangular rod twisted, bent and tapered, in its own colours, turning slowly. | Make the emblem (`emblemIc`) |
| Draw | Pick Rod, then pinch and draw a curve in the air: a solid rectangular rod follows your finger, twisted and tapered to a point. Size sets how wide it is. | Draw: rod (`rodIc`) |
| Twist | With Rod picked, tap Twist to choose how far the next rod turns from one end to the other: 0, 90, 180, 360 or 540 degrees. | Twist: 180° (`twistIc`) |
| Rod end | With Rod picked, tap Rod end: tapered draws the end out to a point, blunt keeps it full size. | Rod end: tapered (`taperIc`) |
| Spin | Pick some clay, then tap Spin: the whole work turns slowly round, one turn every 10 seconds. Tap again and it eases to a stop. Save clay keeps the spin. | Spin: off (`spinIc`) |
| Tube, ribbon, ink | On the Draw page, tap Stroke to choose a rod, a round tube, a flat ribbon or a fine ink line, then pinch and draw in the air: it comes out in your gradient. | Stroke: rod (`rodIc`) |
| Keep work | On the Layers page, tap Keep work: your clay, rods and balls are kept on this headset as they are, still editable. | Keep work (`keepIc`) |
| Open kept work | Tap Open kept work and pick one: it comes back as clay you can keep shaping. Open it before sculpting together and whoever joins gets it too. | Open kept work ▸ (`keepIc`) |
| Ball | Pick Ball, pinch where you want the middle of a head, and pull your hand away: the ball grows with you. Let go and it stays, smooth and in a gradient. | Ball (`ballIc`) |
| Colour wheel | Tap Colour wheel: a wheel floats beside your hand. Pinch on it and slide: round it changes the colour, from the middle out makes it stronger. Clay, paint, rods and balls take that colour. | Colour wheel (`wheelIc`) |
| Light and see-through | On the colour wheel, pinch the bar on the right and slide up for lighter, down for darker; the bar on the left makes the colour see-through as you slide down. | Colour wheel (`wheelIc`) |
| Build a gradient | On the colour wheel, pick a colour and tap +, pick another and tap + again: the strip under the wheel is your gradient. Tap a marker to change that colour, slide it to move it, - takes it out. | Colour wheel (`wheelIc`) |
| Gradients | Tap the Gradient tile to step through ready-made gradients: your emblem's blue and orange, sunset, ocean, fire, gold, rainbow and more. Rods and balls come out in it. | Gradient: sunset (`gradientIc`) |
| Gradient tool | Pick the Gradient tool, pinch on a rod, a ball, an object or clay, and drag across it: the gradient lies along your line, first colour where you started. | Gradient tool (`gradientIc`) |
| Skins | With the Gradient tool picked, tap Skin for marble, wood, scales, speckle, stripes, spots, camo or clouds, then tap an object: the pattern wraps round it in your gradient's colours. | Skin: marble (`skinIc`) |
| Look tool | Pick a look with the Look tile (gloss, metal, chrome, glass, pearl, velvet, glow, toon...), then pick the Look tool and pinch an object or clay: it takes that look. | Look tool (`lookIc`) |
| Join pieces | When your rods and balls are where you want them, tap Join pieces: they become one object, so Hold moves it, Spin turns it and Save keeps it as one. | Join pieces (`joinIc`) |
| Substance controls | With Controls on Substance, hold your support hand's lower button: the Palette appears; point with your tool hand and pull the trigger to choose. Let go and it tucks away. | Controls: Substance (`controllerIc`) |
| Controller map | Tap Controller map to hear what every button does. Or rest your thumb on a button for half a second: it tells you its job. | Controller map (`controllerIc`) |
| Your avatar | Tap My avatar to choose how you look to the people you sculpt with: pearl, glow, metal, glass and more; My avatar colours puts a gradient on you, feet to head. | My avatar: pearl (`lookIc`) |
| Sculpt together | Tap Sculpt together; when your collaborator taps it too, you see them as a person in the look they chose, with their name over them, and everything either of you makes appears for both. Undo takes back only your own steps. | Sculpt together (`togetherIc`) |
| Saw on clay | Pick Saw on the first Sculpt page and sweep it through clay with the trigger held: a slit as wide as the Size ring is cut, the rest stays. It saws figures and objects as before. | Saw (`cutIc`) |
| Carve and stamp on clay | Carve and Stamp work on clay too: sweep Carve to dig a groove, or press a picked object in with Stamp to carve its shape out of the clay. | Carve (`carveIc`) |
