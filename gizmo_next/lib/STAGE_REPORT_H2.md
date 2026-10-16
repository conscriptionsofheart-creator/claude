# STAGE REPORT H2: beat actions

**Done.** `gizmo_next_actions.js`, selftest, demo page, README, CHANGES, RAY SPEC, wiki card and change row, lesson draft. A beat can play a recording (hold equals its length), change only some look parts, set a face, start or stop a sound, play a ragdoll clip, seat a figure, call a script, or cut to a camera shot. Flash clamp. Stop and Pause stop voice and sounds.

**Selftest.** 21/21 (96/96 with G0 and H1), in node and the demo page in headless Chromium. About 0.01 ms a tick.

**Untested.** Real narration and jaw, `applyLook` merging, the wardrobe list, sound gizmo, clip player, seat, scripts, camera, a friend, Quest frame cost.

**The seat wires in.** Adapters `ctx.narration`, `ctx.look.allowedClothes`, `ctx.face`, `ctx.sounds`, `ctx.clips`, `ctx.seat`, `ctx.scripts`, `ctx.camera`. Icons `voice`, `look`. The guest manifest. Then the ray spec.

**Open facts, defaults used.**
1. Adapter shapes are mine, tested against fakes.
2. No cleared list connected: all clothes refused.
3. Shader names are not checked and switch at mid blend.
4. A friend starts no voice or sound.
5. Face, ragdoll, seat stay quiet until connected.

**One question.** Is `wardrobe_cleared.json` the only clothes list? If no answer, it is.
