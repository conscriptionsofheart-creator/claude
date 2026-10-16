# STAGE REPORT H5: spawn point v2 and snap spot

**Done.** `gizmo_next_spawn.js`, selftest, demo page, README, CHANGES, RAY SPEC, wiki card and change row, lesson draft. A sidecar to `SpawnPoint`: several points, Spawn on Start, With a trigger, Script attached, Set Position Only, facing, Gravity and Speed, Who, Order, Pick (order, turns, random), respawn, floor and solid checks, snap spot, 0.4 s fade, Test arrive for the local rig only.

**Selftest.** 23/23 (170/170 with earlier stages), in node and the demo page in headless Chromium.

**Untested.** The real `SpawnPoint` with its limit lifted, the real dolly move and fade, a friend arriving through the guest door, Quest frame cost.

**The seat wires in.** H5-1 (the two one-point limits, `SpawnPoint.max`), the adapters `ctx.teleport`, `solidAt`, `inRoom`, `selfId`, `onJoin` on a guest joining, the panel rows, `snapAim`, the guest manifest. Then the ray spec.

**Open facts, defaults used.**
1. Gravity 9.81, speed 4, order 1, up to 4 points.
2. Arrival on join works only with Gizmos live on.
3. Leave-room respawn needs `ctx.inRoom`.

**One question.** Should a joining guest land on a point even with Gizmos live off? If no answer, no.
