# README H6: the seat gizmo's remaining work and the Walk pop-up

`seat_gizmo.js` is already in the app (chair, sofa, floor, bed and Lie presets, the stand lock, Sit here and Stand rows, registered with Gizmos). This part does not rebuild it. It is a sidecar over `ctx.seat` (the page's `SeatGizmo`). `SeatGizmo` keeps the record `{id, name, x, y (the floor point), z, yaw (0 faces -z, the way the knees point), preset, lie, locked, group}`. This part keeps extra fields in its own state, keyed by the seat's id, in Meta's names where Meta has them.

Nothing runs on open. A seat takes someone only when a person presses Sit, or a trigger or a seat beat says so. A friend's page is never seated from here (H9 carries that).

Depends on G0 and H2 (the seat beat). Part name `seat`, needs `actions`. It replaces H2's placeholder `seat` action with one that sits figures.

## Files

| File | What it is |
|---|---|
| `gizmo_next_seat.js` | The sidecar. In `GizmoNext.PARTS`. |
| `gizmo_next_seat_selftest.js` | 25 checks. `node gizmo_next_selftest.js --only=seat`, or the demo page. |
| `gizmo_next_trigger.js` | Changed a little: a trigger's "Sit them in a seat" goes through this part when it is there. |
| `gizmo_next_demo.html` | Add seat, Walk to the seat, Sit, Stand, with the Sit tile drawn on the map. |
| `gizmo_next_H6_RAY_SPEC.md`, `wiki_seat-gizmo-v2.json`, `lesson_seat-gizmo-v2.md`, `CHANGES_H6.md`, `STAGE_REPORT_H6.md` | Real-ray test, wiki card and change row, lesson draft, change note, report. |

## The extra fields

`pose` (`default`, or the name of a pose in the library), `useExit` and `exit` (Use Custom Exit Direction and Exit Direction: the way you face when you stand, as an `[x, z]` direction in the seat's own frame, default forward `[0, -1]`), `who` (`everyone`, `guests`, `me`, `named` with `names`), `oneAtATime` (default true), `nudge` (`[x, y, z]` metres, each limited to 0.3), `autoHeight` (Height from the surface, default off: the preset height stands unless this is on). Defaults are printed on the panel.

## API (`GizmoNext.seat`)

- `fields(id)`, `setFields(id, patch)`, `list()`, `defaults()`.
- `popup(headPos, headDir, stature)` returns `{seatId, anchor:[x,y,z], label:'Sit', distance}` or null. It answers only while Walk is on and Fly is off (`ctx.walk()`), the head is within 0.8 m of the seat, facing it within 60 degrees, the seat is free and is for this person, and the person is not already seated. The host draws the tile at `anchor` (a text-free chair icon in the headset, a word on web and 2D). A real ray press on it calls `seat.sit(seatId)`.
- `sit(seatId, who?)`: the seat height is the preset's (or from the surface, plus the nudge); the head target is `seatTargetHead(seat, stature)` = the seat surface plus 0.46 of the stature (Lie: the surface plus 0.2 m), so the rig is lifted by `target minus head height` and the body is never scaled. The plan goes to `ctx.sitRig(who, plan)`: `{seatId, anchor, target, headTarget, lift, pose, lie, fadeSec:0.25, blendSec:0.6, walkDisabled:true, yaw}`. Timeline from this part: the edges fade 0.25 s, then the sit pose blends in over 0.6 s (`phase(who)`: fade, blend, seated; `blend(who)` 0 to 1; `ctx.poseLib.apply(who, name, k)` each frame for a library pose). With no `ctx.sitRig` it falls back to `SeatGizmo.sitOn(id)`.
- `stand(who?)`: blend out over 0.5 s, then `ctx.standRig(who, {x, y (from ctx.floorAt), z, yaw, ...})`, a floor point 0.7 m in front of the seat, or in the Exit Direction. Walk comes back.
- `onStick(who, x, y)` returns `free`, `ignored` or `stand`: the stick does nothing while seated except pulling back to stand.
- One person at a time: a taken seat refuses a second person with a plain message; `occupant(id)`, `seated(who)`.
- Events on the bus: `seat {seatId, who, state:'enter'|'exit'}` (Meta's OnPlayerEnter and Exit AvatarPoseGizmo).
- Figures: `figureSit(slot, seatId)` and `figureStand(slot)` through `ctx.figureSeat {sit(slot, plan), stand(slot, plan)}`. The head target uses the figure's own `stature` when it has one. The seat beat (`seat {slot, seatId|'stand'}`) calls them; its hold is the 0.6 s blend.
- `rows(id, H)`: Defaults, Pose (cycles Default sit and the library's sits), Use Custom Exit Direction, Exit Direction (Front, Right, Back, Left), Who can use it, One person at a time, Height from the surface, Nudge up, down, forward, back by 2 cm, Reset the nudge, Sit here or Stand.

## SEAT EDITS (this stage)

1. H6-1: a floating tile at `popup(...).anchor` each frame while Walk is on (`GizmoNext.seat.popup(head, headDir, stature)` with the head position and its horizontal direction); a real ray press on it calls `GizmoNext.seat.sit(seatId)`. The Stand tile and the stick call `GizmoNext.seat.stand()` and `onStick`.
2. In `lib/gizmo_next_host.js`: `ctx.seat = window.SeatGizmo`, `ctx.stature()` (the calibrated stature, arm span times 1.00), `ctx.surfaceAt(x, z)` (the top of what is under the seat, for Height from the surface), `ctx.sitRig(who, plan)` (lift the dolly by `plan.lift`, fade the edges, slide to `plan.target`, hand the sit to the body solve, walking off; never change the dolly scale), `ctx.standRig(who, point)`, `ctx.poseLib {list('sits'), apply(who, name, k), clear(who)}` over `JointPoseLib`, `ctx.figureSeat {sit, stand}` over the figure solver.
3. The object panel for a seat appends `GizmoNext.seat.rows(id, H)` to the rows `SeatGizmo.rows` already gives.
4. `presence` gets `seat:<id>` (H9). Add `gizmo_next_seat.js` to `guest_manifest.json`.

## Open facts, and the default used

1. **`joint_pose_lib.js` is not in the package.** The pose library is reached only through `ctx.poseLib`. With none, the default sit stands and one plain message says so.
2. **The lying head height** (surface plus 0.2 m) is my number, not a measurement.
3. **Meta seat API names** beyond the two events, and any physics numbers, are not confirmed. The stage file's numbers (80 cm, 60 degrees, 0.25, 0.6, 0.5 s) are used.
4. **Stature.** `ctx.stature()` when there is one, else 1.7 m. The seated eye height of 0.46 of stature is from the avatar calibration research, to within about 3 cm in the checks.
5. **A friend sitting** needs H9. Here a friend can be recorded as the occupant by a trigger, and no rig moves.
6. **Quest frame cost** is not measured. The part's tick does nothing when nobody is sitting.
