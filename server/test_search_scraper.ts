import { chromium } from 'playwright';

async function testSearch(query: string) {
  console.log(`Buscando no TikTok: "${query}"...`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const url = `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  const links = await page.$$eval('a[href*="/video/"]', els => els.map(e => (e as HTMLAnchorElement).href));
  const unique = Array.from(new Set(links));

  console.log(`Encontrados ${unique.length} links únicos para "${query}":`);
  unique.slice(0, 10).forEach(l => console.log(' -', l));

  await browser.close();
  return unique;
}

testSearch('fight club edit');
