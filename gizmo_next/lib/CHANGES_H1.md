# Beat strip H1: what changed (2026-10-16)

New files: `gizmo_next_beats.js`, `gizmo_next_beats_selftest.js`. Changed: the core (`PARTS` lists the beats file), the testkit (three more ctx pass-throughs), the runner (stage order from the stage name), the demo page and the host template. Plug-in: copy `gizmo_next_beats.js` next to `gizmo_next_core.js`, make the edits in `README_H1.md`, run `gizmo_next_H1_RAY_SPEC.md`.

## What it does

The scene gets a clock of its own when no song plays. A beat is all the pins at one time, in the CastPins shape. Add beat records the chosen figures, refuses an unchanged pose, and moves the clock on by the gap. Play, Pause, Stop, scrub, Once, Loop, Yoyo and a loop bracket. Props can move on the same strip. Old keyframes become beats on request and stay as they were.

Rules, each with a check: nothing runs on open, a load applies nothing, looks change no faster than every 0.4 s, a friend can only watch and the host decides, labels have no em dash.

## Tests: 31/31 (75/75 with G0), node and the demo page

`beats_add_3_pose_beats_wrist_x_three_values`, `beats_unchanged_pose_refused`, `beats_clock_advances_by_gap`, `beats_play_samples_each_beat_time_within_tolerance`, `beats_scrub_equals_join_midway`, `beats_pause_resume_same`, `beats_stop_restores_start_state`, `beats_once_loop_yoyo_math`, `beats_bracket_loop`, `beats_smootherstep_monotone_no_overshoot`, `beats_song_time_wins_when_song_plays`, `beats_fallback_clock_without_song`, `beats_convert_old_keyframes`, `beats_move_prop_beat`, `beats_save_load_roundtrip`, `beats_load_runs_nothing`, `beats_hostile_state_ok`, `beats_pins_shape_matches_castpins`, `beats_strip_model_cards`, `beats_rows_labels_no_em_dash`, `beats_tick_cost`, and extra: `beats_nothing_runs_when_scene_opens`, `beats_look_spacing_flash_rule`, `beats_guest_cannot_edit_or_play`, `beats_sync_host_guest`, `beats_events_pass_once_per_pass`, `beats_events_bus_and_stop_listeners`, `beats_edit_retime_remove_limits`, `beats_panel_host`, `beats_unchanged_look_and_partial_add`, `beats_no_em_dash_in_module_text`.

Measurement: `beats_tick_cost_ms_per_tick` about 0.02 ms (12 beats, 4 figures, playing, Loop, on the stub).

## Not verified

No headset and no real app here. Not run: real `snapshotObj`, `bodyLook`, `applyLook`, `CastPins`, `direction.js`, real `RoomSync` (a fake bus was used), the strip drawn in the headset at 2.0 cm or more, Quest frame cost, blending real bone rotations (the default blend is componentwise), the page's Undo bringing a beat back.

## Open facts, and what was used

See the last section of `README_H1.md`.
