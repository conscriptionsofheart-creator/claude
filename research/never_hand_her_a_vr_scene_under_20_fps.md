---
name: never-hand-her-a-vr-scene-under-20-fps
description: "Ruth's standard for every Quest scene: floor was 20 fps (2026-10-07), raised 2026-10-10 to a 45 floor and a 72 aim because Meta requires 72 on Quest; the VR menu has an FPS meter and the headset shrinks the picture itself"
metadata:
  node_type: memory
  type: feedback
  originSessionId: adaf7111-c620-4b70-bf43-83ede654a8bf
  modified: 2026-10-07T20:18:51.818Z
---

Ruth, 2026-10-07 (Quest 2, after Three Men ran at 14 to 16 fps and even the simple fire circle ran at 20 to 25): "I should never be given a scene that has less than 20fps at any point in it. that's a new standard for you."

**Raised 2026-10-10:** Ruth asked whether 30 is the standard and said raise it, especially for multiplayer. Checked: Meta's Virtual Reality Check requires 72 fps on every Quest app and the Quest WebXR browser runs at 72 Hz by default (90 on Quest 2; Quest 3 also 120). So the working rule is a 45 floor and a 72 aim. vr_core.js now shrinks the picture under 60 (grows again at 70+), turns on very light mode under 36, warns a guest under 45; atelier_vr_guard.js already stepped down below 55. Where this file says 20, read 45.

**Why:** low frame rates made her sick before and she was handed scenes that stuttered while she reviewed. The headset log showed the fire circle was GPU-bound (about 13 ms CPU per frame at 20 fps), so cutting triangles or JS alone does not fix it.

**How to apply:**
- Treat a scene as not ready for her until its headset beats (vr_link/headset.log, `beat:` lines, `[fps N]`, `f1`, `min10`) hold 20 or more, not the emulator.
- The VR menu Photo/Play face has an FPS tile: bottom of the menu shows fps, lowest of the last 10 s, picture size. vr_core.js `RES` / `resTick` shrinks the picture (XRView.requestViewportScale) under 60 fps (was 40) and has a "very light" fallback (under 36, was 24) that hides backdrop shader domes (vr_bsa.js `liteMore`).
- A desktop emulator frame rate proves nothing about the Quest; the 6x CPU throttle in the scratchpad (fps_thr.py) only approximates the JS cost.
- Related: [[vr-on-quest-link-and-comfort-rules]], [[watch-it-play-before-any-link-to-her-scenes]].

**Measured on her Quest (headset.log, 8,825 beats, read 2026-10-09):** the headset's 'tris' number counts BOTH eyes (checked in the emulator: a scene of 604,311 visible triangles reported 1,222,594). Frame rate against the reported number: under 0.3M median 79 fps; 0.9M-1.2M 47% of beats under 20 fps; over 1.2M 81% under 20 (median 15). In scene triangles, halve it: keep a VR scene under about 0.45M. Measured per saved scene (vr_test_harness scene_tris.txt): over the line are er_debrief_space 0.60M, three_men part3 0.61M, part2 0.51M, three_men 0.47M, rebuild 0.47M; part1_arrival_cut 0.45M is borderline; the _vr cut at 0.35M and the rt_* circles (0.28-0.40M) are fine. The public viewer settles to 60 fps about 10 s after load, worst hitches (up to 1.2 s) in the first two beats while shaders compile.
