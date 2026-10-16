# STAGE REPORT H4: record and play a rag doll fall

**Done.** `gizmo_next_ragdoll.js`, selftest, demo page, README, CHANGES, RAY SPEC, wiki card and change row, lesson draft. Record fall at 30 Hz into a clip in clip_player's format, kept as small text, played through `ctx.clips`, `audit` (knees, floor), Undo last recording, files for the saved scene, a `ragdoll` beat. Too long gives a plain message.

**Selftest.** 17/17 (147/147 with earlier stages), in node and the demo page in headless Chromium. Quantisation 0.0045 degrees, 10 s is 70 KB.

**Untested.** The real RAGP doll and its joints, the real `ClipPlayer` on a body, knee axis, a friend getting the clip, `scene_store.js` carrying files, Quest frame cost.

**The seat wires in.** H4-1: `ctx.ragdoll {joints, isFalling, map}` from RAGP. `ctx.clips` over `ClipPlayer`. The scene saver carries `ragdoll.files()`. The guest manifest. Then the ray spec.

**Open facts, defaults used.**
1. Clip layout as read in `clip_player.js`.
2. Joint map defaults to 1 to 20 in order.
3. Knee axis assumed x, positive forward.
4. A friend gets no clip until H9.

**One question.** Does RAGP's joint order match the clip's? If no answer, 1 to 20 in order.
