# Sculpt engine slot

The Atelier and the BSA load `lib/sculpt_next_engine.js` when the Sculpt menu (More tools) says **Engine: next**.
Switch with the tile, leave Sculpt, enter Sculpt again. If the new engine fails to load, the page says so and uses the current one.

## Contract (what the page expects)
`export function createVrSculpt(THREE, core, host)` returns an object with:
- `cfg` : settings the menu reads and writes. Needs at least `mode, size (cm), strength (%), sym ('off'|'mirror'|'radial'), cutGoes, cutCap, cutBlade ('saw'|'plane'), carveKeep, stampScale, count, on`.
- `set` : `{mode,size,strength,sym,cutGoes,cutCap,cutBlade,carveKeep,stampScale,count,profile,thick,color}` each a function(value).
- `enter(figureRoot)` -> bool, `leave()`, `frame(hands, dt)` every XR frame (`hands` = `[{id, tip:Vector3, dir:Vector3, quat, pinch, grip, ...}]`), `undo()`, `redo()`, `canUndo()`, `canRedo()`, `strokes()`.
- `setFilter(fn|null)`, `filtered()` : limit which meshes the tools touch (clothes only / body only).
- `newKey()`, `keys()`, `setKey(name,value)`, `save(name)` (returns a Promise), `cursor` (what the page draws: ball, plane, ghost), `squeezed`, `repose()`, `endAll()`, `cutAt(hand)`, `stampAt(hand)`, `entryOf(mesh)`, `nearest(entry,p,reach)`.
- `host.dirty(mesh)` must be called after every edit (it saves the scene and the clothes' cuts); `host.strokeStart()` before the first change of a stroke (it pushes the page's undo).
- Geometry edits replace `mesh.geometry` and keep the skin attributes (`skinIndex`, `skinWeight`) and shape keys (`morphAttributes.position`).

The current implementation to copy from or replace: `lib/bst_vr_sculpt.js`, `bst_sculpt_core.js`, `bst_cut.js`.

## Optional parts the next engine adds (the current engine has none of them; the page checks before using each)
- `icons` (picture-tile SVGs, merged into the page's ICONS), `menu(pg, ui)` for its own pages 10–13 (CLAY, SHAPES, LAYERS, EXPRESSIONS) with `ui = { draw(), page(n), say(t) }`, `menu.entry(ui)` (the "Clay & shapes ▸" tile), `menu.redraw()`, `menuTitle(pg)`, `lessons` (one step per tool), `tiles` (the tile list).
- `idle(dt)` every frame while Sculpt is closed (a spinning work keeps turning; a shared session keeps up).
- Hands may carry `alt` (a mapped button) or `palmUp` (a tracked hand turned palm up): the stroke takes the partner mode (add <-> subtract). `cursor.hands[id].pulse` (0..1): a soft haptic tick the page plays.
- `together.start({ url | transport, name })`, `together.stop()`, `together.on`, `together.people()`: sculpting together through a relay (`tools/sculpt_next_relay.mjs` or `.py`). Address: `host.collabUrl()`, else `localStorage.sculptTogetherUrl`, else `ws(s)://<page host>:8787/?room=atelier`.
- Host functions it uses when present: `head()` -> `{ p: Vector3, q: Quaternion }` (the headset's pose: your avatar on the others' headsets), `loadAvatar(url)` -> Promise of a figure (a MakeHuman or other rigged .glb), `floor()` (floor height, default 0), `userName()`, `props()`, `stampSource()`, `addObject(o)`, `removeObject(o)`.
- `openWheel()`, `closeWheel()`, `wheel` (the colour wheel), `gradients`, `skins`, `looks` (the names), `makeEmblem()`, `joinPieces()`, `assets()`, `spin(obj, secondsPerTurn | 0)`, `pulse(key)`, `recordMotion()`, `stopMotion()`, `playMotion()`, `newAsset()`, `endAsset()`, `exportGlb(roots)`, `makeClay(mesh)`, `clay` (layers), `shapes`, `hold`.
