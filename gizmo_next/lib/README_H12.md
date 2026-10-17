# README H12: the acceptance scene (Ruth's example)

Her example as one runnable scenario, in node and on the demo page, plus the ray spec the seat runs for real with a friend's tab. Test only: no new features. It uses G0, H1, H2, H3 and H9; nothing was skipped.

## Files

| File | What it is |
|---|---|
| `gizmo_next_h12_scenario.js` | `GizmoNext.H12`: builds a host page and a friend's page with the testkit (80 ms between them, fake clock) and runs steps 1 to 6. `world(kit)`, `register()`, `runExample(kit)`. |
| `gizmo_next_h12_selftest.js` | 15 checks. `node gizmo_next_selftest.js --only=h12`, or the demo page. |
| `gizmo_next_demo.html` | A "Run the example" button that prints the result lines. |
| `gizmo_next_H12_RAY_SPEC.md`, `CHANGES_H12.md`, `STAGE_REPORT_H12.md` | The real-ray version with two tabs, change note, report. |

The scenario files are for testing and are not in `guest_files_list.txt`.

## The scenario

1. She selects a figure and poses it with one hand raised.
2. On the figure's Voice page she records "hello friend!" (here a fake recording called `vo_hello`, 1.5 s).
3. In the Beat strip she presses Add beat (hand up, the recording attached as a `say` beat with its hold at the recording length), then hand right and Add beat, then hand left and Add beat.
4. A trigger box at the doorway: Triggered By Players, Guests only, When someone enters, How often Once per visitor, starts Play beats Greeting. She turns Gizmos live on.
5. She presses Play; the figure waves and speaks. Stop puts it back.
6. The friend (through the guest door) walks in, the trigger fires, the figure greets him, the friend sees the wave and hears the voice in step with the host.

## What each check reads

`h12_strip_has_3_pose_cards_wrist_x_three_values` (cards at 0, 1, 2 s with the wrist at x 0, 0.5, -0.5, within 2 cm, and one say beat with hold 1.5), `h12_say_plays_once_and_mouth_moves_while_it_plays`, `h12_play_waves_and_speaks_then_stop_restores`, `h12_guest_enters_exactly_one_start`, `h12_second_guest_fires_again`, `h12_same_guest_reenter_same_visit_no_second_fire` (and a new visit fires again), `h12_live_off_nothing_fires`, `h12_disarmed_nothing_fires`, `h12_save_reload_keeps_everything_nothing_plays_on_open`, `h12_guest_page_no_export_download_save`, `h12_guest_sees_wave_within_0_3s` (the friend's figure starts to move 0.18 s after the host's start; the beat clocks are never more than 0.07 s apart), `h12_hide_gizmos_still_fires`, `h12_tick_cost_whole_scene` (3 beats, 1 trigger, 2 visitors, host and friend ticked: 0.007 ms), `h12_no_flash`, `h12_run_example_lines_pass`.

## How the friend hears the voice

The default from H9 is **Share audio**: the friend's page does not fetch her voice file. The check therefore measures that the friend's Beat strip is within 0.3 s of the host's when the host's voice starts (the host's voice starts within 0.1 s of the host's Play), and that the friend's page itself never plays a recording.

## Two real defects this scenario found, and fixed in `gizmo_next_beats.js`

1. **A beat at the very start started again at the end of a play once.** The `say` beat on the first card played a second time when the clock reached the end. Fixed: a play once does not wrap.
2. **A beat at the very start was skipped on most loops.** A loop wrapped from the end to the start a rounding error short of the wrap, and the beat there waited for a later wrap. Fixed: the same small allowance is used on both sides of the test.

Two checks hold them in place (`actions_once_end_does_not_restart_first_beat`). The H1 and H2 deliveries in Drive need this file replaced (it is in the final bundle).

## Open facts, and the default used

1. The recording, the voice page and the microphone are fakes (`vo_hello`); the real voice-over, jaw bone and AnalyserNode are for the ray spec.
2. A friend already standing inside a Guests-only box when a live scene opens would fire it; the scenario opens with nobody inside, as the example does.
3. Quest frame cost is unmeasured until she tries it.
