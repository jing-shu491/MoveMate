const puppeteer = require('puppeteer-core');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setViewport({ width: 1280, height: 820, deviceScaleFactor: 1.5 });
  await page.goto('file:///' + path.resolve(__dirname, '..', 'prototype', 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

  // 截图：首页
  await page.screenshot({ path: path.join(__dirname, '..', 'prototype', 'preview_home.png') });

  // 测试：进入健康评估
  await page.evaluate(() => show('assess'));
  await new Promise(r => setTimeout(r, 200));

  // 测试：触发生成处方流程
  await page.evaluate(() => generatePlan());
  await new Promise(r => setTimeout(r, 4500)); // 等 5 步动画完成
  const planActive = await page.evaluate(() => document.getElementById('plan').classList.contains('active'));
  await page.screenshot({ path: path.join(__dirname, '..', 'prototype', 'preview_plan.png') });

  // 测试：智能体问答
  await page.evaluate(() => show('chat'));
  await page.evaluate(() => chatAsk('为什么我的有氧要选低冲击动作？'));
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(__dirname, '..', 'prototype', 'preview_chat.png') });

  console.log('JS 错误数:', errors.length);
  errors.forEach(e => console.log('  ' + e));
  console.log('生成处方后跳转到"运动处方"页:', planActive);
  console.log('截图已生成');
  await browser.close();
}
main().catch(e => { console.error(e.message); process.exit(1); });
