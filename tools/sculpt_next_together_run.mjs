/* Two headsets over a REAL relay (dev only): starts tools/sculpt_next_relay.mjs (or .py with --py), opens tools/sculpt_next_together.html twice in Chromium, and has the two sculpt at once:
   Ruth makes clay and a rod, Sam joins late, both work the same clay together, Sam places and applies a cube, Ruth undoes, Sam brings the emblem, Ruth sets it spinning, Sam brushes the figure.
   At the end both checksums must be equal. node tools/sculpt_next_together_run.mjs [--three 186|128] [--py] [--cpu N] (the dev server must run on 8188: tools/sculpt_next_serve.mjs). */
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), here = path.dirname(fileURLToPath(import.meta.url));
let pw; try { pw = require('playwright'); } catch (e) { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; }, three = opt('--three') || '186', py = args.includes('--py'), cpu = +(opt('--cpu') || 1), port = 8790 + (py ? 1 : 0);
const relay = py ? spawn('python3', [path.join(here, 'sculpt_next_relay.py'), String(port)], { stdio: 'inherit', env: { ...process.env, QUIET: '1' } }) : spawn(process.execPath, [path.join(here, 'sculpt_next_relay.mjs'), String(port)], { stdio: 'inherit', env: { ...process.env, QUIET: '1' } });
await new Promise(r => setTimeout(r, 800));
const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const url = `http://127.0.0.1:8188/tools/sculpt_next_together.html?three=${three}${args.includes('--warm') ? '&warm=1' : ''}&relay=${encodeURIComponent(`ws://127.0.0.1:${port}/?room=test${Date.now()}`)}`;
const open = async () => { const ctx = await browser.newContext(), page = await ctx.newPage(), logs = []; page.on('console', m => { if (/error/i.test(m.type())) logs.push(m.text()); }); page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }); } await page.goto(url); await page.waitForFunction(() => window.__ready, null, { timeout: 60000 }); page.logs = logs; return page; };
const res = {}; let A, B;
try {
  A = await open(); B = await open();
  const call = async (p, fn, ...a) => { if (fn !== 'mark' && fn !== 'sum' && fn !== 'info' && fn !== 'dbg') await p.evaluate(m => window.API.mark(m), fn + (a[0] && typeof a[0] !== 'object' ? ':' + a[0] : '')); return p.evaluate(([fn, a]) => window.API[fn](...a), [fn, a]); };
  const line = (a, b, n) => Array.from({ length: n }, (_, i) => a.map((v, k) => v + (b[k] - v) * i / (n - 1)));
  res.aStart = await call(A, 'start', 'Ruth');
  await call(A, 'set', 'mode', 'clay'); await call(A, 'set', 'size', 2); await call(A, 'draw', line([-0.12, 1.2, -0.5], [0.08, 1.2, -0.5], 24));
  await call(A, 'set', 'mode', 'rod'); await call(A, 'draw', Array.from({ length: 30 }, (_, i) => [0.15 + Math.cos(i / 29 * Math.PI) * 0.1, 1.3 + Math.sin(i / 29 * Math.PI) * 0.1, -0.6]));
  [res.bJoin] = await Promise.all([call(B, 'start', 'Sam'), call(A, 'idle', 1500)]); await Promise.all([call(A, 'settle'), call(B, 'settle')]); res.joinSame = (await call(A, 'sum')) === (await call(B, 'sum')) ? 1 : 0;
  /* both at once */
  await call(A, 'resetTimes'); await call(B, 'resetTimes');
  await call(A, 'set', 'mode', 'clay'); await call(B, 'set', 'mode', 'inflate'); await call(B, 'set', 'size', 3);
  await Promise.all([call(A, 'draw', line([-0.12, 1.26, -0.5], [0.1, 1.26, -0.5], 40)), call(B, 'draw', Array.from({ length: 40 }, () => [-0.05, 1.218, -0.5]))]);
  await Promise.all([call(A, 'settle'), call(B, 'settle')]); res.concurrentSame = (await call(A, 'sum')) === (await call(B, 'sum')) ? 1 : 0;
  await call(B, 'set', 'mode', 'prim'); await call(B, 'set', 'prim', 'cube'); await call(B, 'draw', [[0.05, 1.2, -0.5], [0.05, 1.2, -0.5]]); await call(B, 'tap', 'apply');
  await call(A, 'tap', 'undo'); await call(B, 'tap', 'emblem', [0.5, 1.3, -0.6]); await Promise.all([call(A, 'settle'), call(B, 'settle')]); await call(A, 'tap', 'spin', 6);
  await call(B, 'set', 'mode', 'inflate'); await call(B, 'set', 'size', 4);
  await Promise.all([call(B, 'draw', Array.from({ length: 14 }, () => [0, 1.25, 0.13])), call(A, 'idle', 400)]);
  await Promise.all([call(A, 'idle', 1200), call(B, 'idle', 1200)]); await Promise.all([call(A, 'settle'), call(B, 'settle')]);
  /* the same figure stroke again, now that the code has run once (the first use of a tool in a page runs slower while the browser compiles it) */
  await A.evaluate(() => window.API.mark('warm figure stroke')); await B.evaluate(() => window.API.mark('warm figure stroke'));
  await Promise.all([B.evaluate(() => window.API.draw(Array.from({ length: 14 }, () => [0.02, 1.22, 0.13]))), A.evaluate(() => window.API.idle(400))]);
  await Promise.all([A.evaluate(() => window.API.idle(1200)), B.evaluate(() => window.API.idle(1200))]);
  /* the engines' own rounds: every few hundred numbered messages each one fingerprints its work at that same point; equal at every shared round = the same work all along (the emblem turning included) */
  const ra = (await call(A, 'dbg')).rounds, rb = (await call(B, 'dbg')).rounds, mb = new Map(rb.sums), common = ra.sums.filter(([n]) => mb.has(n));
  res.rounds = common.length; res.roundsSame = common.length && common.every(([n, v]) => mb.get(n) === v) ? 1 : 0; res.resyncs = ra.resyncs + rb.resyncs;
  await call(A, 'tap', 'spin', 0); await Promise.all([call(A, 'idle', 1800), call(B, 'idle', 1800)]); await Promise.all([call(A, 'settle'), call(B, 'settle')]);   /* the spin eases to a stop: then the whole work can be compared at rest */
  const sa = await call(A, 'sum'), sb = await call(B, 'sum'); res.finalSame = sa === sb ? 1 : 0; res.sums = [sa, sb]; if (!res.finalSame) res.parts = [await call(A, 'parts'), await call(B, 'parts')];
  res.A = await call(A, 'info'); res.B = await call(B, 'info'); res.phasesA = await A.evaluate(() => window.API.phases()); res.phasesB = await B.evaluate(() => window.API.phases());
  await call(B, 'stop'); await call(A, 'idle', 300); res.afterLeave = (await call(A, 'info')).people;
  res.logs = [...A.logs, ...B.logs].slice(-10);
} catch (e) { res.error = String(e && e.stack || e).slice(0, 600); }
console.log(JSON.stringify(res, null, 1));
await browser.close(); relay.kill(); process.exit(res.finalSame && res.joinSame && res.concurrentSame && res.roundsSame ? 0 : 1);
