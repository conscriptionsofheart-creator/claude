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
