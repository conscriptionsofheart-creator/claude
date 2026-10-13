# BST for Claude Cloud (copied 2026-10-13)

What is here
- scripts/  the Body Sculpting Tool (BST) code as it stands today: the VR sculpt engine (bst_vr_sculpt.js), stroke core (bst_sculpt_core.js), cuts/saw/carve/stamp/heal (bst_cut.js), desktop BST (bst.html, bst_app.js, bst_stage.js, bst_sculpt_ui.js), rig/bones/weights/shape keys, squeeze brush, wrinkle brush, plus the pages' VR adapters (vr_core.js = the wrist menus and Sculpt tiles, vr_atelier.js, vr_bsa.js), wardrobe_core.js (clothes and their saved cuts) and the engine slot (sculpt_next_engine.js + README).
- research/ the plan page (bst_sculpt_plan.html), Ruth's own program notes for BST, VR comfort and fps rules, the Substance tool research.
- PROMPT_FOR_CLAUDE_CLOUD.md  the prompt to paste.
Not included: the three.js vendor files (bst_three_0.186.1.*, get three r186 from npm) and the app's models and wardrobe.
Three runs together: the Atelier page (lib/body_shader_gallery.html) and the BSA page (lib/couple3d.html) both load vr_core.js, which loads the engine through the slot.
