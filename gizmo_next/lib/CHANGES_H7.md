# Walk gaps H7: what changed (2026-10-16)

New files: `gizmo_next_walk.js`, `gizmo_next_walk_selftest.js`. Changed: the core (`PARTS`), the demo page.

**Check settings for Speed and Gravity.** Whether those rows already exist in Settings is unconfirmed. If they do, take only the model.

## What it does

A pure walk model: Speed 0 to 45 m/s, Gravity 0 to 9.81 (0 floats), run, jump, crouch (camera down, body stays), and Fly (up and down with the second stick, no wall collision, the floor still holds, a speed cap, drops to the floor when turned off). An edge vignette rises from 0 at walk speed to 0.6 at three times, and moves no more than 0.025 a frame. A seat holds you still.

## Tests: 17/17 here, 212/212 with G0 to H6

The eleven named in the stage file (`walk_fly_rises_with_stick` to `walk_tick_cost`) plus `walk_heading_and_strafe_directions`, `walk_wall_blocks_and_slides`, `walk_flycap_caps_speed`, `walk_pure_does_not_mutate`, `walk_hostile_input_ok`, `walk_part_settings_rows_and_save`. The demo page was driven in headless Chromium with no console error and no outside request.

## Not verified

No headset and no real app. The real stick, Fly buttons, collision, the vignette drawing, Quest frame cost.
