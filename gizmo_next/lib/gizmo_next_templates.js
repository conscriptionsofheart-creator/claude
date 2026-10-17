/* gizmo_next_templates.js: stage H10, five templates she can change. Each is a block list (the saved script) plus the gizmos it needs, as JSON.
   Installing one adds its trigger box (never armed), names the beat ranges it plays, and makes the code from the blocks. She then edits the blocks or the code. */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');

  var box = function (name, size, who) { return { kind: 'trigger', record: { name: name, x: 0, y: 1, z: 0, size: size, who: who || 'anyone', when: 'enter', often: 'visit', armed: false, starts: [] } }; };
  var T = [
    { id: 'greeting-at-the-door', name: 'Greeting at the door', note: 'A guest walks in and the beats named Greeting play. Record the greeting on the Beat strip first.',
      gizmos: [box('Doorway', [2, 2, 2], 'guests')], ranges: [{ name: 'Greeting', b: 3 }],
      blocks: { v: 1, rules: [{ when: { who: 'guest', event: 'enters', target: 'Doorway' }, then: [{ do: 'beats', arg: 'Greeting' }] }] } },
    { id: 'doorbell', name: 'Doorbell', note: 'Stepping on the bell rings a sound and sends the event doorbell. Another rule hears it and says so.',
      gizmos: [box('Doorbell', [1, 2, 1])], ranges: [],
      blocks: { v: 1, rules: [
        { when: { who: 'anyone', event: 'enters', target: 'Doorbell' }, then: [{ do: 'sound', arg: 'bell', mode: 'once' }, { do: 'emit', arg: 'doorbell' }] },
        { when: { who: 'anyone', event: 'hears', target: 'doorbell' }, then: [{ do: 'say', arg: 'Someone is at the door' }] }] } },
    { id: 'welcome-chair', name: 'Welcome chair', note: 'A guest steps on the mat, is welcomed, and after a moment is seated in Chair 1. Make a seat called Chair 1 first.',
      gizmos: [box('Welcome mat', [1.5, 2, 1.5], 'guests')], ranges: [],
      blocks: { v: 1, rules: [{ when: { who: 'guest', event: 'enters', target: 'Welcome mat' }, then: [{ do: 'say', arg: 'Welcome. Please sit down' }, { do: 'wait', sec: 1 }, { do: 'seat', arg: 'Chair 1' }] }] } },
    { id: 'music-when-someone-enters', name: 'Music when someone enters', note: 'Music starts when someone enters the room box and stops when they leave. Name a sound gizmo music first.',
      gizmos: [box('Room', [8, 3, 8])], ranges: [],
      blocks: { v: 1, rules: [
        { when: { who: 'anyone', event: 'enters', target: 'Room' }, then: [{ do: 'sound', arg: 'music', mode: 'loop' }] },
        { when: { who: 'anyone', event: 'leaves', target: 'Room' }, then: [{ do: 'sound', arg: 'music', mode: 'stop' }] }] } },
    { id: 'fall-and-get-up', name: 'Fall and get up', note: 'Stepping on the trap plays the beats Fall, and four seconds later the beats Get up. Record both on the Beat strip first.',
      gizmos: [box('Trap door', [1.5, 2, 1.5])], ranges: [{ name: 'Fall', b: 3 }, { name: 'Get up', b: 3 }],
      blocks: { v: 1, rules: [{ when: { who: 'anyone', event: 'enters', target: 'Trap door' }, then: [{ do: 'beats', arg: 'Fall' }, { do: 'wait', sec: 4 }, { do: 'beats', arg: 'Get up' }] }] } }
  ];
  var Templates = {
    list: function () { return T.map(function (t) { return { id: t.id, name: t.name, note: t.note }; }); },
    get: function (id) { var t = T.filter(function (x) { return x.id === id; })[0]; return t ? JSON.parse(JSON.stringify(t)) : null; }
  };
  GN.Templates = Templates;
  if (typeof module !== 'undefined' && module.exports) module.exports = GN;
})();
