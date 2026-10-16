/* gizmo_next_host_TEMPLATE.js: the page glue the LOCAL SEAT turns into lib/gizmo_next_host.js (SEAT EDIT E2). About 60 lines, classic script, loaded on both pages.
   It builds ctx and calls GizmoNext.install(ctx) once, when the scene exists. It starts nothing: no part runs until Gizmos live is on.
   Every field is optional. Where the package showed the app's real name it is filled in. SEAT: marks a name the package did not show; the line says what is needed.
   This is the ONE file that may name page globals (VRCore, __gal, RoomSync). The gizmo_next_*.js modules never do. */
(function () {
  'use strict';
  if (window.__gizmoNextHost) return;
  window.__gizmoNextHost = 1;

  const G = (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  const scene = () => (window.__gal && window.__gal.scene) || (window.VRCore && VRCore.sceneInfo && VRCore.sceneInfo().scene) || window.scene || null; /* same as seat_gizmo.js */
  const isGuest = () => !!window.__ROOMGUEST || G(() => RoomSync.state().role === 'guest', false); /* room_sounds.js reads __ROOMGUEST and RoomSync.state().role */

  function buildCtx() {
    return {
      THREE: window.THREE,
      scene: scene,
      now: () => performance.now(),
      say: t => G(() => VRCore.sceneInfo().say(t)),                         /* the menu toast, as seat_gizmo.js does it */
      redraw: () => G(() => VRCore.redraw && VRCore.redraw()),             /* SEAT: rows get their own redraw from the objRows hook; this is only for 2D */
      pushUndo: () => G(() => VRCore.pushUndo()),                           /* one undo step on the page's own undo */
      head: () => G(() => VRCore.wfHead(), null),                           /* [x,y,z] world metres */
      floorAt: (x, z) => G(() => VRCore.floorAt(x, z), 0),                  /* SEAT: WALK floorBelow(p) in vr_core.js; expose it as VRCore.floorAt(x,z) */
      dolly: () => G(() => VRCore._dolly(), null),
      dollyScale: () => G(() => VRCore._dolly().scale.x, 1),
      walk: () => G(() => { const w = VRCore.walkGet(); return { on: !!(w && w.on), fly: !!(w && w.fly) }; }, { on: false, fly: false }), /* SEAT: check the shape of VRCore.walkGet() */
      isHost: () => !isGuest(),
      isGuest: isGuest,
      isPrivate: () => window.C3D_PROJECT === 'private',                    /* room_sync.js priv() */
      peers: () => G(() => RoomPresence.list(), []),                        /* SEAT: [{id,name,head:[x,y,z],feet:[x,y,z]|null,guest}] from room_presence.js */
      figures: () => G(() => (window.bodies || []).map(b => ({ slot: b.slot, name: b.name, group: b.group, head: G(() => /*SEAT*/ [b.group.position.x, b.group.position.y + 1.6, b.group.position.z], [0, 1.6, 0]) })), []), /* the posed figures, as room_sync.js lists them */
      props: () => G(() => (window.propInstances || []).map(p => ({ id: p.id, name: p.name, object: p.obj, tags: p.tags || [] })), []), /* BSA; the Atelier uses Props.list with p.wrap */
      look: null,                                                           /* SEAT: {get(slot), apply(slot,parts,k)} through kit_looks.js bodyLook/applyLook (stage H1) */
      pose: null,                                                           /* SEAT: {get(slot), apply(slot,pose,k)} snapshotObj-style (stage H1) */
      songTime: () => G(() => { const t = window._songT && window._songT(); return typeof t === 'number' && isFinite(t) && t >= 0 && window.__songPlaying ? t : null; }, null), /* H1, SEAT: the song's time while a song plays, else null. _songT() is in couple3d.html; name the "song is playing" test the page really has */
      selectedSlots: () => G(() => (window.selectedBodySlots ? window.selectedBodySlots() : null), null), /* H1, SEAT: the slots of the selected figures, or null for all figures */
      pins: window.CastPins || null,                                        /* CastPins in couple3d.html */
      narration: window.Narration || null,                                  /* narration.js: needs the adapter {voLines, play, mouth} (stage H2) */
      sounds: window.Sounds || null,                                        /* atelier_sounds.js */
      seat: window.SeatGizmo || null,                                       /* seat_gizmo.js */
      spawn: window.SpawnPoint || null,                                     /* spawn_point.js */
      poseLib: window.JointPoseLib || null,                                 /* joint_pose_lib.js */
      clips: window.ClipPlayer || null,                                     /* clip_player.js, adapter {play, stop, isPlaying} (stage H4) */
      objCfg: window.ObjCfg || null,                                        /* obj_cfg.js */
      scripts: window.ObjScripts || null,                                   /* obj_scripts.js */
      hand: side => G(() => { const c = VRCore.controllerPos && VRCore.controllerPos(side); return c ? [c.x, c.y, c.z] : null; }, null), /* H8, SEAT: world position of 'left' or 'right' hand/controller, or null; name the real VRCore call */
      particleFlow: window.ParticleFlow ? { budget: () => G(() => ParticleFlow.budget, 0), used: () => G(() => (ParticleFlow.live ? ParticleFlow.live() : 0), 0) } : null, /* H8, SEAT: particle_flow.js budget and live count so effects share one budget; check the real names */
      gizmos: window.Gizmos || null,                                        /* gizmos.js: the registry that Hide gizmos and Photo use */
      audio: { get context() { return G(() => Sounds.audio(), null); }, get destination() { return G(() => Sounds.audio().destination, null); } }, /* the page's one AudioContext */
      storage: {                                                            /* guarded localStorage */
        get: k => G(() => localStorage.getItem(k), null),
        set: (k, v) => G(() => localStorage.setItem(k, v)),
        del: k => G(() => localStorage.removeItem(k))
      },
      sync: window.GizmoNextSyncBridge || null,                             /* SEAT: E10: {send(name,obj), on(name,fn(obj,fromId)), peersOnline()} built on RoomSync; null when alone */
      log: (...a) => G(() => console.log(...a))
    };
  }

  const iv = setInterval(() => {
    if (window.GizmoNext && GizmoNext.install && window.THREE && scene()) {
      clearInterval(iv);
      try { GizmoNext.install(buildCtx()); } catch (e) { console.warn('GizmoNext install failed', e); }
    }
  }, 300);
  setTimeout(() => clearInterval(iv), 60000);
})();
