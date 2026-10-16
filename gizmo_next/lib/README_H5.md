# README H5: spawn point v2 and the snap spot

A sidecar to the page's `SpawnPoint` (`lib/spawn_point.js`). It does not copy that file and adds no second gizmo. `SpawnPoint` keeps the record `{id, name, x, y (the floor), z, yaw (0 faces -z), locked, group}`. This part keeps the extra fields in its own state, keyed by the point's id, and adds Meta's fields and ours, picking, respawn, a floor check, the snap spot, and a fade (never a flash) when someone arrives.

Nothing moves on open. Loading a scene moves nobody. Nobody is sent anywhere unless Gizmos live is on (a join, a respawn, a trigger) or a person presses Test arrive. A friend's page only obeys a message from the host, and only for itself.

Depends on G0. Part name `spawn`, needs only the core. Guests need H9 to carry the message.

## Files

| File | What it is |
|---|---|
| `gizmo_next_spawn.js` | The sidecar. In `GizmoNext.PARTS`. |
| `gizmo_next_spawn_selftest.js` | 23 checks. `node gizmo_next_selftest.js --only=spawn`, or the demo page. |
| `gizmo_next_trigger.js` | Changed a little: a trigger's "Send to a spawn point" now goes through this part when it is there. |
| `gizmo_next_demo.html` | Add spawn point, Guest joins, Test arrive, drawn on the map. |
| `gizmo_next_H5_RAY_SPEC.md`, `wiki_spawn-point-v2.json`, `lesson_spawn-point-v2.md`, `CHANGES_H5.md`, `STAGE_REPORT_H5.md` | Real-ray test, wiki card and change row, lesson draft, change note, report. |

## The extra fields (Meta's names first)

`mode` (`start` = Spawn on Start, where the world opens; `trigger` = With a trigger, an entry only a trigger or script sends people to; `script` = Script attached), `spawnOnStart` (true when mode is start), `setPositionOnly` (off = the visitor turns to face the arrow), `face` (`arrow`, `object` with `faceTarget`, `host`), `gravity` 0 to 9.81 (default 9.81), `speed` 0 to 45 (default 4), `who` (`everyone`, `guests`, `me`, `named` with `names`), `order` 1 to 99 (default 1), `pick` (`order`, `turns`, `random`), `respawnBelowY` (null or metres), `respawnIfLeave`, `snap` (Snap spot). The defaults are printed on the panel (Meta states none).

## API (`GizmoNext.spawn`)

- `fields(id)`, `setFields(id, patch)` (clamped, one Undo step is the caller's), `list()`, `count()`, `defaults()`.
- `choose(visitor, {commit:false}?)`: among points that are Spawn on Start and listen to this visitor, the lowest Order. Take turns and Random read the lowest point's Pick: take turns goes 1, 2, 3, 1 over each arrival; random uses a generator you can seed (`seed(n)`), so a test repeats.
- `floorCheck(point)`: `{ok, y}` or `{ok:false, message}`. No floor under it (`ctx.floorAt` gives nothing) or inside something solid (`ctx.solidAt`) is refused with a plain message. A point is never used unless it passes.
- `arrive(visitor, point)`: `{point, x, y, z, yaw, setPositionOnly, gravity, speed, fadeSec:0.4}`. `yaw` is null with Set Position Only (the visitor keeps its facing).
- `send(visitorOrId, pointIdOrNameOrOrder?)`: the host moves someone (a trigger, a script). `onJoin(visitor)`: the seat calls it when a friend joins (H0 number 1). `testArrive(pointId?)`: moves only the local rig.
- `snapSpots()`, `snapAim(x, z)`: within 1 m of a snap spot, the walk-teleport aim goes to the spot's centre and takes its facing.
- `rows(id, H)`: the panel rows for a spawn point (mode, Set Position Only, Face, Player Gravity, Player Speed, Who, Order, Pick, Respawn below, Respawn if I leave the room, Snap spot, Check this point, Test arrive).
- Events on the bus: `arrive {who, point, arrival}`. Each arrival is logged ("Rosa arrived at Spawn point 2").
- Respawn: when live, someone whose feet fall below `respawnBelowY`, or who leaves the room (`ctx.inRoom`), is sent back, at most once every 3 s each.
- Arrival is a fade of 0.4 s, and one person is never moved more than twice a second. Friends are sent a `spawn` message (host only, 10 a second at most) and obey it only if it names them.

## SEAT EDITS (this stage)

1. H5-1: `spawn_point.js` `if(list.length>=1) return null;` becomes `if(list.length>=(SpawnPoint.max||1)) return null;`; `vr_objects.js` api.spawn.add `if(SpawnPoint.first()){ return null; }` becomes `if(SpawnPoint.list.length>=(SpawnPoint.max||1)){ return null; }`; the `dupObj` spawn branch is allowed. Set `SpawnPoint.max = 4` (or the cap she wants).
2. In `lib/gizmo_next_host.js`: `ctx.spawn = window.SpawnPoint`, `ctx.teleport(visitor, arrival)` (move the dolly to `x, y, z`, turn to `yaw` unless it is null, apply `gravity` and `speed`, with the edge fade of `arrival.fadeSec`, like Carried), `ctx.solidAt(x, y, z)`, `ctx.inRoom([x, y, z])`, `ctx.selfId()` (this page's id as the others see it), `ctx.floorAt` (a number, or nothing when there is no floor).
3. When a friend joins (H0 number 1): `GizmoNext.spawn.onJoin({id, name, guest:true, head, feet})`. If it returns null the existing `SpawnPoint` behaviour stands.
4. The object panel for a spawn point appends `GizmoNext.spawn.rows(id, H)`. The walk-teleport aim calls `GizmoNext.spawn.snapAim(x, z)`.
5. The `spawn` message rides the sync bridge (E10) like the others; a friend's page obeys it through `GizmoNext.sync.apply('spawn', obj)`. Add `gizmo_next_spawn.js` to `guest_manifest.json`.

## Open facts, and the default used

1. **Meta's spawn defaults and maximum count** are unverified. Ours: gravity 9.81, speed 4, order 1, up to `SpawnPoint.max` points (4 suggested).
2. **Whether guests arrive on the point today** (H0 number 1) is not proven here. `onJoin` is what the seat calls to make it so, and it works only while Gizmos live is on.
3. **A joining guest's feet** come from `ctx.peers()`; if only a head is given the feet are taken as 1.6 m lower.
4. **Respawn needs `ctx.inRoom`** for the leave rule. Without it that rule does nothing.
5. **Quest frame cost** is not measured; the part does work only while live and only when a rule needs it.
