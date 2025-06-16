import { execSync } from 'child_process';
import { createServer } from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

function serveStatic(dir, port) {
  const server = createServer(async (req, res) => {
    const urlPath = req.url.split('?')[0];
    let filePath = path.join(dir, urlPath);
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
      const data = await fs.readFile(filePath);
      const ext = path.extname(filePath);
      const type = ext === '.html' ? 'text/html'
        : ext === '.js' ? 'application/javascript'
        : ext === '.css' ? 'text/css'
        : 'text/plain';
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise(resolve => server.listen(port, () => resolve(server)));
}

async function main() {
  execSync('npx next build prototype/client', { stdio: 'inherit' });
  const server = await serveStatic('prototype/client/out', 3000);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');

  await page.evaluate(() => localStorage.clear());

  const curl = "curl -X POST /api/v1/playlists -d '{\"items\":[{\"id\":\"a\",\"source\":\"https://example.com/a\",\"duration\":1},{\"id\":\"b\",\"source\":\"https://example.com/b\",\"duration\":1}]}'";
  await page.type('textarea', curl);
  await page.$$eval('button', btns => {
    const b = btns.find(el => el.textContent.trim() === 'Send');
    if (b) b.click();
  });

  await page.waitForFunction(() => {
    const logs = document.querySelectorAll('.chat-log pre');
    return logs.length && logs[logs.length - 1].textContent.includes('result');
  });

  const state = await page.evaluate(() => localStorage.getItem('dp1_state'));
  const chat = await page.evaluate(() => document.querySelector('.chat-log pre')?.textContent);

  const firstSrc = await page.$eval('iframe', el => el.getAttribute('src'));
  await new Promise(r => setTimeout(r, 1500));
  const secondSrc = await page.$eval('iframe', el => el.getAttribute('src'));

  console.log('state', state);
  console.log('chat', chat);
  console.log('srcChange', firstSrc !== secondSrc);

  await browser.close();
  server.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
