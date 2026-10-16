# STAGE REPORT H6: seat gizmo v2 and the Walk pop-up

**Done.** `gizmo_next_seat.js`, selftest, demo page, README, CHANGES, RAY SPEC, wiki card and change row, lesson draft. A sidecar over `SeatGizmo`: the Sit pop-up (80 cm, facing within 60 degrees, Walk on, Fly off), library Pose, Exit Direction, who, one at a time, nudge, height from the surface, head target seat plus 0.46 stature without scaling, fade 0.25 s, blend 0.6 s, stand in 0.5 s, stick ignored while seated, events, figures, a seat beat.

**Selftest.** 25/25 (195/195 with earlier stages), in node and the demo page in headless Chromium.

**Untested.** The real `SeatGizmo` and body solve, the pose library, the dolly lift and fade, the stick, a friend seeing it (H9), Quest frame cost.

**The seat wires in.** H6-1 (the floating tile, a ray press calls `sit`), `ctx.stature`, `surfaceAt`, `sitRig`, `standRig`, `poseLib`, `figureSeat`, panel rows, guest manifest. Then the ray spec.

**Open facts, defaults used.**
1. The pose library only through `ctx.poseLib`.
2. Lying head height 0.2 m above the surface.
3. Stature 1.7 m when none is given.

**One question.** Is 0.2 m right for a head on a bed? If no answer, it stays.
