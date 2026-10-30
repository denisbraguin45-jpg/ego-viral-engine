import { chromium } from 'playwright';

async function testTags() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  const tags = ['breakingbad', 'thementalist', 'prisonbreak', 'luciferedit'];
  for (const t of tags) {
    await page.goto(`https://www.tiktok.com/tag/${t}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/video/"]')).map(a => (a as HTMLAnchorElement).href);
    });
    console.log(`Tag #${t} -> ${links.length} vídeos:`, links.slice(0, 3));
  }
  await browser.close();
}

testTags();
