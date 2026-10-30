import { chromium } from 'playwright';

async function testCookieSearch() {
  console.log('Iniciando busca com cookie no TikTok...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  await context.addCookies([
    { name: 'sessionid', value: '5d2b274a0c564ed042a346dd20477138', domain: '.tiktok.com', path: '/' }
  ]);

  const page = await context.newPage();
  await page.goto('https://www.tiktok.com/search/video?q=interstellar%20edit', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  const links = await page.$$eval('a[href*="/video/"]', els => els.map(e => (e as HTMLAnchorElement).href));
  const unique = Array.from(new Set(links));

  console.log(`Encontrados com cookie: ${unique.length} vídeos`);
  unique.slice(0, 10).forEach(l => console.log(' -', l));

  await browser.close();
}

testCookieSearch();
