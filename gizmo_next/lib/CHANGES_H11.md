# Small gaps H11: what changed (2026-10-16)

New files: `gizmo_next_small.js`, `gizmo_next_small_selftest.js`, `objcfg_mats_patch.json`. Changed: the core (`PARTS`, and `strMax` for longer text fields), `guest_files_list.txt`, the demo page. Plug-in: copy the files, merge the patch (SEAT EDIT H11-1), wire the `ctx` calls in `README_H11.md`, run `gizmo_next_H11_RAY_SPEC.md`.

## What it does

A Text sign (up to 1000 characters, Auto Fit, Fixed Font Size, Visible) that stays when gizmos are hidden. A Door that opens a saved scene when you press Go, only when Gizmos live is on, and only to scenes you shared for a friend. Two new materials, Softwood and Super ice. A plain warning above 20 lights. Mirror settings (radius, levels of detail, resolution, frame rate) with a cost out of 100. A camera beat that fades over 0.4 s instead of cutting, with cuts kept 0.4 s apart. Sound Pitch (0.5 to 2), Min distance and Fade (0.4 s or more).

## Tests: 17/17 here, 291/291 with G0 to H10

`text_cap_1000`, `text_autofit_shrinks_to_box`, `text_fixed_font_does_not_shrink`, `text_visible_toggle`, `text_stays_when_gizmos_hidden`, `text_no_em_dash_in_defaults`, `door_refuses_unshared_scene_for_guest`, `door_go_disabled_until_live`, `door_never_opens_on_its_own`, `mats_patch_values_within_ranges`, `light_21_warns_20_does_not`, `mirror_bigger_radius_costs_more`, `camera_shot_names_validated`, `camera_cut_becomes_0_4s_fade`, `sound_pitch_min_distance_clamps_and_calls`, `small_json_roundtrip_and_guest_blocked`, `small_labels_no_em_dash`.

The demo page was driven in headless Chromium: a sign appeared, the door waited for live, 21 lights warned, the mirror cost moved with its radius, the camera shot fired with a 0.4 s fade, and the in-page selftest read 291/291 with no console error and no outside request.

## Not verified

No headset and no real app. Not run: the real `ObjCfg.MATS` merge, real scenes opening, the real camera, mirror and sound modules, how the text looks on a Quest, Quest frame cost.

## Open facts, and what was used

See the last section of `README_H11.md`.
