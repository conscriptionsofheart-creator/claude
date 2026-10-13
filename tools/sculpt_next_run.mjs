/* Headless runner for the sculpt self-test pages (dev only): opens a page, waits for window.__result, prints it as JSON.
   node tools/sculpt_next_run.mjs <url> [--cpu N] [--timeout ms]
   --cpu N slows the CPU N times (Chrome DevTools throttling), a rough stand-in for the Quest's phone-class CPU; it says nothing about the Quest's GPU. */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }   /* a local install, else the global one */
const { chromium } = pw;
const args = process.argv.slice(2), url = args[0], opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const cpu = +(opt('--cpu') || 1), timeout = +(opt('--timeout') || 180000);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
const logs = []; page.on('console', m => logs.push(m.type() + ': ' + m.text())); page.on('pageerror', e => logs.push('pageerror: ' + e.message));
if (cpu > 1) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
await page.goto(url);
try { await page.waitForFunction(() => window.__result, null, { timeout }); }
catch (e) { console.log(JSON.stringify({ error: 'timeout', logs: logs.slice(-30) }, null, 1)); await browser.close(); process.exit(2); }
const res = await page.evaluate(() => window.__result);
if (logs.some(l => /error/i.test(l))) res.__logs = logs.filter(l => /error|warn/i.test(l)).slice(-20);
console.log(JSON.stringify(res, null, 1));
await browser.close();
