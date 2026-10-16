# Ray spec H7: the real-ray test of walk, fly and the vignette

For the local seat, after wiring `GizmoNext.walk.stepNow` (or `WalkModel.step`). Headset emulator, real stick and buttons, 60 Hz. The numbers to read are in brackets.

1. Open Settings and look for Speed and Gravity rows. [write whether they exist; if they do, skip step 7]
2. Walk on, push the stick forward for 2 s. [4 m/s, no edge vignette]
3. Run. [speed 1.8 times; the vignette rises no faster than 0.025 a frame, no flicker]
4. Set Speed to 20 and run. [vignette reaches 0.6, never above]
5. Jump. [apex 0.5 m, lands on the floor in about 0.64 s]
6. Crouch. [the camera drops 0.35 m, the body and feet stay]
7. Set Gravity to 0. [you float]. Set 9.81. [you fall like Earth]
8. Fly on, push the second stick up. [you rise], walk through a wall. [no collision], go down. [the floor holds at floorAt]. Fly off in the air. [you drop to the floor under you]
9. Sit on a seat and push the stick. [nothing moves]
10. Save, New scene, open the saved scene. [the settings are back; nothing moved by itself]
