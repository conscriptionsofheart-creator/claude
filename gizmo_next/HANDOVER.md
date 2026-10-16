# Handover: BSA gizmo build (for a fresh session)

Task: the "BSA Gizmos for Cloud Worker (2026-10-16)" Drive folder (id 1IfwWG7p8v-3uKW51oU6Ct5HQNW_riJke). Read 00_START_HERE.md, 01_RULES.md, 02_PLUG_IN_CONTRACT.md first. Build stages in order, one at a time, each selftest passing before the next: G0, H1, H2 (12_H2), H3 (13), H4 (14), H5 (15), H6 (16), H7 (17), H8 (18), H9 (19), H10 (20), H11 (21), H12 (22). Skip 10_H0.

Rules that never bend: nothing runs when a scene opens, Gizmos live off by default, no flashing (looks no faster than every 0.4 s), icons 2.0 cm or more, guests get no export, save or download, no SMPL-X, AMASS or Bandai Namco data, her copy uses commas and full stops (no em dashes anywhere, a test scans for them), never build a second grab, undo, copy, lock or attach.

State on this branch (gizmo_next/lib):
- G0 done (44 checks), H1 done (31 checks), 75/75 with both. `node gizmo_next_selftest.js [--only=beats]`.
- H2 in progress: gizmo_next_beats.js was extended for it (per-part look timelines, hooks.pin and hooks.list, onPause, setClock, length counts every hold). gizmo_next_actions.js and its selftest are not written yet.
- Each stage ships: modules, selftest, demo page section, README_Hn, CHANGES_Hn, RAY_SPEC, wiki json, lesson draft, ASSETS line, STAGE_REPORT_Hn (under 200 words).

Drive delivery: Drive folder "BSA Gizmos OUTPUT" (id 1ZcVcExVyLgTlEpSCmAcf32lOyqHzkvkg), one subfolder per stage. G0 is there as 16 loose files. H1 is there as H1_bundle.txt (files between FILE and END markers; unbundle.js in the OUTPUT folder splits it) plus STAGE_REPORT_H1.md. H1 and H2 onward: make a bundle with the scratch script idea (new files in full, changed files as a git diff) and verify each upload by downloading it and comparing. Do not put backslash-u escapes in text sent to Drive: the transport turns them into real characters.

Cloud sessions did not run Drive uploads without a prompt. `.claude/settings.json` now allows `mcp__Google_Drive__create_file` for new sessions.
