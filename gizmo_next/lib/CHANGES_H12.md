# Acceptance scene H12: what changed (2026-10-16)

New files: `gizmo_next_h12_scenario.js`, `gizmo_next_h12_selftest.js`. Changed: `gizmo_next_beats.js` (two fixes, below), `gizmo_next_actions_selftest.js` (one check), the demo page (a Run the example button). Test only; no new features.

## What it does

Runs Ruth's example start to finish on a fake clock: a figure posed with a hand up, a recording attached to the first beat, three pose beats, a Guests-only trigger at the doorway that plays the beats Greeting, Gizmos live on, Play and Stop, and a friend through the guest door walking in. The friend's page follows within 0.3 s.

## Fixes found by the scenario (in `gizmo_next_beats.js`)

1. A beat at the very start (such as a recording on the first card) no longer starts again when a play once reaches its end.
2. A beat at the very start now starts on every loop, not only on some (a rounding error at the wrap skipped it).

## Tests: 15/15 here, 307/307 with G0 to H11

`h12_strip_has_3_pose_cards_wrist_x_three_values`, `h12_say_plays_once_and_mouth_moves_while_it_plays`, `h12_play_waves_and_speaks_then_stop_restores`, `h12_guest_enters_exactly_one_start`, `h12_second_guest_fires_again`, `h12_same_guest_reenter_same_visit_no_second_fire`, `h12_live_off_nothing_fires`, `h12_disarmed_nothing_fires`, `h12_save_reload_keeps_everything_nothing_plays_on_open`, `h12_guest_page_no_export_download_save`, `h12_guest_sees_wave_within_0_3s`, `h12_hide_gizmos_still_fires`, `h12_tick_cost_whole_scene`, `h12_no_flash`, `h12_run_example_lines_pass`.

The demo page was driven in headless Chromium: Run the example printed five passing lines (the friend's figure moved 100 ms after the host's start) and the in-page selftest read 307/307 with no console error and no outside request.

## Not verified

No headset and no real app: the real voice-over and jaw bone, the real guest door, real controller-ray presses, real network delay, Quest frame cost. The ray spec covers them.
