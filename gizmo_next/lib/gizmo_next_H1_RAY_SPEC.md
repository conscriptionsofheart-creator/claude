# Ray spec H1: the real-ray test of the Beat strip

For the local seat, after the seat edits in `README_H1.md`. Atelier and BSA, headset emulator, a real controller-ray press for every step. Never replace a press with a synthetic call. The numbers to read are in brackets. No song plays during this test (step 12 adds one).

## Steps

1. Open Capture face, then Animate. A Beat strip tile is there. [tile edge at least 2.0 cm; `GizmoNext.beats.clock.state` is 'stopped'; `pins().length` 0]
2. Read the console. [no error, no GizmoNext warning]. Wait 5 seconds. [`clock.t` still 0, nothing moved: nothing runs on open]
3. Select a figure. Pose it with the right hand up. Press Add beat. [one pose beat at 0; `clock.t` 1.0; a toast says Beat added at 0.0 s]
4. Move the hand to the right. Press Add beat. [a beat at 1.0; `clock.t` 2.0]
5. Move the hand to the left. Press Add beat. [a beat at 2.0; `clock.t` 3.0; three cards on the strip]
6. Press Add beat again without moving. [refused with the plain message; still three beats; `clock.t` still 3.0]
7. Press Play. [the figure goes up, right, left, and stops at 2.0 s; read the wrist x at 0, 1 and 2 s from `GizmoNext.beats.stateAt(t)` and from the figure itself, each within 0.002 m]
8. Press Stop. [the figure is back where it was when Play began; `clock.t` 0]
9. Scrub to 1.25 s with a ray on the strip. Read the wrist. Press Stop, press Play and wait until 1.25 s, press Pause, read the wrist. [the two wrist positions are equal within 0.002 m]
10. Set Loop mode to Loop, press Play, wait 6 seconds. [it keeps playing; `clock.t` stays between 0 and 2; no jump other than the wrap]. Set Yoyo. [it runs forward then back]. Press Stop.
11. Select a card, press Play from here. [it starts at that card's time]. Set a bracket start and end. [Loop stays inside]. Clear the bracket.
12. Start a song. Press Play. [`GizmoNext.beats.time()` equals the song's time; the figure follows the song's clock]. Stop the song.
13. Open the old Keyframes panel with three frames. Press convert. [three beats at 0, 1 and 2 s; the old keyframes still play]
14. Select a prop, press Add beat, move it 1 m, press Add beat, press Play. [the prop moves; Stop puts it back]
15. Add a look beat (Add beat with look) and a second one 0.2 s after it. [the second moves to 0.4 s later, the toast says so; no two look changes closer than 0.4 s in `pins()`]
16. Save the scene, start a New scene, open the saved one. [the beats are back; `clock.state` 'stopped'; nothing moved by itself]
17. Press Undo after an Add beat. [the beat is gone; one press, one step]
18. Join with a friend (second tab through the guest door). On the host press Play. [the guest's figure moves the same way within 0.25 s; the guest sees no Add, Delete, Play, Stop, Save, Export or Download; the guest's `pins().length` equals the host's]. Edit the host list while the guest is stopped, press Play without sending the list. [the guest waits, the console says the beats differ]
19. Frame rate while Play runs with 4 figures and 12 beats. [at least 20 fps on the Quest; write the number]
