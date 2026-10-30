import { downloadCleanTikTokVideo } from './services/mediaDownloader.ts';
import { uploadToTikTokWeb } from './services/tiktokWebUploader.ts';
import { db } from './db.ts';

async function runSequentialBatchPosting(limitCount = 30) {
  console.log(`=======================================================`);
  console.log(`INICIANDO POSTAGEM SEQUENCIAL DE ${limitCount} VÍDEOS NO TIKTOK @EGOTV00`);
  console.log(`TODOS OS VÍDEOS SERÃO PÚBLICOS COM CTA EGO TV`);
  console.log(`=======================================================`);

  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  if (!account || !account.access_token) {
    console.error('Conta tt-filmes não configurada.');
    return;
  }

  // Busca os vídeos prontos (incluindo o do Joe Black #330 no topo)
  const items = db.prepare(`
    SELECT * FROM video_pipeline_items
    WHERE channel_id = 'ego-filmes' AND pipeline_state = 'PRONTO_PARA_PUBLICACAO'
    ORDER BY CASE WHEN id = 330 THEN 0 ELSE 1 END, id ASC
    LIMIT ?
  `).all(limitCount) as any[];

  console.log(`Itens carregados para disparo: ${items.length}`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\n---------------------------------------------------`);
    console.log(`[Vídeo ${i + 1}/${items.length}] ID #${item.id} - ${item.title.slice(0, 70)}...`);

    // 1. Download do vídeo limpo para o Disco Local D:
    let filePath = item.file_path;
    if (!filePath) {
      console.log(`Baixando MP4 limpo no Disco Local D:...`);
      const dl = await downloadCleanTikTokVideo(item.source_url);
      if (!dl.success || !dl.filePath) {
        console.error(`Falha no download do vídeo #${item.id}:`, dl.error);
        failCount++;
        continue;
      }
      filePath = dl.filePath;
    }

    // 2. Monta legenda padronizada com o CTA da EGO TV
    let caption = item.caption_tiktok;
    if (!caption || !caption.includes('EGO TV')) {
      const cleanTitle = (item.title || 'Cena Incrível').replace(/#\S+/g, '').trim().slice(0, 90);
      caption = `🎬 ${cleanTitle}\n\n🍿 O melhor catálogo de filmes e séries por streaming! Conheça a EGO TV no link da bio 📲 @egotv00\n🔗 https://egotv.net/r/braghin\n\n#EgoTV #filmes #cinema #dicasdefilmes #filmeseseries #trechosdefilmes`;
    }

    // 3. Postagem no TikTok Studio
    console.log(`Disparando envio para @egotv00 no TikTok Studio...`);
    const uploadRes = await uploadToTikTokWeb({
      filePath,
      caption,
      sessionId: account.access_token,
      headless: true,
    });

    if (uploadRes.success) {
      successCount++;
      console.log(`[SUCESSO] Vídeo #${item.id} postado! (Publish ID: ${uploadRes.publishId})`);

      db.prepare(`
        UPDATE video_pipeline_items 
        SET pipeline_state = 'PUBLICADO',
            file_path = ?,
            caption_tiktok = ?,
            acquisition_notes = ?
        WHERE id = ?
      `).run(
        filePath,
        caption,
        `PUBLICADO COM SUCESSO NO TIKTOK @egotv00 (Público, CTA EGO TV, ID: ${uploadRes.publishId})`,
        item.id
      );

      if (item.content_item_id) {
        db.prepare(`
          UPDATE content_items 
          SET workflow_status = 'PUBLISHED' 
          WHERE id = ?
        `).run(item.content_item_id);

        db.prepare(`
          INSERT INTO publication_queue (
            content_id, channel_id, social_account_id, platform,
            scheduled_for, caption_used, status, approved_for_publish,
            attempts, external_post_id, published_at, is_demo
          ) VALUES (
            ?, 'ego-filmes', 'tt-filmes', 'TIKTOK',
            datetime('now'), ?, 'PUBLISHED_OFFICIAL_API', 1,
            1, ?, datetime('now'), 0
          )
        `).run(item.content_item_id, caption, uploadRes.publishId || `tt_web_${Date.now()}`);
      }
    } else {
      failCount++;
      console.error(`[ERRO] Falha no upload do vídeo #${item.id}:`, uploadRes.message);
    }

    // Intervalo de segurança entre vídeos para não ser bloqueado por rate limit do TikTok
    if (i < items.length - 1) {
      console.log(`Aguardando 10 segundos antes do próximo vídeo...`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  console.log(`\n=======================================================`);
  console.log(`LOTE CONCLUÍDO: ${successCount} postados com sucesso, ${failCount} falhas.`);
  console.log(`=======================================================`);
}

runSequentialBatchPosting(30);
