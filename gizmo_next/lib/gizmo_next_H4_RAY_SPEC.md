# Ray spec H4: the real-ray test of record and play a fall

For the local seat, after the seat edits in `README_H4.md` and the H1 and H2 tests. Atelier and BSA, headset emulator, real controller-ray presses, joint audits at the page's 60 Hz step. The numbers to read are in brackets.

## Steps

1. Open a scene with a figure. Turn Gravity on (rag doll) and press Record fall on the Beat strip while the figure is still standing. [refused with a plain message about Gravity; nothing recorded]
2. Turn Gravity on and let the figure go, then press Record fall. Let it fall for 3 seconds. Press Stop recording the fall. [a clip is listed: 90 frames, about 3 s; `GizmoNext.ragdoll.clips()[0].bytes` well under 100 000]
3. Read `GizmoNext.ragdoll.audit(id)`. [`kneeMinDeg` is not below minus 1; `rootMinY` at least 0.05 above the floor; 60 Hz samples counted]
4. Stand the figure up. Press Play fall. [the figure falls the same way as it did; no physics step runs while it plays: the Jolt step count does not rise]
5. Move the figure to another place and turn it round. Press Play fall again. [the same fall in the new place and facing: record the wrist and knee turns at 0, 1 and 2 s from both plays, each pair within 1 degree]
6. Press Stop the fall. [the figure is back where it was before the play]
7. Add ragdoll beat: Fall 1 at 0.5 s on the Beat strip with a pose beat at 3 s. Press Play. [the fall starts once at 0.5 s within 0.1 s; with Loop on it starts again each pass, once each]. Press Stop. [the figure goes back]
8. Press Undo after a recording. [the last recording is gone; `GizmoNext.ragdoll.clips()` has one fewer]. Press Undo last recording. [the same]
9. Record a fall that runs on for more than two minutes. [at the limit a plain message says it is too long, shorten it; nothing is saved; the Beat strip still works]
10. Save the scene, start a New scene, open the saved one. [the falls are listed; nothing plays by itself; the ragdoll beat still plays its clip; if the clip files were not carried, the beat says "not on this computer"]
11. A friend joins. [the friend's page shows no Record fall; (H9 decides whether the clip reaches them)]
12. Frame rate while a fall plays, with 4 figures. [at least 20 fps on the Quest; write the number]
