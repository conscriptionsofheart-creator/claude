# Spawn point v2 H5: what changed (2026-10-16)

New files: `gizmo_next_spawn.js`, `gizmo_next_spawn_selftest.js`. Changed: `gizmo_next_trigger.js` (spawn starts go through this part), the core (`PARTS`), the testkit (more ctx pass-throughs), the demo page. Plug-in: copy `gizmo_next_spawn.js` next to the other parts, make the edits in `README_H5.md`, run `gizmo_next_H5_RAY_SPEC.md`.

## What it does

Several spawn points instead of one. Each can be Spawn on Start, With a trigger, or Script attached; can turn the arriver to face its arrow, an object or the host, or leave their facing alone; sets Player Gravity and Speed; says who it is for; has an Order and a way to pick (in order, take turns, random). It can send people back if they fall too far or leave the room. A point with no floor or inside something solid is refused with a plain message. A Snap spot makes the walk-teleport aim land on its centre. Every arrival is a 0.4 s fade. Test arrive moves only you.

Rules, each with a check: nothing moves on open, nothing moves with Gizmos live off, a friend's page obeys only a message that names it, no two arrivals for one person within 0.4 s, gravity and speed stay in Meta's ranges, no em dash in any label.

## Tests: 23/23 here, 170/170 with G0 to H4

`spawn_two_points_exist`, `spawn_first_guest_point1_facing_arrow`, `spawn_second_guest_point2_take_turns`, `spawn_random_seeded_reproducible`, `spawn_order_lowest_wins`, `spawn_who_filter_guests`, `spawn_who_me`, `spawn_bad_point_no_floor_refused_with_message`, `spawn_inside_solid_refused`, `spawn_respawn_below_y`, `spawn_respawn_if_leave_room`, `spawn_arrival_fade_0_4s_no_flash`, `spawn_test_arrive_only_local`, `spawn_snap_spot_aim_snaps`, `spawn_set_position_only_false_turns`, `spawn_gravity_speed_ranges_clamped`, `spawn_json_roundtrip_nothing_moves_on_open`, `spawn_hostile_clamped`, `spawn_labels_no_em_dash`, `spawn_join_only_while_live`, `spawn_guest_message_obeyed_only_for_self`, `spawn_trigger_start_sends_to_point`, `spawn_nothing_runs_when_scene_opens`.

The demo page was driven in headless Chromium: two spawn points added, a guest joining with Gizmos live off did not move, with it on the guest landed on point 1, Test arrive moved the rig, and the in-page selftest read 170/170 with no console error and no outside request.

## Not verified

No headset and no real app. Not run: the real `SpawnPoint` with its limit lifted, moving the real dolly with the edge fade, the real floor and solid tests, a second tab arriving through the guest door, Quest frame cost.

## Open facts, and what was used

See the last section of `README_H5.md`.
