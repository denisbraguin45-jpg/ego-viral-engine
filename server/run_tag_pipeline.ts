import { scrapeViralVideosFromTag } from './services/liveTagScraper.ts';
import { downloadCleanTikTokVideo } from './services/mediaDownloader.ts';
import { uploadToTikTokWeb } from './services/tiktokWebUploader.ts';
import { db } from './db.ts';

// Tags exatas solicitadas pelo usuário (séries e filmes virais)
const TARGET_TAGS = [
  { tag: 'thementalist', name: 'O Mentalista', type: 'Série' },
  { tag: 'breakingbad', name: 'Breaking Bad', type: 'Série' },
  { tag: 'prisonbreak', name: 'Prison Break', type: 'Série' },
  { tag: 'lucifer', name: 'Lucifer', type: 'Série' },
  { tag: 'supernatural', name: 'Supernatural', type: 'Série' },
  { tag: 'peakyblinders', name: 'Peaky Blinders', type: 'Série' },
  { tag: 'interstellar', name: 'Interestelar', type: 'Filme' },
  { tag: 'fightclub', name: 'Clube da Luta', type: 'Filme' },
];

export async function runTagDrivenPipeline(videosPerTag: number = 3) {
  console.log('=======================================================');
  console.log('INICIANDO ESTEIRA REAL: PESQUISA POR HASHTAG + DOWNLOAD DISCO D + POSTAGEM');
  console.log('=======================================================');

  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  if (!account || !account.access_token) {
    console.error('Conta tt-filmes não configurada.');
    return;
  }

  let totalPosted = 0;

  for (const item of TARGET_TAGS) {
    console.log(`\n>>> PROCESSANDO HASHTAG #${item.tag} (${item.name}) <<<`);

    // 1. Scrape dos vídeos virais reais direto na página da hashtag
    const videos = await scrapeViralVideosFromTag(item.tag, 'ego-series', videosPerTag);

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      console.log(`\n[Vídeo ${i + 1}/${videos.length}] Baixando clipe viral de #${item.tag}: ${v.url}`);

      // 2. Download no Disco D:
      const dl = await downloadCleanTikTokVideo(v.url);
      if (!dl.success || !dl.filePath) {
        console.error(`Falha no download de ${v.url}:`, dl.error);
        continue;
      }

      // 3. Monta legenda contextualizada e natural com a hashtag exata + CTA EGO TV
      const rawTitle = dl.title || `${item.name} Edit`;
      const cleanTitle = rawTitle.replace(/#\S+/g, '').replace(/@\S+/g, '').trim().slice(0, 90);
      const titleToUse = cleanTitle.length > 5 ? cleanTitle : `Melhor cena de ${item.name} 🔥`;

      const caption = `🎬 ${titleToUse}\n\n🍿 Assista a ${item.name} e milhares de outros filmes e séries em streaming na EGO TV!\n📲 Conheça no link da bio @egotv00\n🔗 https://egotv.net/r/braghin\n\n#${item.tag} #${item.tag}edit #${item.name.replace(/\s+/g, '')} #series #filmes #EgoTV`;

      console.log(`Legenda gerada:\n${caption}\n`);

      // 4. Postagem no TikTok Studio
      console.log(`Publicando no TikTok Studio com visibilidade pública...`);
      const uploadRes = await uploadToTikTokWeb({
        filePath: dl.filePath,
        caption,
        sessionId: account.access_token,
        headless: true,
      });

      if (uploadRes.success) {
        totalPosted++;
        console.log(`[SUCESSO] Vídeo de #${item.tag} postado no TikTok! (ID: ${uploadRes.publishId})`);

        // Registra no banco
        db.prepare(`
          INSERT INTO video_pipeline_items (
            channel_id, title, source_url, source_platform, original_external_id,
            pipeline_state, file_path, caption_tiktok, work_reference, niche_label,
            acquisition_notes, created_at, updated_at
          ) VALUES (
            'ego-series', ?, ?, 'TIKTOK', ?,
            'PUBLICADO', ?, ?, ?, ?,
            ?, datetime('now'), datetime('now')
          )
        `).run(
          titleToUse,
          v.url,
          v.url.match(/\/video\/(\d+)/)?.[1] || `tt_${Date.now()}`,
          dl.filePath,
          caption,
          item.name,
          `#${item.tag}`,
          `POSTADO COM SUCESSO VIA HASHTAG #${item.tag} (ID: ${uploadRes.publishId})`
        );
      } else {
        console.error(`Falha no upload do vídeo:`, uploadRes.message);
      }

      // Pausa anti-spam entre uploads
      console.log('Aguardando 15 segundos antes do próximo vídeo...');
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  console.log(`\n=======================================================`);
  console.log(`ESTEIRA CONCLUÍDA: Total de ${totalPosted} vídeos reais publicados.`);
  console.log(`=======================================================`);
}

// Executa com 2 a 3 vídeos por hashtag solicitada
const perTag = process.argv[2] ? parseInt(process.argv[2], 10) : 2;
runTagDrivenPipeline(perTag);
