# README H10: the scripting layer

Better scripting and sequencing than Horizon, with real code as the base. The app's scripts (`obj_scripts.js`) stay real JavaScript written in the Atelier. This stage adds what a script can reach, blocks that write that code, five templates, and a log with Test it with me. Nothing here runs by itself: it does something only for a script the page has started (Scripts on), or when she presses Test it with me.

Depends on H3's bus events (`enter`, `leave`), and uses H1, H5, H6, H8 through the same calls the Trigger box uses. Parallel-safe: it touches `obj_scripts.js` in one place and `atelier_scripts.js` in one place.

## Files

| File | What it is |
|---|---|
| `gizmo_next_script.js` | Part `script`: `extend`, fields, events, enter and leave, raycast, spawn budget, scene variables, visitor counts, blocks storage, Test it with me, the Blocks strip. |
| `gizmo_next_blocks.js` | `GizmoNext.Blocks`: the block model, the checker, and the code generator. Pure; no eval and no Function. |
| `gizmo_next_templates.js` | `GizmoNext.Templates`: five templates, each a block list plus its trigger box as JSON. |
| `gizmo_next_script_sandbox.js` | A model of `obj_scripts.js` for tests and the demo only. Not shipped, not in the guest list. |
| `gizmo_next_script_selftest.js` | 19 checks. `node gizmo_next_selftest.js --only=script`, or the demo page. |
| `gizmo_next_H10_RAY_SPEC.md`, `wiki_scripting-layer.json`, `lesson_scripting-layer.md`, `CHANGES_H10.md`, `STAGE_REPORT_H10.md` | Real-ray test, wiki card and change row, lesson draft, change note, report. |

## What a script gets

`GizmoNext.script.extend(inst, {world})` returns `{names, values}`: `emit, fields, visitor, spawnObj, onEnter, onLeave` (the stage file lists the first four; `onEnter` and `onLeave` are in its API text, so they are names too). It also adds to `world`: `raycast`, `spawn`, `despawn`, `vars`.

- `emit(name, payload)` sends an event to every running script; `on(name, fn)` (the app's own `on`) hears it. Events sent from events stop after 6 levels and 200 a second. `emit('gizmo', {do, arg, ...})` is the door to the rest of the app (below).
- `fields({speed: {type:'number', default:1, min:0, max:5, step:1}, who: {type:'text'}, loud: {type:'bool'}, mood: {type:'text', choices:['calm','happy']}})` declares editable settings. Read them as `fields.speed`. They appear as panel rows (`script.fieldRows(key, H)`: Speed: 1, Speed lower, Who: none, Loud: off, Mood: calm) and are saved with the scene. **The stage text wrote `fields = {...}`. A script cannot hand a reassigned name back to the page, so the call form `fields({...})` is used.**
- `onEnter([name], fn)`, `onLeave([name], fn)`: for trigger boxes (bus `enter`, `leave`) and seats (bus `seat`, enter and exit). `fn` gets `{type, who:{id, name, guest, kind}, target:{kind:'trigger'|'seat', id, name}, test}`. A name filters by the box or seat name or id.
- `world.raycast(from, dir, {tag, distance})` returns the nearest `{name, id, distance, point}` or null. `ctx.raycast(from, dir, {tag, distance})` is used if the page has one; otherwise props with that tag are tested as spheres (radius 0.5 m unless the prop says). Distance is limited to 200 m.
- `world.spawn(kind, pos)` / `spawnObj(kind)` / `world.despawn(thing)`: 20 live at once (`setSpawnBudget`, 1 to 100). Needs `ctx.spawnObject(kind, pos)` and `ctx.despawnObject(thing)`. Scripts off despawns them all.
- `world.vars.name = value`: numbers, text up to 200 characters and yes or no, 64 at most, saved with the scene. Bad values are quietly ignored.
- `visitor.count(name)`: how many times a visitor of that name entered a trigger. **Off by default** (`script.setVisitorCounts(true)`); kept on her machine only, never in the scene and never sent.

## The door for blocks and scripts: `emit('gizmo', {...})`

`do` is one of beats (play a named range), sound (`once`, `loop`, `stop`), seat (a seat name, or `stand`), spawn (a spawn point name), effect (an Effects gizmo name, `once`, `loop`, `stop`), show, hide, say, set (a scene variable) or emit (an event). The page checks every one again; nothing else is allowed. Host only.

## Blocks

`script.setBlocks(key, json)` checks the list, makes the code, stores both, and tells `ctx.objCfg.setCode(key, code)` if the page has it. A rule reads like "When a guest enters Doorway: play beats Greeting, then wait 2 s, then seat them in Chair 1". Who: anyone, guest, host or a name. Event: enters, leaves, hears (an event name), starts. Steps: the eleven blocks above plus wait (0 to 600 s). At most 12 rules of 24 steps. Every text is cut to 80 characters, control characters, line separators and dashes are removed, and goes into the code as a JSON string, so a name can never end the string or add a statement. The first line of the code says it was made from blocks.

**Edited as code.** When the code in the Scripts tab stops matching what the blocks make (`script.codeEdited(key, code)`), the script is marked edited and its blocks grey out (`blocksState` returns `{mode:'code', greyed:true}`). Putting the blocks back is `setBlocks` again. **A round trip from code to blocks is not promised.**

## Templates

Greeting at the door, Doorbell, Welcome chair, Music when someone enters, Fall and get up. `script.installTemplate(id)` adds the trigger box (never armed), names the beat ranges it plays (when a beat list exists), makes the code, and returns `{id, name, key, code, blocks, gizmos, note}`. She edits the blocks or the code from there.

## Log and Test it with me

Every block that runs adds a line to the shared `g.logList()` and to `script.runLog()` (`{t, key, rule, step, text}`); `script.running()` names the block that ran in the last 1.5 s, for the strip to highlight. `script.testIt(key)` sends a pretend guest called A test visitor through the blocks. Delayed steps need Gizmos live on. If the script was edited as code it is sent through the running handlers instead (Scripts must be on).

## SEAT EDITS

**H10-1, `obj_scripts.js` `make()`** (about line 118): build the world once and append the extras.

```
const W = makeWorld();
const X = (window.GizmoNext && GizmoNext.script) ? GizmoNext.script.extend(inst, { world: W }) : { names: [], values: [] };
fn = new Function('me','world','on','every','after','say','play','log','THREE', ...X.names, '"use strict";\n' + code);
fn(h, W, on, every, after, say, play, (...a) => logIt(inst, a), window.THREE, ...X.values);
```
and in `setOn(false)` after the stop handlers: `if (window.GizmoNext && GizmoNext.script) GizmoNext.script.scriptsOff();`.

**H10-2, `atelier_scripts.js`**: mount `GizmoNext.script.mountBlocks(el)` in the Scripts tab, and call `GizmoNext.script.codeEdited(key, code)` when the code box changes. Optionally `ctx.objCfg.setCode(key, code)`, `ctx.objectVisible(name)`, `ctx.spawnObject`, `ctx.despawnObject`, `ctx.raycast`.

## Open facts, and the default used

1. `obj_scripts.js` was read; `atelier_scripts.js` was not (no file in the package), so the Scripts tab hook is a description.
2. The assignment form `fields = {...}` is not possible; `fields({...})` is used.
3. `ctx.objectVisible(name)` is optional; without it Scripts off puts a shown or hidden object back to the opposite of what the script did.
4. Spawn kinds are any name of letters, digits, spaces, underscores and dashes up to 40 characters; the page decides what exists.
5. Quest frame cost is not measured; the part does nothing when no script runs.
