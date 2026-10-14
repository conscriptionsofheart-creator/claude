# Sculpt engine "next": what changed (2026-10-13 / 14)

The new engine behind the same contract as `bst_vr_sculpt.js` (see `sculpt_next_README.md`). Plug-in: copy every `scripts/sculpt_next_*.js` file into the app's `lib/` folder (flat, no sub-folders; this replaces the slot file `sculpt_next_engine.js`), and replace `lib/vr_core.js` with the one here if you want the new wrist-menu pages (it has a small, guarded hook; without it the engine still works behind the existing tiles). In the headset: **Sculpt > More tools > "Engine: next"**, leave Sculpt, enter it again. If the next engine fails to load, the page falls back to the current engine by itself (unchanged behaviour of `vr_core.js`).

## The choice: what the clay is made of

**Hybrid.** New clay is a **narrow-band signed distance field** (the way Substance 3D Modeler keeps clay): 8×8×8-sample bricks, only round the surface (a fist-sized lump is a few hundred kB), 5 mm samples by default (Detail: 3 / 5 / 10 mm). It is turned into triangles with **Surface Nets** in 16-cell chunks, in a **Web Worker** (main-thread fallback with a 4 ms budget). Every clay operation (each dab, shape, saw pass, merge, remesh, emblem build) is **sliced**: it pauses between bricks or rows, and a per-frame budget (about 4 ms) runs what fits; the rest continues next frame, so no single frame carries a big job.

**Figures, clothes, props stay triangle meshes.** On them the brushes move points inside **shape keys** (never the rest shape the bones are bound to), so skeleton, skin weights and keys survive; tested below. The **current engine runs inside the next one** for the mesh tools that already work (saw and whole-plane cut, Carve, Erase, Heal edge, Close hole, Wrinkle, Stamp, Squeeze: `bst_cut.js` does the geometry exactly as before); the saw is the same saw. On clay those tools have clay versions. One undo stack covers both.

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
| Building the emblem (≈460 frames at 1×) | 4.3 / 10.4 | 4.6 / 24 | 5.0 / 35 |
| Busy Build-mode room, 60 hover frames (whole run) | 59 | 327 | 396 |

The same busy-room run on the **current** engine: 560 ms at 1× (about 9× more). Worst frames stay under 50 ms (the 20 fps floor) at 6×; the 72 fps aim (13.9 ms) holds on average at 4×, not on every frame. Work per dab (sum of its slices, 1×): clay 2 cm ≈ 0.7 ms per copy, 8 cm ≈ 8 ms, smooth 4 cm ≈ 1 ms, flatten ≈ 1.7 ms, pinch ≈ 3.3 ms, grab ≈ 1.4 ms. Meshing ≈ 0.3 ms per chunk (1.8 ms at 6×). Other one-offs: Make clay of a 10 cm box 52–68 ms (in the worker when there is one), decimating a 100k-triangle copy to 20k 0.6 s (in the worker when there is one), glb export of a clay work 0.1 s. Triangles: a 12 cm ball at 5 mm ≈ 9k; the emblem 75k at 2.5 mm.

## What each tool does now (Substance 3D Modeler's set)

