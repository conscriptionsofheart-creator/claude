# Gizmo kit G0: what changed (2026-10-16)

The plug-in kit every gizmo stage stands on. New files only: `gizmo_next_core.js`, `gizmo_next_probe.js` (test only), the host template, and the test equipment. Plug-in: copy `gizmo_next_core.js` into the app's `lib/` folder (flat), make the seat edits in `README_G0.md` (E1 to E13 of the contract, plus G0-1 to G0-4), then run the real-ray test in `gizmo_next_G0_RAY_SPEC.md`.

## What it does

A gizmo kind is one `g.defineKind(spec)` call. The core builds the records, the see-through marker box with its pick sphere, the object entry that makes grab, handles, two-hand resize, Fine Tune, lock, copy, delete, Undo and Recently deleted work on it, the registration with `Gizmos` (so Hide gizmos and Photo leave the box out), the menu rows from the fields, save and load, and friend sync parts. No second grab, undo, copy, lock or attach was built. Everything goes through the one entry the page already understands.

Rules the core enforces, each with a check:
- Nothing runs on open. Loading a scene calls no frame code and starts no sound. Gizmos live is off by default and a guest page never goes live from a file.
- A gizmo runs only while Gizmos live is on and its own Armed switch is not off.
- Hide gizmos hides the box and keeps the logic running. Photo leaves every box out (`userData.isMarker`).
- A guest never saves, places, copies or deletes, and the panel it gets has no Save, Export or Download.
- Hostile saved data is cleaned, never trusted: numbers clamped, strings cut, lists capped, wrong types replaced by the default.
- A kind that is registered after the scene loaded still gets its saved items. Saved state for a part that is not loaded yet is kept, not dropped.

## Tests: 44/44 in node and in the demo page

`core_global_noops_before_install`, `core_defineKind_add_get_remove`, `core_marker_flags`, `core_entries_shape`, `core_commit_reads_marker_back`, `core_resize_size_normalises`, `core_resize_scale_saved_as_sc`, `core_max_cap_refuses_and_says`, `core_dup_new_id_and_group`, `core_del_then_restore_same_spec`, `core_restore_refuses_when_id_exists`, `core_toJSON_fromJSON_roundtrip`, `core_runtime_fields_not_saved`, `core_live_default_false`, `core_state_load_runs_nothing`, `core_onFrame_only_when_live_and_armed`, `core_guest_never_live_from_file`, `core_hostile_state_ok`, `core_registers_with_Gizmos`, `core_hide_gizmos_keeps_logic`, `core_photo_mode_markers_flag`, `core_rows_from_fields`, `core_pages_registry`, `core_panel_guest_has_no_save_export_download`, `core_live_page_rows`, `core_probe_part_quiet_until_live`, `core_bus_events`, `core_log_ring_200`, `core_timers_die_when_live_off`, `core_sync_part_registry_validate_bounds`, `core_two_instances_bus`, `core_sync_live_follows_host`, `core_guest_persists_nothing`, `core_guest_cannot_place_or_delete`, `core_parts_order_and_missing_need`, `core_late_part_and_orphan_state_kept`, `core_install_attaches_modules_and_loads_storage`, `core_set_moves_marker_and_validates`, `core_missing_ctx_fields_ok`, `core_thumb`, `core_stub_orient_box_math`, `core_file_storage`, `core_tick_cost`, `core_no_em_dash_in_strings`.

Measurement: `core_tick_cost_ms` about 0.003 ms a tick with 12 live armed gizmos (limit 0.05, on the stub).

The demo page was also opened in headless Chromium from a `file://` address and driven: nothing fired on open, nothing fired with Gizmos live off or a box not armed, one fire when a visitor stepped into an armed box, none while they stayed in, one more on re-entry, Hide gizmos hid every box, New scene and Load JSON round-tripped, and the in-page selftest read 44/44 with no console error and no outside request.

## Not verified

These were not run, because there is no headset and no real app here:
- Real three.js. Every test uses the stub. The default marker box and its canvas picture were not drawn by real three.js.
- The real `gizmos.js`, `vr_objects.js` and `vr_core.js`. The fake Gizmos registry follows the file `gizmos.js.txt` closely, but Hide gizmos, Photo and the Gizmos page tile were not exercised against the real file.
- Real grab, handles, two-hand resize, Fine Tune, lock, copy, delete, Undo and Recently deleted. They are driven by the entry the core builds. That the real page accepts the entry is what the real-ray test checks.
- Whether the page's Undo (`VRCore.pushUndo`) brings gizmo changes back. See edit G0-3.
- Headset tile size (2.0 cm), the Settings tile for Gizmos live, the picture on the tile (edit G0-1).
- Real `RoomSync` between two tabs. The host and guest pair in the tests use a fake bus with fake latency.
- The scene slot carried by Save scene and the server autosave (E9).
- Quest frame cost.
- The 2D panel in the real BSA and Atelier right panel. It was built against a small fake DOM and the demo page.

## Open facts, and what was used

See the last section of `README_G0.md`: the tile picture, where the headset flips Gizmos live, `ctx.gizmos`, gizmo boxes on guest pages, the cap per kind.
