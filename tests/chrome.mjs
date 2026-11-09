// Shared local CDP launcher for release smoke checks and share-card rendering.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function withChrome(run) {
  const profile = mkdtempSync(join(tmpdir(), 'husky-release-'));
  const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank',
  ]);
  let socket;
  const deadline = setTimeout(() => chrome.kill(), 90000);
  try {
    const endpoint = await new Promise((resolve, reject) => {
      chrome.on('error', reject);
      chrome.once('exit', code => reject(Error(`Chrome exited: ${code}`)));
      let log = '';
      chrome.stderr.on('data', chunk => {
        log += chunk;
        const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) resolve(match[1]);
      });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    let id = 0;
    const pending = new Map();
    const errors = [];
    socket.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
      if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) errors.push(`${msg.params.response.status} ${msg.params.response.url}`);
      if (msg.method === 'Network.loadingFailed' && !msg.params.canceled) errors.push(msg.params.errorText);
      if (!msg.id) return;
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id); clearTimeout(p.timer);
      msg.error ? p.reject(Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    });
    const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const key = ++id;
      const timer = setTimeout(() => { pending.delete(key); reject(Error(`CDP timeout: ${method}`)); }, 15000);
      pending.set(key, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: key, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => call(method, params, sessionId);
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await page('Runtime.enable'); await page('Network.enable');
    const load = async url => {
      const result = await page('Page.navigate', { url });
      if (result.errorText) throw Error(result.errorText);
      await evaluate(`new Promise((resolve, reject) => {
        const deadline = Date.now() + 12000;
        const check = () => {
          if (location.href === ${JSON.stringify(url)} && document.readyState === 'complete') resolve();
          else if (Date.now() > deadline) reject(Error('Navigation timeout'));
          else setTimeout(check, 25);
        }; check();
      })`);
      await evaluate('document.fonts.ready.then(() => true)');
    };
    await run({ page, evaluate, load, errors });
  } finally {
    clearTimeout(deadline);
    socket?.close();
    const exited = new Promise(resolve => chrome.once('exit', resolve));
    if (chrome.exitCode === null && chrome.signalCode === null) { chrome.kill(); await exited; }
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
