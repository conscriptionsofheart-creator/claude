/* gizmo_next_probe.js: a TEST-ONLY part. It adds one tiny gizmo kind, the Probe box, so the kit itself can be checked in the real app before any real gizmo exists.
   Do not ship it: leave it out of GizmoNext.PARTS and out of guest_manifest.json. The seat loads it by hand for the G0 ray test and removes it afterwards.
   The box counts the frames it ran in its panel, so "nothing runs until Gizmos live is on" can be read as a number. */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');
  function register() {
    GN.register('probe', { needs: ['core'], version: 1 }, function (g) {
      g.defineKind({
        id: 'probe', name: 'Probe box', plural: 'Probe boxes', col: '#8c8cff', H: 0.25, max: 3, copyable: true, resize: 'size',
        defaults: function () { return { size: [0.5, 0.5, 0.5], enabled: true }; },
        fields: [{ key: 'enabled', label: 'Enabled', type: 'bool' }],
        rows: function (rec, H) {
          return [{ label: 'Frames run: ' + (rec._frames || 0), ic: null, act: function () { H.say('Frames run: ' + (rec._frames || 0) + '. It only counts while Gizmos live is on'); H.redraw(); } }];
        },
        onFrame: function (rec) { rec._frames = (rec._frames || 0) + 1; },
        glyph: function (c, cx, cy) { c.beginPath(); c.arc(cx, cy, 10, 0, 7); c.stroke(); c.beginPath(); c.moveTo(cx - 18, cy); c.lineTo(cx + 18, cy); c.moveTo(cx, cy - 18); c.lineTo(cx, cy + 18); c.stroke(); }
      });
      return {};
    });
  }
  GN._probeRegister = register;
  register();
  if (typeof module !== 'undefined') module.exports = GN;
})();
