# Trigger box H3: what changed (2026-10-16)

New files: `gizmo_next_trigger.js`, `gizmo_next_trigger_selftest.js`. Changed: `gizmo_next_beats.js` (named ranges), the core (`PARTS`), the testkit (three more ctx pass-throughs), the demo page. Plug-in: copy `gizmo_next_trigger.js` next to the other parts, make the edits in `README_H3.md`, run `gizmo_next_H3_RAY_SPEC.md`.

## What it does

A Trigger box is a new gizmo. Place it in a doorway, size it, say who it listens to (Players: Anyone, Guests only, Just me, a Named person, or Objects Tagged), when (enters, leaves, both) and how often (every time, once per visitor, once ever for each name, cooldown), then list what it starts in order with delays: play a named range of beats, a sound, send to a spawn point, sit them, run a script function, show or hide an object. A template, Greeting at the door, fills it in for a guest walking in.

Rules, each with a check: nothing runs on open, a new or copied box is not Armed, nothing fires with Gizmos live off, a friend's page never fires, Hide gizmos keeps it working, at most 40 box tests a frame, a trigger over 25 m from everyone sleeps, names are not kept unless she turns that on, no em dash in any label.

## Tests: 34/34 here, 130/130 with G0, H1 and H2

`trigger_kind_registered`, `trigger_enter_fires_once`, `trigger_leave_fires`, `trigger_hysteresis_15cm_no_flap`, `trigger_once_per_visitor_two_presences`, `trigger_second_guest_fires_again`, `trigger_every_time_mode`, `trigger_cooldown_blocks_then_allows`, `trigger_guests_only_ignores_host_head`, `trigger_me_only`, `trigger_named_person`, `trigger_objects_tagged_list`, `trigger_disarmed_on_open_never_fires`, `trigger_live_off_never_fires`, `trigger_enabled_false_never_fires`, `trigger_guest_page_never_fires`, `trigger_resize_changes_detection`, `trigger_rotated_box`, `trigger_sleeps_over_25m`, `trigger_box_tests_capped_40`, `trigger_hide_gizmos_keeps_logic`, `trigger_starts_run_in_order_with_delays`, `trigger_start_beats_calls_beats_range`, `trigger_test_it_fake_visitor`, `trigger_template_greeting_fields`, `trigger_hostile_record_clamped`, `trigger_json_roundtrip_nothing_runs`, `trigger_12_triggers_tick_cost`, `trigger_labels_no_em_dash`, `trigger_volume_shows_when_selected_or_hovered`, `trigger_remember_names_off_by_default`, `trigger_figures_if_ticked`, `trigger_rows_edit_starts`, `trigger_nothing_runs_when_scene_opens`.

Measurement: `trigger_12_triggers_tick_cost_ms_per_tick` about 0.04 ms. The demo page was driven in headless Chromium: the greeting box fired nothing while not armed, nothing while armed with Gizmos live off, once when the visitor stepped in with it on, and not again on re-entry; the in-page selftest read 130/130 with no console error and no outside request.

## Not verified

No headset and no real app. Not run: the real marker, handles and two-hand resize of the box, `RoomPresence` as the list of friends (a fake list was used), the real spawn point, seat, scripts and sound, the headset "When..." rule menu, a second tab as a friend, Quest frame cost.

## Open facts, and what was used

See the last section of `README_H3.md`.
