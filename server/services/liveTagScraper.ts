import { chromium } from 'playwright';
import { db } from '../db.ts';

export interface ScrapedTikTokVideo {
  url: string;
  tag: string;
  channelId: string;
}

/**
 * Faz scraping real de vídeos do TikTok navegando diretamente na tag usando a sessão autenticada
 */
export async function scrapeViralVideosFromTag(
  tag: string,
  channelId: 'ego-filmes' | 'ego-series' | 'ego-anime',
  limit: number = 10
): Promise<ScrapedTikTokVideo[]> {
  const cleanTag = tag.replace('#', '').trim();
  console.log(`\n[TagScraper] Navegando no TikTok na tag #${cleanTag} (Canal: ${channelId})...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  // Injeta cookie de sessão do TikTok
  await context.addCookies([
    { name: 'sessionid', value: '5d2b274a0c564ed042a346dd20477138', domain: '.tiktok.com', path: '/' },
  ]);

  const page = await context.newPage();
  const targetUrl = `https://www.tiktok.com/tag/${encodeURIComponent(cleanTag)}`;

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(4000);

    // Scroll para carregar mais itens
    for (let s = 0; s < 3; s++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(1500);
    }

    const videoUrls: string[] = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/video/"]'));
      return links.map(a => (a as HTMLAnchorElement).href.split('?')[0]);
    });

    const uniqueUrls = Array.from(new Set(videoUrls));
    console.log(`[TagScraper] Encontrados ${uniqueUrls.length} vídeos brutos em #${cleanTag}.`);

    // Filtra duplicatas já presentes no banco
    const results: ScrapedTikTokVideo[] = [];
    for (const url of uniqueUrls) {
      if (results.length >= limit) break;
      const alreadyInDb = db.prepare('SELECT id FROM video_pipeline_items WHERE source_url LIKE ?').get(`${url}%`);
      if (!alreadyInDb) {
        results.push({ url, tag: cleanTag, channelId });
      }
    }

    console.log(`[TagScraper] Retornando ${results.length} vídeos 100% inéditos para #${cleanTag}.`);
    await browser.close();
    return results;
  } catch (err: any) {
    console.error(`[TagScraper] Erro ao extrair tag #${cleanTag}:`, err.message);
    await browser.close();
    return [];
  }
}
