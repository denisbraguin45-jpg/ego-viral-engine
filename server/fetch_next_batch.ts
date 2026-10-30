import { chromium } from 'playwright';

async function fetchNextTargets() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  await context.addCookies([
    { name: 'sessionid', value: '5d2b274a0c564ed042a346dd20477138', domain: '.tiktok.com', path: '/' }
  ]);
  const page = await context.newPage();

  const queries = [
    { name: 'Lucifer', q: 'lucifer morningstar edit' },
    { name: 'Supernatural', q: 'dean winchester edit' },
    { name: 'Peaky Blinders', q: 'thomas shelby edit' },
  ];

  const results: Record<string, string[]> = {};

  for (const item of queries) {
    const url = `https://www.tiktok.com/search?q=${encodeURIComponent(item.q)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/video/"]')).map(a => (a as HTMLAnchorElement).href);
    });
    const unique = Array.from(new Set(links));
    console.log(`[Search] "${item.q}" -> ${unique.length} vídeos:`, unique.slice(0, 4));
    results[item.name] = unique.slice(0, 4);
  }

  await browser.close();
}

fetchNextTargets();
