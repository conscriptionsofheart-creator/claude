/* gizmo_next_blocks.js: stage H10, the block model and the code generator. Pure: no page, no three.js, no eval, no Function.
   A block list is JSON: { v:1, rules:[ { when:{ who, event, target }, then:[ step, ... ] }, ... ] }
     who     anyone, guest, host, or { name: 'Rosa' }
     event   enters, leaves (target = the name of a trigger box or a seat), hears (target = an event name), starts
     step    { do:'beats', arg:'Greeting' } { do:'sound', arg:'bell', mode:'once'|'loop'|'stop' } { do:'seat', arg:'Chair 1' | 'stand' } { do:'spawn', arg:'Point 1' }
             { do:'effect', arg:'Confetti', mode:'once'|'loop'|'stop' } { do:'show', arg:'Lamp' } { do:'hide', arg:'Lamp' } { do:'say', arg:'Hello' }
             { do:'emit', arg:'doorbell' } { do:'wait', sec:2 } { do:'set', arg:'visits', value:1 }
   Only this fixed vocabulary makes code. Every text goes into the code as a JSON string literal, after being cut to 80 characters with control characters and line separators removed,
   so nothing a block says can end the string or add a statement. What the code does it does through emit('gizmo', {...}), which the page checks again. */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || (typeof require === 'function' ? require('./gizmo_next_core.js') : {});

  var EVENTS = ['enters', 'leaves', 'hears', 'starts'], WHO = ['anyone', 'guest', 'host'], MODES = ['once', 'loop', 'stop'];
  var DOS = ['beats', 'sound', 'seat', 'spawn', 'effect', 'show', 'hide', 'say', 'emit', 'wait', 'set'];
  var LABEL = { beats: 'play beats', sound: 'play sound', seat: 'seat them in', spawn: 'send them to', effect: 'effect', show: 'show', hide: 'hide', say: 'say', emit: 'send the event', wait: 'wait', set: 'set the variable' };
  var LIM = { rules: 12, steps: 24, text: 80, wait: 600 };
  var DASHES = new RegExp(' *[' + String.fromCharCode(0x2014, 0x2013) + '] *', 'g');
  var BAD = { __proto__: 1, constructor: 1, prototype: 1 };
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  /* control characters, line and paragraph separators become a space, so a name can never run onto a second line of code */
  function flat(v) { var o = '', i, c; for (i = 0; i < v.length; i++) { c = v.charCodeAt(i); o += (c < 32 || (c >= 127 && c <= 159) || c === 0x2028 || c === 0x2029) ? ' ' : v.charAt(i); } return o.replace(/ {2,}/g, ' '); }
  function text(v, n) { return typeof v === 'string' ? flat(v.replace(DASHES, ', ')).trim().slice(0, n || LIM.text) : ''; }
  function lit(s) { return JSON.stringify(String(s)); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

  /* ---------- checking: returns the clean list and the problems; nothing is ever repaired into a different action ---------- */
  function cleanStep(s, where, errs) {
    if (!isObj(s) || DOS.indexOf(s.do) < 0) { errs.push(where + ': that step is not one of the blocks'); return null; }
    var o = { do: s.do };
    if (s.do === 'wait') {
      if (!isNum(s.sec) || s.sec < 0 || s.sec > LIM.wait) { errs.push(where + ': wait is 0 to ' + LIM.wait + ' seconds'); return null; }
      o.sec = Math.round(s.sec * 100) / 100; return o;
    }
    var arg = text(s.arg); 
    if (!arg && s.do !== 'seat') { errs.push(where + ': ' + LABEL[s.do] + ' needs a name'); return null; }
    o.arg = s.do === 'seat' ? (arg || 'stand') : arg;
    if (s.do === 'sound' || s.do === 'effect') { if (s.mode !== undefined && MODES.indexOf(s.mode) < 0) { errs.push(where + ': mode is once, loop or stop'); return null; } o.mode = s.mode || 'once'; }
    if (s.do === 'set') {
      var v = s.value;
      if (typeof v === 'number') { if (!isNum(v) || Math.abs(v) >= 1e7) { errs.push(where + ': that number is too big'); return null; } o.value = v; }
      else if (typeof v === 'boolean') o.value = v;
      else if (typeof v === 'string') o.value = text(v, 120);
      else { errs.push(where + ': set needs a number, text, or yes or no'); return null; }
    }
    return o;
  }
  function validate(json) {
    var errs = [], out = { v: 1, rules: [] };
    if (!isObj(json) || json.v !== 1 || !Array.isArray(json.rules)) return { ok: false, errors: ['These blocks are not in the right form'], clean: out };
    if (json.rules.length > LIM.rules) errs.push('At most ' + LIM.rules + ' rules');
    json.rules.slice(0, LIM.rules).forEach(function (r, i) {
      var where = 'Rule ' + (i + 1);
      if (!isObj(r) || !isObj(r.when) || !Array.isArray(r.then)) { errs.push(where + ': it needs a When and some steps'); return; }
      var w = r.when, ev = w.event, who = w.who === undefined ? 'anyone' : w.who, whoOut;
      if (EVENTS.indexOf(ev) < 0) { errs.push(where + ': When must be enters, leaves, hears or starts'); return; }
      if (typeof who === 'string' && WHO.indexOf(who) >= 0) whoOut = who;
      else if (isObj(who) && text(who.name)) whoOut = { name: text(who.name) };
      else { errs.push(where + ': who must be anyone, guest, host or a name'); return; }
      var target = text(w.target);
      if ((ev === 'enters' || ev === 'leaves' || ev === 'hears') && !target) { errs.push(where + ': ' + ev + ' needs a name'); return; }
      if (r.then.length > LIM.steps) errs.push(where + ': at most ' + LIM.steps + ' steps');
      var steps = [], bad = false;
      r.then.slice(0, LIM.steps).forEach(function (s, j) { var c = cleanStep(s, where + ' step ' + (j + 1), errs); if (c) steps.push(c); else bad = true; });
      if (bad) return;
      out.rules.push({ when: { who: whoOut, event: ev, target: ev === 'starts' ? '' : target }, then: steps });
    });
    return { ok: errs.length === 0, errors: errs, clean: out };
  }

  /* ---------- the sentence for a rule, for the panel and the log ---------- */
  function whoWord(w) { return w === 'anyone' ? 'someone' : (w === 'guest' ? 'a guest' : (w === 'host' ? 'the host' : w.name)); }
  function stepWords(s) {
    if (s.do === 'wait') return 'wait ' + s.sec + ' s';
    if (s.do === 'set') return LABEL.set + ' ' + s.arg + ' to ' + s.value;
    if (s.do === 'sound' || s.do === 'effect') return (s.do === 'sound' ? 'sound ' : 'effect ') + s.arg + (s.mode === 'once' ? '' : ' (' + s.mode + ')');
    if (s.do === 'seat') return s.arg === 'stand' ? 'stand them up' : 'seat them in ' + s.arg;
    return LABEL[s.do] + ' ' + s.arg;
  }
  function describe(rule) {
    var w = rule.when, head = w.event === 'starts' ? 'When Scripts start' : (w.event === 'hears' ? 'When the event ' + w.target + ' is heard' : 'When ' + whoWord(w.who) + ' ' + w.event + ' ' + w.target);
    return head + ': ' + rule.then.map(stepWords).join(', then ');
  }
  function stepWordsAt(rule, j) { return stepWords(rule.then[j]); }

  /* ---------- the code ---------- */
  function cmd(key, ri, si, parts) {
    var kv = ['"s": ' + lit(key), '"rule": ' + ri, '"step": ' + si].concat(parts);
    return 'emit("gizmo", { ' + kv.join(', ') + ' });';
  }
  function stepLine(s, key, ri, si, ind) {
    var p = [];
    if (s.do === 'set') p = ['"do": "set"', '"arg": ' + lit(s.arg), '"value": ' + (typeof s.value === 'string' ? lit(s.value) : String(s.value))];
    else {
      p = ['"do": ' + lit(s.do), '"arg": ' + lit(s.arg)];
      if (s.mode) p.push('"mode": ' + lit(s.mode));
      if (s.do === 'seat' || s.do === 'spawn') p.push('"who": e.who && e.who.id');
    }
    return ind + cmd(key, ri, si, p);
  }
  function ruleCode(r, ri, key) {
    var w = r.when, L = [], head, i, ind = '  ', depth = 0, closers = [];
    var t = lit(w.target);
    if (w.event === 'enters') head = 'onEnter(' + t + ', function (e) {';
    else if (w.event === 'leaves') head = 'onLeave(' + t + ', function (e) {';
    else if (w.event === 'hears') head = 'on(' + t + ', function (e) {';
    else head = 'on("start", function (e) {';
    L.push(head);
    if (w.event === 'enters' || w.event === 'leaves') {
      if (w.who === 'guest') L.push('  if (!(e.who && e.who.guest)) return;');
      else if (w.who === 'host') L.push('  if (!(e.who && !e.who.guest)) return;');
      else if (isObj(w.who)) L.push('  if (!(e.who && String(e.who.name).toLowerCase() === ' + lit(w.who.name.toLowerCase()) + ')) return;');
    }
    r.then.forEach(function (s, si) {
      var pad = new Array(depth + 2).join('  ');
      if (s.do === 'wait') { L.push(pad + 'after(' + s.sec + ', function () {'); depth++; closers.push(pad + '});'); }
      else L.push(stepLine(s, key, ri, si, pad));
    });
    while (closers.length) L.push(closers.pop());
    L.push('});');
    return L.join('\n');
  }
  function generate(clean, opts) {
    var v = validate(clean); if (!v.ok) return '';
    var key = text(opts && opts.key, 40) || 'script';
    var out = ['// Made from blocks (GizmoNext blocks v1). Change the blocks, or change this code and the blocks turn grey.'];
    v.clean.rules.forEach(function (r, i) { out.push(ruleCode(r, i, key)); });
    return out.join('\n') + '\n';
  }

  var Blocks = { validate: validate, generate: generate, describe: describe, stepWords: stepWordsAt, hash: hash, text: text, vocab: { events: EVENTS.slice(), who: WHO.slice(), dos: DOS.slice(), modes: MODES.slice() }, limits: LIM };
  GN.Blocks = Blocks;
  if (typeof module !== 'undefined' && module.exports) module.exports = GN;
})();
