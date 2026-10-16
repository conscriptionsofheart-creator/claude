# README G0: the gizmo plug-in kit

The common core every later gizmo stage stands on. It follows `02_PLUG_IN_CONTRACT.md` sections 2 to 8. After the seat makes the edits below once, no later gizmo needs another edit to `vr_core.js` or `vr_objects.js`.

Nothing here runs when a scene opens. "Gizmos live" is a saved per-scene switch and it is off by default. This stage adds no gizmo of its own. It adds the machinery a gizmo kind plugs into, plus one test-only part (`gizmo_next_probe.js`) so the kit can be checked in the real app first.

## Files

| File | What it is |
|---|---|
| `gizmo_next_core.js` | The kit. Goes in `lib/`. Loads its parts itself from the same folder. |
| `gizmo_next_three_stub.js` | A small THREE stand-in for tests. Never ships. |
| `gizmo_next_testkit.js` | Fake clock, ctx, storage, Gizmos, audio, DOM, a host and guest pair. Never ships. |
| `gizmo_next_selftest.js` | The runner: `node gizmo_next_selftest.js [--only=core,trigger]`. |
| `gizmo_next_G0_selftest.js` | The 44 checks for this stage. Also runs in the demo page. |
| `gizmo_next_demo.html` | Opens from a file. Top-down model, a fake visitor, Gizmos live, Test it, JSON box, the selftest button. |
| `gizmo_next_host_TEMPLATE.js` | The ctx builder the seat turns into `lib/gizmo_next_host.js` (E2). |
| `gizmo_next_probe.js` | Test only. One tiny kind, the Probe box. Do not ship. |
| `gizmo_next_G0_RAY_SPEC.md` | The steps for the real-ray test. |

## How it loads

1. The seat adds one loader line to `vr_objects.js` (E1) that appends `gizmo_next_core.js?v=N`.
2. The core appends one script tag for each name in `GizmoNext.PARTS` (an array of file names in the same folder; each stage adds its own). G0 has none, so the list is empty.
3. `lib/gizmo_next_host.js` (E2) builds `ctx` and calls `GizmoNext.install(ctx)` once the scene exists. `GizmoNext.ready` turns true when the parts are loaded and install has finished.
4. `GizmoNext.version` is `"0.<stage count>"`, counted from the registered parts.

## Public API

Global, all no-ops returning `null`, `false` or `[]` before `install`, so a hook line can never break a page:
`has(kind)`, `entries(o)`, `dup(ob, at, grp)`, `del(ob)`, `restore(kind, spec)`, `get(kind, id)`, `addAt(kind, at)`, `rows(ob, H)`, `thumb(kindId, off)`, `tick(dt)`, `state()`, `load(s)`, `reset()`, `isLive()`, `setLive(b)`, `pages(where)`, `pageRows(id, H)`, `mountPanel(el)`, `sync.parts() / encodeAll(P) / validate(name, v) / apply(name, v, from)`, `icons`, `PARTS`, `loadParts()`, `register(name, meta, factory)`, `create(ctx)`, `install(ctx)`, `testkit` (node, or when `window.__GIZMO_NEXT_TEST` is set).

Part names `sync`, `icons`, `PARTS` and the function names above belong to the core. A part with one of those names still works at `g.modules.<name>` and the core says so in a warning.

### The instance `g` (what a part gets in `function(g){...}`)

From the contract: `g.ctx`, `g.THREE`, `g.now()`, `g.safe(fn, fb)`, `g.isLive()`, `g.setLive(b)`, `g.on / off / emit`, `g.defineKind(spec)`, `g.registerPage(spec)`, `g.modules`, `g.log(entry)`, `g.logList()`.

Added by this stage, so later stages do not each write their own:

| Call | What it does |
|---|---|
| `g.isHost() / isGuest() / isPrivate()` | Role of this page, guarded. |
| `g.say(t)`, `g.redraw()`, `g.pushUndo()` | Toast, redraw, one undo step. Guarded. `say` turns any dash into a comma. |
| `g.head()`, `g.floorAt(x, z)`, `g.peers()`, `g.figures()`, `g.props()`, `g.scene()` | Guarded reads from ctx with safe defaults. |
| `g.after(sec, fn, tag)`, `g.cancel(idOrTag)` | Timers on the tick. They die when live goes off, a scene loads or resets. |
| `g.send(name, obj)` | One event to friends. Private projects send nothing. At most 10 a second for each part. |
| `g.putFile / getFile / delFile(name)` | Big recordings in `ctx.storage` (`jb_gizmonext_file_<name>`), under 1 MB each. Guests store nothing. |
| `g.state()`, `g.load(s)`, `g.reset()`, `g.persist()`, `g.loadFromStorage()` | Scene save and load. The slot is `jb_gizmonext_atelier_v1`. |
| `g.mountPanel(el)` | The 2D twin: the Gizmos live switch, one Add button for each kind, then each part's `mountPanel`. Ids and classes start `gn-`. |
| `g.addNearHead(kind)` | Place a gizmo one metre ahead of the head, on the floor. |
| `g.dispose()` | Remove this instance's markers. Tests use it. |

Bus events: the contract's fixed list (`live`, `tick`, `scene-load`, `scene-reset`, `kind-add`, `kind-remove`, `enter`, `leave`, `fire`, `beat-play`, `beat-stop`, `seat`, `arrive`) plus `kind-change {kind, id}` after a set or commit. The bus event `tick` fires only while Gizmos live is on. A listener that throws does not stop the others.