- **Brushes, on clay and on figures/objects:** Clay (round tube or flat ribbon; trigger pressure sets thickness), Smooth, Flatten, Pinch (crease in subtract, ridge in add), Inflate, Grab, Scrape, Smear, Dots (stamp along the stroke: balls, rings, cubes, spikes), plus the current Indent and Melt. **Mode on every brush and shape:** add / subtract / paint / intersect. Edge (falloff): smooth / linear / sharp / flat. Size, strength, colour (8), finish per layer (matte / satin / gloss / metal / glow).
- **Symmetry on every tool:** off / mirror / 360 / mirror + 360. On clay: the work's middle plane and upright; on a figure: left and right keys, 360 round the nearest bone (as before).
- **Shapes with a hand gizmo:** sphere, cube, cylinder, cone, torus, capsule. Pinch inside to move and turn, pinch a knob to stretch a side, both hands to resize and turn; Apply in add (clay), subtract (carves clay, or cuts a figure or object with `bst_cut.js`), intersect, paint. Blend hard / soft.
- **Cutter:** the saw (unchanged code on meshes; a swept slab on clay) and the whole-plane cut; Carve, Erase, Stamp on clay too; clay works as a Stamp into figures and objects.
- **Layers and groups:** new, pick, hide, lock, duplicate, merge down (add / cut out / keep shared), group with below, ungroup, merge group, delete, remesh (3 / 5 / 10 mm), one undo per change.
- **Undo / redo:** one stack for clay, layers, shapes, Hold, keys and the current engine's mesh tools (tested in mixed order).
- **Stroke stabiliser (Steady):** the brush trails the fingertip on a string (0 / 1 cm / 2.4 cm).
- **Hold (two-hand grab):** one hand moves and turns the work, two hands resize and turn it (upright turns only, so it never tips by accident). Figures are moved with Pose > Move as before.
- **Remesh / decimate / export:** Remesh resamples a layer; Make clay voxelizes an object; Save clay / Save figure write a .glb to the library (three r128 and r186); a triangle Budget thins only the saved COPY of objects, never the work in the room and never people.
- **Flow (Ruth 2026-10-13):** while one hand sculpts, a pinch with the other hand smooths; a tracked hand turned palm up swaps to the partner (add <-> subtract); a soft haptic tick per dab on controllers.
- **Emotion in motion:** every sculpted key plays as an **expression** (a smooth pulse, 0.3 s micro-expression to 1.5 s, never shorter than 0.2 s, never more than one rise a second); **Record face** turns played expressions into an animation clip that Save figure keeps in the .glb.
- **Story assets apart from bodies:** **New asset** sets the figure aside and starts a separate clay work; Save clay keeps it as its own library object.
- **Your emblem:** **Make the emblem** builds the two-figure emblem in clay beside you: each body one rectangular rod painted in a gradient and twisted (front face: the main gradient; back face: the fold colours, showing where it turns), heads as spheres, four layers you can keep sculpting; **Spin** turns any work slowly (10 s a turn, eases in and out) and the spin is saved in the .glb as an animation. Preview without a headset: `tools/sculpt_next_emblem_preview.html` (needs three r128 from cdnjs).

## Substance's controls: what was checked

Adobe's help pages could not be opened from the build machine (the network refused helpx.adobe.com), so only what search summaries said was used: a **tool hand** and a **support hand**; the palette on the support hand; the tool-hand thumbstick resizes while holding; the support-hand stick changes a count during an action; tooltips on touch. The rest of Substance's button table is **unverified**. The headset build keeps the app's own rules: A/B/X/Y and stick clicks freeze everything (comfort rule), so the partner swap is the tracked hand's palm-up gesture, not a button.

## Files

New (all in `scripts/`, flat, go to `lib/`):

| File | What |
|---|---|
| `sculpt_next_engine.js` | `createVrSculpt(THREE, core, host)` and `makeSculpt(THREE)`: the contract, routing clay vs mesh, one undo stack, stabiliser, clay versions of saw / cut / carve / erase / stamp, the current engine inside |
| `sculpt_next_sdf.js` | the clay field (bricks), sliced operations, shapes, voxelize |
| `sculpt_next_mesher.js` | Surface Nets chunk mesher (page and worker) |
| `sculpt_next_worker.js` | the worker: mesh, voxelize, decimate jobs |
| `sculpt_next_clay.js` | works, layers, groups, merge, remesh, Make clay, strokes with symmetry, the job queue, finish |
| `sculpt_next_surface.js` | brushes on triangle meshes (superset of `bst_sculpt_core.js`) |
| `sculpt_next_figure.js` | hand strokes on figures into keys, paint, keys page, wardrobe save hand-off |
| `sculpt_next_shapes.js` | shapes with the hand gizmo; Hold |
| `sculpt_next_export.js` | bake, budget, glb export, library save |
| `sculpt_next_decimate.js` | quadric-error decimation (pure, runs in the worker) |
| `sculpt_next_motion.js` | expressions (pulse), recorded key animation, Spin |
| `sculpt_next_emblem.js` | Ruth's emblem as clay (pure; same code in the preview page) |
| `sculpt_next_ui.js` | wrist-menu pages, 53 new picture-tile icons, lessons, tile list |
| `sculpt_next_testkit.js` | a built skinned figure for the self-test when `female.glb` is absent |
| `sculpt_next_selftest.js` | the next engine's own checks (run by the self-test page) |
| `sculpt_next_CHANGES.md` | this file |

