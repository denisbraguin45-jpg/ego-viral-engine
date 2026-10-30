import { chromium } from 'playwright';

async function testWithCookie() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  await context.addCookies([
    { name: 'sessionid', value: '5d2b274a0c564ed042a346dd20477138', domain: '.tiktok.com', path: '/' }
  ]);
  const page = await context.newPage();
  
  const tags = ['breakingbad', 'thementalist', 'prisonbreak', 'luciferedit'];
  for (const t of tags) {
    await page.goto(`https://www.tiktok.com/tag/${t}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/video/"]')).map(a => (a as HTMLAnchorElement).href);
    });
    console.log(`Tag #${t} (com cookie) -> ${links.length} vídeos:`);
    links.forEach(l => console.log('  ->', l));
  }
  await browser.close();
}

testWithCookie();
