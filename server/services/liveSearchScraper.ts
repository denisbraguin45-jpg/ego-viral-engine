import { chromium } from 'playwright';
import { db } from '../db.ts';

export interface ViralSearchCandidate {
  url: string;
  query: string;
  category: 'FILMES' | 'SERIES';
  workName: string;
}

/**
 * Busca vídeos virais reais no TikTok pesquisando por termos de alta atração (ex: "the mentalist edit", "heisenberg edit")
 */
export async function scrapeViralEditsBySearch(
  query: string,
  workName: string,
  category: 'FILMES' | 'SERIES' = 'SERIES',
  limit: number = 3
): Promise<ViralSearchCandidate[]> {
  console.log(`\n[SearchScraper] Buscando no TikTok: "${query}"...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  await context.addCookies([
    { name: 'sessionid', value: '5d2b274a0c564ed042a346dd20477138', domain: '.tiktok.com', path: '/' },
  ]);

  const page = await context.newPage();
  const searchUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`;

  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(6000);

    const videoLinks: string[] = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/video/"]'));
      return anchors.map(a => (a as HTMLAnchorElement).href.split('?')[0]);
    });

    const uniqueLinks = Array.from(new Set(videoLinks));
    console.log(`[SearchScraper] "${query}" retornou ${uniqueLinks.length} vídeos.`);

    const candidates: ViralSearchCandidate[] = [];
    for (const url of uniqueLinks) {
      if (candidates.length >= limit) break;
      // Garante que não foi postado antes
      const alreadyPosted = db.prepare('SELECT id FROM video_pipeline_items WHERE source_url LIKE ? AND pipeline_state = \'PUBLICADO\'').get(`${url}%`);
      if (!alreadyPosted) {
        candidates.push({
          url,
          query,
          category,
          workName,
        });
      }
    }

    await browser.close();
    return candidates;
  } catch (err: any) {
    console.error(`[SearchScraper] Erro na busca "${query}":`, err.message);
    await browser.close();
    return [];
  }
}
