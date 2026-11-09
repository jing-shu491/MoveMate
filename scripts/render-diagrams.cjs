const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const MERMAID_JS = path.join(__dirname, '..', 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');

async function renderDiagram(code, id) {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent('<html><body></body></html>', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: MERMAID_JS });
    const svg = await page.evaluate(async (code, id) => {
      mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose', fontFamily: 'Microsoft YaHei, sans-serif' });
      const { svg } = await mermaid.render(id, code);
      return svg;
    }, code, id);
    return svg;
  } finally {
    await browser.close();
  }
}

async function main() {
  const inDir = path.join(__dirname, '..', 'diagrams');
  const outDir = path.join(inDir, 'svg');
  fs.mkdirSync(outDir, { recursive: true });

  const files = fs.readdirSync(inDir).filter(f => f.endsWith('.mmd'));
  if (!files.length) { console.log('No .mmd files found'); return; }

  for (const f of files) {
    const code = fs.readFileSync(path.join(inDir, f), 'utf8');
    const id = 'mmd_' + f.replace(/[^a-zA-Z0-9]/g, '_');
    console.log('Rendering ' + f + ' ...');
    try {
      const svg = await renderDiagram(code, id);
      const out = path.join(outDir, f.replace(/\.mmd$/, '.svg'));
      fs.writeFileSync(out, svg);
      console.log('  -> ' + out + ' (' + svg.length + ' bytes)');
    } catch (e) {
      console.error('  FAILED ' + f + ': ' + e.message);
    }
  }
  console.log('DONE');
}

main().catch(e => { console.error(e); process.exit(1); });
