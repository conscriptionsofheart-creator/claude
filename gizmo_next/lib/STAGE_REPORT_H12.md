# STAGE REPORT H12: the acceptance scene

**Done.** `gizmo_next_h12_scenario.js` (Ruth's example start to finish, a host page and a friend's page, fake clock, 80 ms delay), `gizmo_next_h12_selftest.js`, a Run the example button on the demo page, README, CHANGES, the two-tab RAY SPEC. Every acceptance check is there: three pose cards with different wrist x, voice plays once and the mouth moves, Play and Stop, exactly one start per guest, a second guest fires again, same visit does not, live off and disarmed fire nothing, save and reload play nothing on open, no export or save on the friend's page, the friend sees the wave within 0.3 s (0.18 s), hide gizmos still fires, tick cost, no flash.

**Selftest.** 15/15 (307/307 with all stages), in node and the demo page in headless Chromium.

**Found and fixed in `gizmo_next_beats.js`.** A beat at the very start started again at the end of a play once, and was skipped on most loops. Replace the H1 file when delivering.

**Untested.** The real voice-over and jaw bone, the real guest door, real ray presses, real network, Quest frame cost.

**The seat wires in.** Nothing new; run the RAY SPEC after the earlier stages' wiring.

**Open facts, defaults used.** The friend hears her voice through Share audio (no new fetchable address). The recording is a fake.
