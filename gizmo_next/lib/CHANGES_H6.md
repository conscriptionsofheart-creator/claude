# Seat gizmo v2 H6: what changed (2026-10-16)

New files: `gizmo_next_seat.js`, `gizmo_next_seat_selftest.js`. Changed: `gizmo_next_trigger.js` (seat starts go through this part), the core (`PARTS`), the testkit (more ctx pass-throughs), the demo page. Plug-in: copy `gizmo_next_seat.js` next to the other parts, make the edits in `README_H6.md`, run `gizmo_next_H6_RAY_SPEC.md`.

## What it does

Walking in Walk mode, a Sit tile appears when you are within 80 cm of a seat and facing it, and not while flying. Pressing it fades the edges, lifts you so your head is at the seat plus 0.46 of your height (your body is never scaled), and blends into the sit pose, which can be any sit from your pose library. Pulling the stick back stands you up, back to the floor in front of the seat, or the way you set Exit Direction. A seat can be for everyone, guests, just you or a named person, one person at a time, nudged, and its height can come from the surface under it. Figures can sit too, from a seat beat.

Rules, each with a check: nothing runs on open, the stick does nothing while seated except stand, a taken seat refuses a second person, no scaling of the body, no em dash in any label.

## Tests: 25/25 here, 195/195 with G0 to H5

`seat_popup_at_0_8m_not_at_2m`, `seat_popup_needs_facing`, `seat_popup_not_while_flying`, `seat_head_target_0_46_stature_standing_and_sitting_calibration`, `seat_never_scales_body`, `seat_fade_0_25s_and_blend_0_6s_timings`, `seat_stand_returns_to_floor_in_front`, `seat_exit_direction_applies`, `seat_stick_ignored_while_seated`, `seat_taken_refuses_second`, `seat_library_pose_applies`, `seat_default_pose_when_library_missing`, `seat_who_filter`, `seat_figure_sits_and_stands`, `seat_beat_action_sits_figure`, `seat_events_enter_exit`, `seat_json_roundtrip`, `seat_labels_no_em_dash`, `seat_height_auto_from_surface`, `seat_nudge_moves_anchor_and_is_clamped`, `seat_hostile_clamped`, `seat_popup_skips_taken_and_picks_nearest`, `seat_nothing_runs_when_scene_opens`, `seat_without_rig_uses_page_seat`, `seat_trigger_start_sits_visitor`.

The demo page was driven in headless Chromium: far from the seat there was no Sit tile, near it and facing it there was, Sit lifted the head to 1.24 m, Stand put it 0.7 m in front at 1.58 m, and the in-page selftest read 195/195 with no console error and no outside request.

## Not verified

No headset and no real app. Not run: the real `SeatGizmo` and the body sit and stand solve, the real pose library and its sits filter, the dolly lift and edge fade, the stick and the A, X, B, Y buttons, a friend seeing someone sit (H9), Quest frame cost.

## Open facts, and what was used

See the last section of `README_H6.md`.