Changed:

| File | What |
|---|---|
| `sculpt_next_engine.js` | was the slot re-exporting the current engine; now the next engine |
| `bst_vr_sculpt_selftest.html` | `?engine=current\|next`; falls back to the built figure; runs the next engine's checks; `?only=` sections |
| `vr_core.js` | +15 lines, all guarded: the engine's icons merged into ICONS (existing names untouched), its pages 10–13 (CLAY, SHAPES, LAYERS, EXPRESSIONS) and the "Clay & shapes ▸" entry tile, a palm-up flag on tracked hands, a soft haptic tick, an idle call so a spin keeps turning after Sculpt closes. The current engine has none of `icons / menu / idle`, so with it nothing changes. |
| `sculpt_next_README.md` | the contract's new optional parts |

Untouched and reused as they are: `bst_vr_sculpt.js`, `bst_sculpt_core.js`, `bst_cut.js`, `bst_shapekeys.js`, `bst_squeeze.js`, `bst_wrinkle.js`, `wardrobe_core.js` (its cut saving sees each brushed piece of clothing as changed, because the piece gets a buffer-sharing new geometry object after the stroke).

Dev tools (not shipped, in `tools/`): `sculpt_next_serve.mjs` (serves `scripts/` as `/pe_lib/` with three r128 and r186.1 from npm and a pretend library), `sculpt_next_run.mjs` (headless runner with CPU throttling), `sculpt_next_emblem_shot.html`, `sculpt_next_emblem_page.mjs` (builds the emblem preview page from the engine files), `sculpt_next_debug.html`.

## Tests (no headset)

`bst_vr_sculpt_selftest.html?three=128|186&engine=next` (append `&only=clay,brushes,shapes,cutter,layers,hold,figure,export,worker,timing,flow,emblem,menu` for parts). Every existing check of the current engine passes on the next engine (r128 and r186), then about 140 more: clay watertight with exact undo / redo, mirror / 360 / both, each brush's effect with exact undo (12/12), shapes and gizmo, booleans, saw (one undo per sweep), plane cut (keeps 47%), carve, erase, stamp into clay, clay as a stamp into an object, mixed undo with the current engine's saw, every layer operation, Hold, the stabiliser, the support-hand smooth, the palm-up swap, haptic ticks, finish, the asset bench, expression pulses, a recorded expression saved and reloaded from the .glb, the emblem (4 layers, colours, spin, Spin clip in the .glb, undo), the menu (62 rows, every icon resolves, every SVG parses, 49 one-step lessons). **Figures:** after every brush, the saw and a shape cut, the skin indices, skin weights, rest shape, an existing key ("Smile"), the bones, bone inverses and bind matrix are byte-identical; the .glb reloads with 11/11 bones, its weights and all keys.

## What could not be tested here

