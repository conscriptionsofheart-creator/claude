# Rag doll record H4: what changed (2026-10-16)

New files: `gizmo_next_ragdoll.js`, `gizmo_next_ragdoll_selftest.js`. Changed: the core (`PARTS`), the demo page. Plug-in: copy `gizmo_next_ragdoll.js` next to the other parts, make the edits in `README_H4.md`, run `gizmo_next_H4_RAY_SPEC.md`.

## What it does

With Gravity on, drop a figure and press Record fall. The result of the fall is kept as a small clip, 30 frames a second. Play it from anywhere: it looks the same, with no physics. Put it on the Beat strip as a ragdoll beat. Undo removes the last recording.

Rules, each with a check: nothing plays or records on open, a friend's page cannot record, a fall that is too long is refused with a plain message and never cut silently, the hips never go through the floor, a recording under 100 KB for 10 s, no em dash in any message.

## Tests: 17/17 here, 147/147 with G0 to H3

`ragdoll_synthetic_fall_records_3s_at_30hz`, `ragdoll_quantise_error_under_0_5_degrees`, `ragdoll_size_under_100KB_per_10s`, `ragdoll_play_twice_from_two_start_positions_same_pose_shape`, `ragdoll_knees_never_bend_backwards`, `ragdoll_root_height_never_below_floor`, `ragdoll_undo_removes_last`, `ragdoll_stop_returns_pose`, `ragdoll_too_long_message`, `ragdoll_save_load_roundtrip_nothing_plays`, `ragdoll_beat_action_plays_once_per_pass`, `ragdoll_play_tick_cost`, `ragdoll_slow_ticks_still_30fps`, `ragdoll_record_refusals`, `ragdoll_hostile_input_ok`, `ragdoll_rows_and_panel`, `ragdoll_nothing_runs_when_scene_opens`.

Measurements: quantisation error 0.0045 degrees, 10 s is 70 KB, conversion 0.05 ms, recording 0.005 ms a tick. The demo page was driven in headless Chromium: a 3 s made-up fall recorded as 90 frames and 21 KB, played, and the in-page selftest read 147/147 with no console error and no outside request.

## Not verified

No headset and no real app. Not run: the real RAGP doll and its joints, the real `ClipPlayer` playing the clip on a real body, knee axis on a real body, a friend receiving the clip, scene_store.js carrying the files, Quest frame cost.

## Open facts, and what was used

See the last section of `README_H4.md`.
