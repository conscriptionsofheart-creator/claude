# Ray spec H2: the real-ray test of beat actions

For the local seat, after the seat edits in `README_H2.md` and the H1 test. Atelier and BSA, headset emulator, a real controller-ray press for every step, muted audio read through an AnalyserNode. The numbers to read are in brackets.

## Steps

1. Make two pose beats 4 s apart (Add beat, set the clock to 4, move the hand, Add beat, set the clock to 0.5). In Narration record a short line "hello friend" for the figure. Open the Beat strip. [rows Add voice: hello friend with its length, Add shader beat, Add clothes beat, Add eyes beat, Add skin beat]
2. Press Add voice: hello friend. [a card at 0.5 s with a voice icon; its hold equals the recording's length within 0.05 s; the clock moves on past it]
3. Press Play. [the recording starts once, at 0.5 s within 0.1 s; the analyser reads above 0.05 while it speaks and 0 after; the figure's jaw moves; it does not play again in this pass]
4. Press Stop in the middle of the line. [the voice stops at once; the figure is back as it was]
5. Change the figure's shader. Press Add shader beat at 2 s. [a card with a look icon; the other parts of the look are not in the beat]. Press Play and read the figure's clothes during and after. [clothes never change; the shader changes without a flash]
6. Add a second shader beat 0.2 s after the first. [it moves to 0.4 s later and the toast says so; Add one more at 0.3 s: at most 3 look changes start in any second]
7. Add a clothes beat with a piece that is not in `wardrobe_cleared.json`. [the piece is refused with a plain message; a cleared piece works]
8. Add a sound beat (script or API: `GizmoNext.actions.add({kind:'sound', slot:'sound:<id>', gizmoId:'<id>', mode:'loop', t:1})`). Press Play, then Pause. [the loop starts once at 1 s; Pause stops it]
9. With a friend through the guest door, press Play on the host. [the friend sees the look and pose move; the friend's page starts no voice, no sound, no script, no camera cut]
10. Save the scene, start a New scene, open the saved one. [the beats are back; nothing played or started by itself; the console has no error]
11. Frame rate while Play runs with 12 beats, 4 figures and a voice. [at least 20 fps on the Quest; write the number]
