const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function htmlToPdf(htmlPath, pdfPath) {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.goto('file:///' + path.resolve(htmlPath).replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    });
    return fs.statSync(pdfPath).size;
  } finally {
    await browser.close();
  }
}

module.exports = { htmlToPdf };

if (require.main === module) {
  const htmlPath = process.argv[2];
  const pdfPath = process.argv[3];
  htmlToPdf(htmlPath, pdfPath).then(size => {
    console.log('PDF OK: ' + pdfPath + ' (' + size + ' bytes)');
  }).catch(e => { console.error(e); process.exit(1); });
}
