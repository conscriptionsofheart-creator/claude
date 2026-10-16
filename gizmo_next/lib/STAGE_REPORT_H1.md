# STAGE REPORT H1: scene clock and Beat strip

**Done.** `gizmo_next_beats.js`, selftest, demo page, README, CHANGES, RAY SPEC, wiki card and change row, lesson draft. Scene clock, CastPins-shaped list, pure sampling, Add beat (an unchanged pose is refused, the clock moves on by the gap), Play, Pause, Stop, scrub, Once, Loop, Yoyo, bracket, prop moves, keyframe conversion, strip model and rows, 2D panel, friend transport. Looks kept 0.4 s apart.

**Selftest.** 31/31 (75/75 with G0), in node and the demo page in headless Chromium. About 0.02 ms a tick.

**Untested.** Real `snapshotObj`, `bodyLook`, `CastPins`, `direction.js`, `RoomSync`, the strip at 2.0 cm, Quest frame cost, bone blending, the page's Undo.

**The seat wires in.** `ctx.pose`, `ctx.look`, `ctx.songTime`, `ctx.selectedSlots`. `SCENE_PINS` to `beats.pins()`, `_songT()` fallback to `beats.time()`. The Animate tile (E11). Icons. Undo to include `GizmoNext.state()`. The guest manifest. Then the ray spec.

**Open facts, defaults used.**
1. Play works with Gizmos live off.
2. Pose and look shapes unknown, blended number by number.
3. Three `__kf` frame shapes accepted.
4. Loop jumps back.
5. Creatures are not beats.

**One question.** Should Play also need Gizmos live? If no answer, it does not.
