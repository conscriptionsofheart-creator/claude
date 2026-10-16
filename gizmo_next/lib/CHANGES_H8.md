# Effects gizmo H8: what changed (2026-10-16)

New files: `gizmo_next_effects.js`, `gizmo_next_effects_selftest.js`. Changed: the core (`PARTS`), the stub (`BufferAttribute`), the testkit and host template (`hand`, `particleFlow`), the demo page. Plug-in: copy `gizmo_next_effects.js` next to the other parts, make the edits in `README_H8.md`, run `gizmo_next_H8_RAY_SPEC.md`.

## What it does

A new Effects gizmo with a Particles tab (smoke, sparks, confetti, splash) and a Trail tab (Default, Simple, Tapered). Play once, Loop and Stop from the panel or a beat. Nothing plays when a scene opens, or while Gizmos live is off (Preview is the one exception, when you press it). At most 600 particles live across all effects. Everything fades slowly (0.4 s or more), colours cannot jump faster than 2.5 a second, a restart waits 0.4 s, and a stop followed at once by a play waits two frames. Stop clears the particles and the trail. Hide gizmos hides the box and the effect keeps going.

## Tests: 23/23 here, 235/235 with G0 to H7

`fx_kind_registered_and_placeable`, `fx_silent_on_open_state_stop`, `fx_play_once_ends_alone`, `fx_loop_runs_until_stop`, `fx_stop_clears_all_particles`, `fx_trail_follows_moving_target`, `fx_trail_stop_clears`, `fx_stop_play_same_frame_waits_two_frames`, `fx_budget_cap_600_holds_with_many_gizmos`, `fx_colour_changes_at_most_3_per_second`, `fx_alpha_fade_at_least_0_4s`, `fx_flashSafe_rejects_strobe`, `fx_beat_starts_and_stops_it`, `fx_live_off_never_plays`, `fx_hide_gizmos_hides_box_not_effect`, `fx_json_roundtrip_nothing_plays`, `fx_tick_cost_at_cap`, `fx_labels_no_em_dash`, plus `fx_stop_play_waits_at_least_0_4s_between_starts`, `fx_guest_mirrors_host_play_and_stop`, `fx_deleted_gizmo_cleans_up`, `fx_ribbon_pure_shapes`, `fx_rows_and_fields_hostile_ok`.

The demo page was driven in headless Chromium: with live off a Loop made 0 particles, with live on about 90, Stop cleared them, and the in-page selftest read 235/235 with no console error and no outside request.

## Not verified

No headset and no real app. Not run: the real `THREE.Points` and ribbon drawing on a Quest, `particle_flow.js` sharing the budget, hand positions, a friend seeing it (H9), Quest frame cost.

## Open facts, and what was used

See the last section of `README_H8.md`.
