const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function svgToPng(svgPath, pngPath, scale = 2) {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const svg = fs.readFileSync(svgPath, 'utf8');
    // extract intrinsic size from viewBox
    const vb = /viewBox="([\d.\-]+) ([\d.\-]+) ([\d.\-]+) ([\d.\-]+)"/.exec(svg);
    const w = vb ? parseFloat(vb[3]) : 1000;
    const h = vb ? parseFloat(vb[4]) : 600;
    await page.setViewport({ width: Math.ceil(w * scale) + 40, height: Math.ceil(h * scale) + 40, deviceScaleFactor: 1 });
    await page.setContent('<html><body style="margin:0;background:#fff;display:inline-block;padding:20px;">' + svg + '</body></html>', { waitUntil: 'networkidle0' });
    const el = await page.$('svg');
    await el.screenshot({ path: pngPath });
    return fs.statSync(pngPath).size;
  } finally {
    await browser.close();
  }
}

async function main() {
  const dir = path.join(__dirname, '..', 'diagrams', 'svg');
  const outDir = path.join(__dirname, '..', 'diagrams', 'png');
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));
  for (const f of files) {
    const png = path.join(outDir, f.replace(/\.svg$/, '.png'));
    try {
      const size = await svgToPng(path.join(dir, f), png);
      console.log('OK ' + f + ' -> ' + png + ' (' + size + ' bytes)');
    } catch (e) { console.log('FAIL ' + f + ': ' + e.message); }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
