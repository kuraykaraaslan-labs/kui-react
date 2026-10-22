// Usage: node scripts/take-screenshots.js
// Requires: npm install puppeteer  (or npx puppeteer)
// Dev server must be running on BASE_URL before executing.

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const themes = [
  { name: 'ai',          path: '/theme/ai' },
  { name: 'api-doc',     path: '/theme/api-doc' },
  { name: 'blog',        path: '/theme/blog' },
  { name: 'commerce',    path: '/theme/commerce' },
  { name: 'common',      path: '/theme/common' },
  { name: 'event',       path: '/theme/event' },
  { name: 'fintech',     path: '/theme/fintech' },
  { name: 'food',        path: '/theme/food' },
  { name: 'forum',       path: '/theme/forum' },
  { name: 'jobs',        path: '/theme/jobs' },
  { name: 'landing',     path: '/theme/landing' },
  { name: 'media',       path: '/theme/media' },
  { name: 'real-estate', path: '/theme/real-estate' },
  { name: 'social',      path: '/theme/social' },
  { name: 'travel',      path: '/theme/travel' },
  { name: 'iot',         path: '/theme/iot' },
  { name: 'nft',         path: '/theme/nft' },
  { name: 'scada',       path: '/theme/scada' },
];

const BASE_URL   = process.env.BASE_URL   || 'http://localhost:3000';
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.resolve(__dirname, '../public/assets/img');
const VIEWPORT   = { width: 1440, height: 900 };

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  for (const theme of themes) {
    const url     = `${BASE_URL}${theme.path}`;
    const outFile = path.join(OUTPUT_DIR, `screenshot-${theme.name}.png`);

    try {
      console.log(`[${theme.name}] → ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 1200));
      await page.screenshot({ path: outFile, fullPage: false });
      console.log(`[${theme.name}] saved → ${outFile}`);
    } catch (err) {
      console.error(`[${theme.name}] FAILED: ${err.message}`);
    }
  }

  await browser.close();
  console.log('\nAll done.');
})();
