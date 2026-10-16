# Friends and saving H9: what changed (2026-10-16)

New files: `gizmo_next_sync.js`, `gizmo_next_sync_selftest.js`, `guest_files_list.txt`. Changed: the core (`PARTS`), `gizmo_next_seat.js` (`mirror`), `gizmo_next_trigger.js` (message `{id, fired, who, t}`, a friend cannot add a trigger box), `gizmo_next_effects.js` (a friend cannot add an effects gizmo), the testkit and host template (`mirror`), the demo page. Plug-in: copy the new files, make the edits in `README_H9.md`, run `gizmo_next_H9_RAY_SPEC.md`.

## What it does

A friend who joins gets the host's beats, trigger boxes, effects, seats and spawn points by themselves, within a few seconds, and sees them stay in step. When a visitor walks into a trigger on the host's page, the friend's Beat strip starts within about 0.1 s of the host's (the limit is 0.3 s). Stop on the host stops the friend. A seat the host sits on shows as taken on the friend's page. Gizmos live follows the host. A friend never fires a trigger, never saves, exports or downloads, and nothing they send changes the host.

## Tests: 20/20 here, 255/255 with G0 to H8

`sync_late_joiner_snapshot`, `sync_checksums_agree`, `sync_host_fire_guest_plays_within_0_3s`, `sync_stop_stops_guest`, `sync_guest_never_fires_trigger`, `sync_second_guest_fires_again`, `sync_no_echo`, `sync_validator_rejects_bad` (18 hostile cases), `sync_hostile_part_changes_nothing`, `sync_rate_limit_10_per_s`, `sync_private_sends_nothing`, `sync_seat_taken_shows_occupied_for_guest`, `sync_spawn_message_moves_guest_rig_with_fade`, `sync_save_load_all_kinds_nothing_plays_on_open`, `sync_live_flag_follows_host_but_guest_cannot_save`, `sync_guest_ui_has_no_save_export_download`, `sync_manifest_list_complete`, plus `sync_snapshot_chunks_and_size_bound`, `sync_guest_cannot_send_snapshot_and_host_answers_rarely`, `sync_labels_no_em_dash`.

The demo page was driven in headless Chromium: a pretend friend got the scene, the checksums agreed, the friend started 83 ms after the host, and the in-page selftest read 255/255 with no console error and no outside request.

## Not verified

No headset, no real room and no real `room_sync.js`, `room_presence.js` or guest door. Not run: two real tabs, real network delay and loss, the guest manifest on the real door, `ctx.mirror` on the real seat and spawn gizmos.

## Open facts, and what was used

See the last section of `README_H9.md`. Voice for a friend: Share audio.
