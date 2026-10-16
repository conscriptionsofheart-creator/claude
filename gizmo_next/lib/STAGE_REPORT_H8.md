# STAGE REPORT H8: effects gizmo

**Done.** `gizmo_next_effects.js` (kind `effects` with Particles and Trail tabs, presets smoke, sparks, confetti, splash and Default, Simple, Tapered), selftest, demo, README, CHANGES, RAY SPEC, wiki card and change row, lesson draft. Play once, Loop, Stop, Preview, 600-particle budget across gizmos, slow fades (0.4 s), colour slew, `flashSafe`, stop then play waits two frames, beat action `effect`, friends mirror the host, silent on open.

**Selftest.** 23/23 (235/235 with earlier stages), in node and the demo page in headless Chromium.

**Untested.** Real drawing on a Quest, sharing the budget with `particle_flow.js`, hand positions, frame cost.

**The seat wires in.** `ctx.hand(side)`, `ctx.particleFlow`, the Effects tile, `fx` in sync and the guest manifest, then the ray spec.

**Open facts, defaults used.**
1. Particle presets are mine; Meta's are not confirmed.
2. One point size per gizmo (r128 limit); trail ribbon is flat in the ground plane.
3. `particle_flow.js` not read; reached only through `ctx.particleFlow`.

**One question.** Should Play on Start run when a scene opens already live? Default: no, only when live is switched on.
