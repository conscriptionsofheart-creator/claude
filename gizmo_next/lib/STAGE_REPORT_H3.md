# STAGE REPORT H3: trigger box

**Done.** `gizmo_next_trigger.js`, selftest, demo page, README, CHANGES, RAY SPEC, wiki card and change row, lesson draft. Gizmo kind `trigger`: shows its whole volume when selected or hovered, Meta's panel names, who, when and how often, starts with delays (beats range, sound, spawn, seat, script, show, hide), 15 cm hysteresis, 40 box tests a frame, 25 m sleep, Test it, the Greeting template. Named beat ranges.

**Selftest.** 34/34 (130/130 with earlier stages), in node and the demo page in headless Chromium. About 0.04 ms a tick.

**Untested.** The real marker, handles and two-hand resize, `RoomPresence`, spawn, seat, scripts, sound, the headset "When..." menu, a second tab, Quest frame cost.

**The seat wires in.** H3-1 (`whenSub` uses `trigger.whenOptions()`), the adapters in the host file, pointer hover to `setHover`, the guest manifest. Then the ray spec.

**Open facts, defaults used.**
1. Label "Triggered By".
2. Cap of 12.
3. A scene saved with Gizmos live on opens live.
4. Adapters for spawn, seat, script, show and hide are mine.

**One question.** Should a scene always open with Gizmos live off? If no answer, it opens as saved.