### `g.defineKind(spec)`

As in the contract section 3, with these details settled and two additions.

- `resize`: `'none'` resets the marker scale to 1 on commit. `'scale'` saves the marker scale as `sc`. `'size'` multiplies `rec.size` by the marker scale, resets the scale to 1 and rebuilds once, in place. The marker object stays the same, only its children change.
- `build(rec, THREE)` may return nothing. The core then draws the default box: a see-through cube in the kind's colour with its picture and name on the faces (name and `glyph` drawn on a canvas, so only where there is a document). `children[0]` is always the invisible pick sphere. Every descendant gets `userData.isMarker = true`, and every decoration gets a no-op `raycast`.
- `rebuildOn: ['preset']` (added): record keys that rebuild the marker when they change. `size` always does.
- `dupReset: ['armed']` (added): record keys reset to their default when a gizmo is copied. A copy of an armed trigger starts disarmed.
- Record keys that start with `_` are runtime fields. They are never saved, synced or copied.
- `onFrame(rec, dt, env)` runs only while live and only when `rec.armed !== false`. A throwing `onFrame` is logged (at most once every 5 s for each gizmo) and the others keep running.
- `fields[]` of type `bool`, `enum`, `num`, `list` become panel rows. A `list` field may carry `choices: [...]`, which become `Add <choice>` rows on its sub page.
- Every record is cleaned on add, set, load and sync: numbers clamped, strings cut to 80 characters, lists to 24 items, unknown keys dropped, wrong types replaced by the default. `validate(rec)` may still refuse a record.
- A kind is capped at `max` (default 12, hard ceiling 64). The core says so in plain words when it refuses the next one.
- Guest pages: no entries, no copy, no delete, no placing, no saving, markers hidden, and never live from a file.

### A part

```js
GizmoNext.register('trigger', { needs: ['core'], version: 1 }, function (g) {
  g.defineKind({ id: 'trigger', name: 'Trigger box', /* ... */ });
  return { init(){}, tick(dt){}, state(){ return {}; }, load(s){}, reset(){}, onLive(on){},
           sync: { parts: { trigger: { encode(){}, validate(v){}, apply(v, from){} } } },
           pages: [], mountPanel(el){} };
});
```
`needs` orders the parts. A missing need is a clear warning and the part stays off. `tick` runs only while live unless `alwaysTick` is true. A part that registers after install is attached to the live instance, and saved state that arrived before its kind existed is kept and applied then (nothing is lost).

## Settings page and the 2D panel

The core registers one Settings page, `Gizmos live`, with the switch and the last six lines of the "what ran" log. On a guest page the row only reports. The seat shows it through `GizmoNext.pages('settings')` (E11). `GizmoNext.mountPanel(el)` is the 2D twin for the BSA and Atelier right panel. It draws no Save, Export or Download control, and on a guest page it draws no buttons at all.

## SEAT EDITS (this stage)

E1 to E13 of the contract apply as written. In addition:

- **G0-1, picture on the tile.** `vr_objects.js` `api.gizmos.thumb`: before `Gizmos.thumb(id)` add `try{ if(window.GizmoNext&&GizmoNext.has(id)) return GizmoNext.thumb(id); }catch(e){}`. Without it a new kind shows the default speaker picture. Optional, for the BSA's own Gizmos list: an `ext` hook in `gizmos.js` `thumb`. The core draws and caches its own 112 px canvas, as the stage file says to default.
- **G0-2, list fields (optional).** In the `objRows` hook pass `openPage: id => { S.sub = { title: id, rows: () => GizmoNext.pageRows(id, H) }; drawMenu(); }` inside `H`. Without it a list row only says its items.
- **G0-3, Undo.** Check that `VRCore.pushUndo` brings a gizmo move, resize, field change and delete back. If it does not, add `gizmoNext: GizmoNext.state()` to the undo snapshot and `GizmoNext.load(...)` on restore, then put the live flag back to what it was before the restore.
- **G0-4, the probe, for the ray test only.** Load `gizmo_next_probe.js` by hand after the core, run the RAY SPEC, then take the loader out. It must not be in `PARTS` or `guest_manifest.json`.

## Cost

Measured on the stub in node, 12 gizmos live and armed, 1000 ticks after 50 warm-up ticks: about 0.003 ms a tick (limit 0.05). With Gizmos live off a tick costs a couple of checks. Quest frame cost is not measured, see "Not verified".

## Tests

```
node gizmo_next_selftest.js            all stages found in this folder
node gizmo_next_selftest.js --only=core
node gizmo_next_G0_selftest.js         this stage alone
```
Open `gizmo_next_demo.html` from a file and press Run selftest. Each check prints `name: 1` or `name: 0`. The last line is `RESULT passed/total`, and the exit code is 1 if any check fails.

## Open facts, and the default used

1. Can `Gizmos.thumb` take a new symbol without editing `gizmos.js`? Unconfirmed. Default (as the stage file says): the core draws its own cached canvas, edit G0-1.
2. Where does the headset flip "Gizmos live"? The contract names no tile. Default: the Settings page `Gizmos live` above.
3. Is the registry passed in `ctx.gizmos`? The contract's field list does not include it. Default: `ctx.gizmos`, else `window.Gizmos`.
4. Gizmo boxes on a guest page. Default: hidden, and a guest cannot place, copy or delete.
5. Cap per kind. Default 12 (the stage file's figure). Meta's own limit was not found.
