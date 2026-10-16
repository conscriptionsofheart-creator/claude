# Beat actions H2: what changed (2026-10-16)

New files: `gizmo_next_actions.js`, `gizmo_next_actions_selftest.js`. Changed: `gizmo_next_beats.js` (hooks for later stages, per part look timelines, pause listeners, `setClock`), the core (`PARTS`), the demo page. Plug-in: copy `gizmo_next_actions.js` next to `gizmo_next_beats.js`, make the edits in `README_H2.md`, run `gizmo_next_H2_RAY_SPEC.md`.

## What it does

A beat can now play a recorded voice, change only some parts of a look, set a face, start or stop a sound, play a ragdoll clip, seat a figure, call a script, or cut to a camera shot. A voice beat holds for the length of its recording, so the next beat waits. Looks change no faster than every 0.4 s and no more than 3 times in any second, and a bad scene is cleaned with a plain message.

Rules, each with a check: nothing runs on open or load, a friend's page starts no action, Stop and Pause stop the voice and the sounds, a clothes piece that is not cleared is refused, no em dash in any message.

## Tests: 21/21 here, 96/96 with G0 and H1

`actions_hello_friend_fake_mic`, `actions_say_hold_equals_recording_length`, `actions_look_partial_keeps_other_parts`, `actions_look_clothes_refused_when_not_cleared`, `actions_shader_blend_at_least_0_4s`, `actions_clamp_trips_on_bad_scene`, `actions_clamp_idempotent`, `actions_clamp_message_no_em_dash`, `actions_sound_once_calls_playMode_once`, `actions_unknown_kind_dropped_not_thrown`, `actions_deterministic_scrub`, `actions_stop_stops_sound_and_voice`, `actions_face_absent_message`, `actions_hostile_input_ok`, `actions_tick_cost`, and extra: `actions_register_custom_kind`, `actions_other_kinds_call_adapters`, `actions_guest_runs_nothing`, `actions_nothing_runs_when_scene_opens`, `actions_rows_and_panel`, `actions_no_em_dash_in_module_text`.

Measurement: `actions_tick_cost_ms_per_tick` about 0.01 ms. The demo page was driven in headless Chromium: a voice beat added at 0.5 s took a hold of 1.5 s from its recording, the mouth value read 0.4 while it played and 0 after, and the in-page selftest read 96/96 with no console error and no outside request.

## Not verified

No headset and no real app. Not run: the real `narration.js` (voice, jaw), the real wardrobe list, `bodyLook` and `applyLook` merging by part, the real sound gizmo, `clip_player.js`, the seat gizmo, `obj_scripts.js`, the camera beats, real friends and a friend hearing a voice, Quest frame cost.

## Open facts, and what was used

See the last section of `README_H2.md`.
