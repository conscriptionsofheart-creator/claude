# Adobe Substance 3D: the tools Ruth wants to match, and how they work

Written 2026-10-13 from general knowledge of the products (no Adobe page was fetched). Check each item against Adobe's help pages before building to it. Ruth's target: sculpt objects as well as Substance does, inside the headset (Quest), with all their features.

## Substance 3D Modeler (VR sculpting; the Oculus Medium successor). The one that matters most.
How it works: a model is built from clay strokes and shapes stored as signed-distance-field style volumes that are meshed on the fly, so you never think about triangles. Everything is non-destructive until you "bake" to a mesh. Work lives in **layers and groups**; each layer holds strokes that can be moved, scaled, hidden, merged.
Main ideas, each a thing to build:
- **Add / subtract / paint / intersect modes** on every brush and shape (the clay can be built up, carved away, only coloured, or kept only where it overlaps).
- **Brushes**: Clay (adds material along a stroke with a profile and spacing), Smooth, Flatten, Pinch / Crease (sharpens ridges), Inflate, Move / Grab (drag a region with falloff), Scrape, Stamp (repeat a shape or alpha along a stroke), Drag / Smear, Mask. Each has size, strength/pressure, spacing, falloff, "depth" and a stroke stabilizer (lazy-mouse smoothing).
- **Primitive shapes** (sphere, cube, cylinder, cone, torus, capsule) dropped and edited with a transform gizmo, then booleaned with add/subtract/intersect; **Cutter** (plane or shape) slices through layers.
- **Symmetry**: mirror planes and radial copies, live, on any tool.
- **Selection and transform**: lasso/box/brush select, move-rotate-scale gizmo, pivot, snapping, duplicate/instance, align.
- **Layers**: stack, reorder, blend modes for colour, opacity, lock, group, merge down.
- **Painting in the same tool**: colour, roughness, metalness per stroke; materials library; vertex colour baked out.
- **Reference**: image planes, scans, imported meshes as sculpt targets; **Remesh/retopo** to a clean quad-ish mesh; **Decimate** to a triangle budget; **export** glTF/OBJ/FBX/USD.
- **VR ergonomics**: two-hand grab to move/scale the whole work, controller menu on the wrist, haptic ticks, undo/redo stack, quick-switch brush on a button, trigger = pressure.

## Substance 3D Painter (texture painting). Relevant for later, not for the first sculpt build.
Layer stack with masks; smart materials and smart masks (rules that react to curvature, ambient occlusion, thickness); particle and physical brushes (dirt, scratches); projection and clone and smudge tools; baking maps (normal, AO, curvature, thickness, world-space normal) from high to low poly; PBR channels; filters and generators; export presets per engine.

## Substance 3D Sampler / Designer (materials). Out of scope for the sculpt work.

## What this means for a headset build on a Quest (hard limits to design around)
- Quest 3 gives about 72 to 90 fps and a fragment/triangle budget: Ruth's rule is **never hand her a VR scene under 20 fps**; sculpt meshes cap around 30 to 60k points near the hand per frame.
- SDF/voxel meshing in JavaScript on a phone-class GPU: use a coarse grid near the hand (adaptive), mesh in a worker, avoid per-frame full remesh.
- WebXR with three.js r128 on the page (vr_core.js) and r186 in BST; the existing engine edits triangle meshes directly (points, not voxels), keeps skin weights and shape keys, so a figure keeps its rig.
- Ruth does NOT want to model in Blender; she works by hand in the headset and wants templates she can tweak.
