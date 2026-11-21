/**
 * Real-browser acceptance check for the packaged Windows app.
 *
 * It uses the installed Microsoft Edge through Playwright, starts the Python
 * backend with an isolated temporary database, and points the DeepSeek preset
 * at a local mock server. No real API key or external model request is used.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdtempSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const python = join(root, 'runtime', 'python.exe');
const testRoot = join(root, '.tmp-tests');
mkdirSync(testRoot, { recursive: true });
const dataDir = mkdtempSync(join(testRoot, 'movemate-e2e-'));
const logPath = join(dataDir, 'backend.log');
const shots = join(root, 'docs', 'screenshots');
mkdirSync(shots, { recursive: true });

let backend;
let mock;
let browser;
let passed = 0;

async function hideToast(page) {
  await page.evaluate(() => {
    const toast = document.querySelector('#toast');
    if (toast) toast.style.display = 'none';
  });
}

function okay(name, condition) {
  if (!condition) throw new Error('FAIL ' + name);
  passed++;
  console.log('PASS ' + name);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(url, attempts = 100) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('backend did not become ready: ' + url);
}

async function startMockAi() {
  const port = await freePort();
  mock = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const payload = body ? JSON.parse(body) : {};
      const question = payload.messages?.at(-1)?.content || '';
      const raw = JSON.stringify({
        choices: [{ message: { content: question.includes('Reply OK') ? 'E2E MOCK OK' : 'E2E MOCK：这是本地模拟回复。' } }]
      });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) });
      res.end(raw);
    });
  });
  await new Promise((resolve, reject) => {
    mock.once('error', reject);
    mock.listen(port, '127.0.0.1', resolve);
  });
  return port;
}

async function main() {
  const mockPort = await startMockAi();
  const port = await freePort();
  const log = openSync(logPath, 'a');
  backend = spawn(python, [join(root, 'serve.py'), '--no-browser', '--port', String(port)], {
    cwd: root,
    env: { ...process.env, MOVEMATE_DATA_DIR: dataDir, PYTHONIOENCODING: 'utf-8' },
    stdio: ['ignore', log, log],
    windowsHide: true,
  });
  await waitFor(`http://127.0.0.1:${port}/api/bootstrap`);

  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });

  await page.waitForSelector('#api-dialog[open]');
  okay('first launch opens the API dialog', await page.locator('#api-dialog').isVisible());
  okay('DeepSeek is the default format', await page.locator('#api-format').inputValue() === 'deepseek');
  okay('DeepSeek URL is prefilled', await page.locator('#api-base').inputValue() === 'https://api.deepseek.com/v1');
  okay('DeepSeek model is prefilled', await page.locator('#api-model').inputValue() === 'deepseek-chat');
  await page.screenshot({ path: join(shots, 'deepseek-config.png'), fullPage: true });

  await page.selectOption('#api-format', 'deepseek');
  await page.fill('#api-base', `http://127.0.0.1:${mockPort}/v1`);
  await page.fill('#api-model', 'deepseek-chat');
  await page.fill('#api-key', 'test-only-key');
  await page.click('#api-test');
  await page.waitForFunction(() => document.querySelector('#config-status')?.textContent.includes('连接成功'));
  okay('DeepSeek-compatible connection test succeeds', true);
  await page.click('#api-form button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('#api-dialog')?.open);
  okay('configuration is saved and the dialog closes', true);

  await page.click('a[href="#profile"]');
  await page.waitForSelector('#profile-form');
  await page.fill('[name="name"]', '验收用户');
  await page.fill('[name="age"]', '24');
  await page.fill('[name="height"]', '172');
  await page.fill('[name="weight"]', '68');
  await page.selectOption('[name="level"]', 'regular');
  await page.selectOption('[name="goal"]', 'habit');
  await page.selectOption('[name="place"]', 'home');
  await page.selectOption('[name="days"]', '5');
  await page.fill('[name="minutes"]', '25');
  await page.check('[name="confirm"]');
  await page.click('#profile-form button[type="submit"]');
  await page.waitForURL(/#plan$/);
  await page.waitForSelector('.plan-list');
  okay('profile creates a seven-day plan', await page.locator('.plan-row').count() === 7);
  await hideToast(page);
  await page.screenshot({ path: join(shots, 'plan.png'), fullPage: true });

  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const logButton = page.locator(`[data-log-date="${today}"]`);
  okay('today has a training check-in action', await logButton.count() === 1);
  await logButton.click();
  await page.waitForSelector('#log-form');
  await page.fill('[name="minutes"]', '25');
  await page.fill('[name="weight"]', '68');
  await page.selectOption('[name="feeling"]', 'good');
  await page.fill('[name="note"]', '真实浏览器验收记录');
  await page.click('#log-form button[type="submit"]');
  await page.waitForSelector(`text=${today}`);
  okay('training log is saved and rendered', await page.locator('.records').innerText().then(text => text.includes('真实浏览器验收记录')));

  await page.click('a[href="#chat"]');
  await page.fill('#question', '为什么这样安排？');
  await page.click('#chat-form button');
  await page.waitForFunction(() => document.querySelector('.messages')?.textContent.includes('E2E MOCK'));
  okay('chat request reaches the configured model adapter', await page.locator('.messages').innerText().then(text => text.includes('E2E MOCK：这是本地模拟回复。')));
  await hideToast(page);
  await page.screenshot({ path: join(shots, 'chat.png'), fullPage: true });

  await page.reload({ waitUntil: 'networkidle' });
  await page.click('a[href="#record"]');
  await page.waitForSelector('.records');
  okay('training log survives a reload', await page.locator('.records').innerText().then(text => text.includes('真实浏览器验收记录')));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://127.0.0.1:${port}/#home`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hero');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  okay('mobile layout has no horizontal overflow', !overflow);
  await page.screenshot({ path: join(shots, 'mobile-home.png'), fullPage: true });

  console.log(`${passed} browser checks passed`);
}

try {
  await main();
} catch (error) {
  console.error(error.stack || String(error));
  if (backend) {
    try { console.error('\n--- backend log ---\n' + readFileSync(logPath, 'utf8')); } catch {}
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (mock) await new Promise(resolve => mock.close(resolve));
  if (backend && !backend.killed) backend.kill();
  try { rmSync(dataDir, { recursive: true, force: true }); } catch {}
}
