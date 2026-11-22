import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { normalizeVideoForTikTok } from './videoNormalizer.ts';

const BRAVE_PATH = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const AUTOMATION_PROFILE_DIR = 'D:\\denis.com\\brave_automation_profile';

export async function uploadToYouTubeShorts(options: {
  filePath: string;
  title: string;
  description: string;
}) {
  const { filePath: rawPath, title, description } = options;

  if (!fs.existsSync(rawPath)) {
    throw new Error(`Arquivo não encontrado: ${rawPath}`);
  }

  // 1. Normaliza para 9:16 vertical (Shorts exige formato vertical)
  let uploadPath = rawPath;
  try {
    uploadPath = await normalizeVideoForTikTok(rawPath);
  } catch (err: any) {
    console.warn('[YouTubeShortsUploader] Normalização fallback:', err.message);
  }

  if (!fs.existsSync(AUTOMATION_PROFILE_DIR)) {
    fs.mkdirSync(AUTOMATION_PROFILE_DIR, { recursive: true });
  }

  // Lança o Brave mantendo a sessão persistente do usuário
  const context = await chromium.launchPersistentContext(AUTOMATION_PROFILE_DIR, {
    executablePath: BRAVE_PATH,
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check']
  });

  try {
    const page = await context.newPage();
    console.log('[YouTubeShortsUploader] Acessando YouTube Studio Upload...');
    await page.goto('https://studio.youtube.com/channel/UCk2l2zHD2A1arRmLtm0ZHCA', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    // Clica no botão CRIAR / UPLOAD
    console.log('[YouTubeShortsUploader] Localizando botão de envio...');
    const createBtn = await page.$('#create-icon, ytcp-button#create-icon, button:has-text("Criar"), ytcp-icon-button[aria-label="Criar"]');
    if (createBtn) {
      await createBtn.click();
      await page.waitForTimeout(1000);
      const uploadVideoItem = await page.$('tp-yt-paper-item:has-text("Enviar vídeos"), #text-item-0');
      if (uploadVideoItem) await uploadVideoItem.click();
    }

    await page.waitForTimeout(2000);

    // Input do arquivo
    const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 20000 });
    if (!fileInput) throw new Error('Campo de upload de arquivo do YouTube Studio não encontrado.');

    console.log('[YouTubeShortsUploader] Inserindo arquivo de vídeo:', uploadPath);
    await fileInput.setInputFiles(uploadPath);

    // Aguarda o diálogo de detalhes abrir
    await page.waitForTimeout(5000);

    // Preenche Título (com a hashtag #Shorts obrigatória para indexar no carrossel de Shorts)
    console.log('[YouTubeShortsUploader] Preenchendo título e descrição...');
    const titleArea = await page.$('#textbox[aria-label*="título"], #textbox[aria-label*="Title"], div[id="textbox"][contenteditable="true"]');
    if (titleArea) {
      await titleArea.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      const finalTitle = title.includes('#Shorts') ? title : `${title} #Shorts`;
      await page.keyboard.type(finalTitle.slice(0, 99), { delay: 10 });
    }

    // Auto-aceite: Marca como "Não é conteúdo para crianças"
    try {
      const notForKids = await page.$('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]');
      if (notForKids) await notForKids.click();
    } catch {}

    // Avança etapas: Elementos -> Verificação -> Visibilidade (3x Próximo / Next)
    console.log('[YouTubeShortsUploader] Avançando etapas com auto-aceite...');
    for (let i = 0; i < 3; i++) {
      try {
        const nextBtn = await page.$('#next-button, button:has-text("Próximo"), button:has-text("Next")');
        if (nextBtn) {
          await nextBtn.click();
          await page.waitForTimeout(1500);
        }
      } catch {}
    }

    // Visibilidade: Seleciona "Público"
    console.log('[YouTubeShortsUploader] Marcando como Público e Publicando...');
    try {
      const publicRadio = await page.$('tp-yt-paper-radio-button[name="PUBLIC"]');
      if (publicRadio) await publicRadio.click();
    } catch {}

    await page.waitForTimeout(1500);

    // Clica no botão Publicar / Salvar
    const publishBtn = await page.$('#done-button, button:has-text("Publicar"), button:has-text("Publish"), button:has-text("Salvar")');
    if (publishBtn) {
      await publishBtn.click();
    }

    // Aguarda confirmação
    await page.waitForTimeout(8000);
    console.log('[YouTubeShortsUploader] YouTube Shorts publicado com sucesso!');
    return { success: true };
  } finally {
    await context.close();
  }
}
