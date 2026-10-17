# Scripting layer H10: what changed (2026-10-16)

New files: `gizmo_next_script.js`, `gizmo_next_blocks.js`, `gizmo_next_templates.js`, `gizmo_next_script_sandbox.js` (tests only), `gizmo_next_script_selftest.js`. Changed: the core (`PARTS`), `guest_files_list.txt`, the testkit (`objectVisible`, `spawnObject`, `despawnObject`, `raycast`), the demo page. Plug-in: copy the files, make SEAT EDITS H10-1 and H10-2 from `README_H10.md`, run `gizmo_next_H10_RAY_SPEC.md`.

## What it does

Scripts can send events to each other, declare settings that show up as panel rows, hear when someone enters or leaves a trigger box or a seat, look along a ray for tagged objects, spawn up to 20 objects, and keep scene variables that are saved with the scene. Blocks such as "When a guest enters Doorway: play beats Greeting, then wait 2 s, then seat them in Chair 1" write readable JavaScript for you, and five templates show how. If you edit the code, the blocks grey out. A log shows what ran with the running block highlighted, and Test it with me sends a pretend visitor through. Scripts never run when a scene opens, and turning Scripts off stops every timer and puts back what they changed.

## Tests: 19/19 here, 274/274 with G0 to H9

`script_fields_become_rows`, `script_emit_on_between_objects`, `script_onEnter_onLeave_via_bus`, `script_timers_die_when_scripts_off`, `script_scripts_off_undoes_changes`, `script_nothing_runs_on_open`, `script_error_does_not_stop_other_gizmos`, `script_blocks_generate_code_that_runs`, `script_code_edit_greys_blocks`, `script_all_five_templates_load_and_run`, `script_raycast_by_tag`, `script_spawn_budget_20`, `script_vars_saved_and_loaded`, `script_visitor_count_off_by_default`, `script_log_has_entries_and_test_it`, `script_generated_code_has_no_em_dash`, `script_hostile_blocks_rejected` (26 cases, ten injection strings never reach a statement), plus `script_guest_cannot_run_or_edit`, `script_extend_is_quiet_and_complete`.

Scripts are run in a small model of `obj_scripts.js` that builds them the same way (`new Function` with the same arguments, the same timers and the same five-error rule).

The demo page was driven in headless Chromium: a template added its code, Test it with me logged the step, the Blocks strip showed the five templates, and the in-page selftest read 274/274 with no console error and no outside request.

## Not verified

No headset and no real app. Not run: the real `obj_scripts.js` and `atelier_scripts.js` with the two edits, real object handles for raycast, spawn and despawn, real show and hide, Quest frame cost.

## Open facts, and what was used

See the last section of `README_H10.md`. Check settings in `atelier_scripts.js` before adding the hook.
