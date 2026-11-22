import { chromium } from 'playwright';
import { db } from '../db.ts';
import { downloadCleanTikTokVideo } from './mediaDownloader.ts';
import { normalizeVideoForTikTok } from './videoNormalizer.ts';
import { uploadToInstagramReels } from './instagramWebUploader.ts';
import { uploadToYouTubeShorts } from './youtubeWebUploader.ts';
import fs from 'fs';

const BRAVE_PATH = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

export async function processAndPostToAllPlatforms(
  videoUrl: string,
  options: {
    hook: string;
    caption: string;
    title: string;
    targetPlatforms?: ('TIKTOK' | 'INSTAGRAM' | 'YOUTUBE')[];
  }
) {
  const { hook, caption, title, targetPlatforms = ['TIKTOK', 'INSTAGRAM', 'YOUTUBE'] } = options;

  console.log(`\n=======================================================`);
  console.log(`INICIANDO DISTRIBUIÇÃO TRÍPLICE: ${videoUrl}`);
  console.log(`PLATAFORMAS DESTINO: ${targetPlatforms.join(', ')}`);
  console.log(`=======================================================`);

  // 1. BAIXA NO DISCO D:
  console.log(`[1/5] Baixando vídeo no Disco D:... ${videoUrl}`);
  const dl = await downloadCleanTikTokVideo(videoUrl);
  if (!dl.success || !dl.filePath) {
    throw new Error(`Falha no download: ${dl.error}`);
  }
  const rawPath = dl.filePath;

  // 2. NORMALIZA NO DISCO D: (9:16 vertical)
  console.log(`[2/5] Normalizando vídeo para 9:16 vertical no Disco D:...`);
  const normalizedPath = await normalizeVideoForTikTok(rawPath);

  // 3. ENVIO PARA O TIKTOK
  if (targetPlatforms.includes('TIKTOK')) {
    try {
      console.log(`[3/5] Disparando para TikTok Studio...`);
      const ttAccount = db.prepare("SELECT access_token FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
      if (ttAccount && ttAccount.access_token) {
        const browser = await chromium.launch({
          executablePath: BRAVE_PATH,
          headless: true,
          args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
        });
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          viewport: { width: 1440, height: 900 }
        });
        await context.addCookies([
          { name: 'sessionid', value: ttAccount.access_token.trim(), domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
          { name: 'sessionid_ss', value: ttAccount.access_token.trim(), domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
          { name: 'sid_tt', value: ttAccount.access_token.trim(), domain: '.tiktok.com', path: '/', httpOnly: true, secure: true }
        ]);
        const page = await context.newPage();
        await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload', { waitUntil: 'domcontentloaded', timeout: 35000 });
        await page.waitForTimeout(3000);
        const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 20000 });
        await fileInput?.setInputFiles(normalizedPath);

        for (let attempts = 0; attempts < 18; attempts++) {
          await page.waitForTimeout(2000);
          const ready = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            return btns.some(b => b.innerText.trim() === 'Post' || b.innerText.trim() === 'Publicar');
          });
          if (ready) break;
        }

        await page.evaluate(() => {
          document.querySelectorAll('#react-joyride-portal, .react-joyride__overlay, .TUXModal-overlay, [data-floating-ui-portal]').forEach(el => el.remove());
        });

        try {
          const editor = await page.$('div[contenteditable="true"]');
          if (editor) {
            await editor.click();
            await page.keyboard.press('Control+A');
            await page.keyboard.press('Backspace');
            await page.keyboard.type(caption, { delay: 15 });
          }
        } catch {}

        await page.waitForTimeout(2000);

        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const postBtn = btns.find(b => (b.innerText.trim() === 'Post' || b.innerText.trim() === 'Publicar') && !b.disabled);
          if (postBtn) {
            postBtn.scrollIntoView();
            postBtn.click();
            postBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          }
        });
        await page.waitForTimeout(5000);
        await browser.close();
        console.log(`[SUCESSO] TikTok postado!`);
      }
    } catch (e: any) {
      console.error(`[TikTok Erro]:`, e.message);
    }
  }

  // 4. ENVIO PARA O INSTAGRAM REELS
  if (targetPlatforms.includes('INSTAGRAM')) {
    try {
      console.log(`[4/5] Disparando para Instagram Reels...`);
      const igAccount = db.prepare("SELECT access_token FROM social_accounts WHERE platform = 'INSTAGRAM'").get() as any;
      if (igAccount && igAccount.access_token) {
        await uploadToInstagramReels({
          filePath: normalizedPath,
          caption,
          sessionId: igAccount.access_token
        });
        console.log(`[SUCESSO] Instagram Reels postado!`);
      }
    } catch (e: any) {
      console.error(`[Instagram Erro]:`, e.message);
    }
  }

  // 5. ENVIO PARA O YOUTUBE SHORTS
  if (targetPlatforms.includes('YOUTUBE')) {
    try {
      console.log(`[5/5] Disparando para YouTube Shorts...`);
      await uploadToYouTubeShorts({
        filePath: normalizedPath,
        title: `${hook} #Shorts`,
        description: caption
      });
      console.log(`[SUCESSO] YouTube Shorts postado!`);
    } catch (e: any) {
      console.error(`[YouTube Erro]:`, e.message);
    }
  }

  // 6. LIMPEZA TOTAL NO DISCO D:
  console.log(`Limpando arquivos temporários do Disco D:...`);
  try {
    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
    if (fs.existsSync(normalizedPath)) fs.unlinkSync(normalizedPath);
    console.log(`Disco D limpo com sucesso!`);
  } catch (e: any) {
    console.warn('Aviso ao limpar disco D:', e.message);
  }
}