- Real fingertips on Ruth's Quest, the Quest's own frame rate (GPU) and the headset log beats; module workers in the Quest Browser (the engine falls back to the page thread if the worker does not start).
- The palm-up detection and the haptic tick on real hardware; the `vr_core.js` hook inside the live Atelier / BSA pages (those pages, `female.glb` and the app's models were not in the package; the hook passes a syntax check and is guarded).
- The existing check `renderedChange` fails on the built test figure for both engines (camera framing written for `female.glb`), so it says nothing either way here.
- Textures from the Atelier's library and its skin shaders on clay: clay works are not yet in the Atelier's own object list (`VRObjects`, not in the package), so its Style panel cannot pick them; clay has vertex paint and per-layer finish meanwhile. Whether the Atelier plays a library item's animation clips (Spin, expressions) was not checked.
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
| CLAY | Mode: add / subtract / paint / intersect | `opAddIc / opSubIc / opPaintIc / opIntersectIc` |
| CLAY | Colour: clay / terracotta / sky / leaf / sun / lilac / bone / slate | `tintIc` |
| CLAY | Size N cm | `brushSize` |
| CLAY | Strength N% | `strengthBars` |
| CLAY | Symmetry: off / mirror / 360 / mirror + 360 | `symOff / symMirror / symRound / symBoth` |
| CLAY | Steady: off / some / lots | `steadyIc` |
| CLAY | Edge: smooth / linear / sharp / flat | `falloffIc` |
| CLAY | Clay: round / ribbon (when Clay is picked) | `clayIc` |
| CLAY | Dots: balls / rings / cubes / spikes (when Dots is picked) | `dotsIc` |
| CLAY | Finish: matte / satin / gloss / metal / glow | `finishIc` |
| CLAY | Other hand smooths: on / off | `supportIc` |
| CLAY | New asset / Back to the figure | `assetIc / backFigureIc` |
| CLAY | Expressions ▸ | `motionIc` |
| EXPRESSIONS | ▶ <shape key> (one tile per key, tap to play it) | `pulseIc` |
| EXPRESSIONS | Pulse: quick / normal / slow | `pulseSpeedIc` |
| EXPRESSIONS | Plays: once / 3 times | `repeatIc` |
| EXPRESSIONS | Record face / Stop recording | `recordFaceIc` |
| EXPRESSIONS | Play the move | `playMoveIc` |
| CLAY | Undo stroke / Redo stroke | `undoStroke / redoStroke` |
| CLAY | Shapes ▸ | `shapesIc` |
| CLAY | Layers ▸ | `layersIc` |
| SHAPES | Place a shape | `placeShapeIc` |
| SHAPES | Shape: sphere / cube / cylinder / cone / torus / capsule | `primSphere / primCube / primCylinder / primCone / primTorus / primCapsule` |
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

## One lesson step per tool

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
| Colour | Tap Colour to choose the colour new clay and paint come out in. Then set Mode to paint and brush over clay to colour it. | Colour: clay (`tintIc`) |
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
| Finish | Pick a clay layer, then tap Finish to step through matte, satin, gloss, metal and glow. | Finish: satin (`finishIc`) |
| Other hand smooths | Sculpt with one hand; without letting go, pinch with your other hand and rub: that hand smooths while the first keeps its brush. | Other hand smooths: on (`supportIc`) |
| Expressions | Open Expressions and tap a shape key: the face moves into it and back, smoothly, like a real expression. | Expressions ▸ (`motionIc`) |
| Pulse speed | Tap Pulse to choose quick (a micro-expression, 0.3 s), normal or slow (1.5 s). | Pulse: normal (`pulseSpeedIc`) |
| Record a move | Tap Record face, play a few expressions, then Stop recording: it becomes an animation that Save figure keeps in the .glb. | Record face (`recordFaceIc`) |
| Play the move | Tap Play the move to watch the last recorded expression move once. | Play the move (`playMoveIc`) |
| Make the emblem | Tap Make the emblem: your two-figure emblem appears beside you in clay, in its own colours, and turns slowly. Each part is a layer you can pick and keep shaping. | Make the emblem (`emblemIc`) |
| Spin | Pick some clay, then tap Spin: the whole work turns slowly round, one turn every 10 seconds. Tap again and it eases to a stop. Save clay keeps the spin. | Spin: off (`spinIc`) |
| Saw on clay | Pick Saw on the first Sculpt page and sweep it through clay with the trigger held: a slit as wide as the Size ring is cut, the rest stays. It saws figures and objects as before. | Saw (`cutIc`) |
| Carve and stamp on clay | Carve and Stamp work on clay too: sweep Carve to dig a groove, or press a picked object in with Stamp to carve its shape out of the clay. | Carve (`carveIc`) |
