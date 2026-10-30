import { downloadCleanTikTokVideo } from './services/mediaDownloader.ts';
import { uploadToTikTokWeb } from './services/tiktokWebUploader.ts';
import { db } from './db.ts';

interface LaunchOptions {
  limitCount?: number;
  channelId?: string; // 'ego-filmes' | 'ego-series' | 'ego-anime'
}

export async function launchVideosWithoutDuplicates(options: LaunchOptions = {}) {
  const { limitCount = 30, channelId } = options;

  console.log(`=======================================================`);
  console.log(`INICIANDO LANÇAMENTO INTELIGENTE (ANTI-DUPLICATAS) NO TIKTOK @EGOTV00`);
  console.log(`Canal: ${channelId || 'TODOS OS DISPONÍVEIS'}`);
  console.log(`Meta: até ${limitCount} vídeos inéditos`);
  console.log(`=======================================================`);

  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  if (!account || !account.access_token) {
    console.error('Conta tt-filmes não configurada no banco de dados.');
    return;
  }

  // Query estrita: apenas vídeos PRONTO_PARA_PUBLICACAO que NUNCA foram publicados antes
  let query = `
    SELECT * FROM video_pipeline_items
    WHERE pipeline_state = 'PRONTO_PARA_PUBLICACAO'
      AND source_url NOT IN (
        SELECT DISTINCT source_url 
        FROM video_pipeline_items 
        WHERE pipeline_state = 'PUBLICADO'
      )
  `;
  const params: any[] = [];

  if (channelId) {
    query += ` AND channel_id = ? `;
    params.push(channelId);
  }

  query += ` ORDER BY id ASC LIMIT ? `;
  params.push(limitCount);

  const items = db.prepare(query).all(...params) as any[];

  console.log(`Vídeos inéditos encontrados prontos para disparo: ${items.length}`);
  if (items.length === 0) {
    console.log('Nenhum vídeo inédito pendente para publicação no filtro selecionado.');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\n---------------------------------------------------`);
    console.log(`[Lançamento ${i + 1}/${items.length}] ID #${item.id} (${item.channel_id}) - ${item.title.slice(0, 70)}...`);

    // 1. Download do vídeo limpo para o Disco D: (caso ainda não esteja baixado)
    let filePath = item.file_path;
    if (!filePath) {
      console.log(`Baixando MP4 limpo em D:\\denis.com\\ego_viral_videos...`);
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
      const cleanTitle = (item.title || 'Cena Incrível').replace(/#\S+/g, '').replace(/@\S+/g, '').trim().slice(0, 90);
      caption = `🎬 ${cleanTitle}\n\n🍿 O melhor catálogo de filmes e séries por streaming! Conheça a EGO TV no link da bio 📲 @egotv00\n🔗 https://egotv.net/r/braghin\n\n#EgoTV #filmes #series #cinema #dicasdefilmes #filmeseseries #trechosdefilmes`;
    }

    // 3. Postagem no TikTok Studio
    console.log(`Disparando envio para @egotv00 no TikTok Studio (Público)...`);
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
            ?, ?, 'tt-filmes', 'TIKTOK',
            datetime('now'), ?, 'PUBLISHED_OFFICIAL_API', 1,
            1, ?, datetime('now'), 0
          )
        `).run(item.content_item_id, item.channel_id, caption, uploadRes.publishId || `tt_web_${Date.now()}`);
      }
    } else {
      failCount++;
      console.error(`[ERRO] Falha no upload do vídeo #${item.id}:`, uploadRes.message);
    }

    // Intervalo de segurança anti-spam entre uploads (15s)
    if (i < items.length - 1) {
      console.log(`Aguardando 15 segundos antes do próximo vídeo...`);
      await new Promise((r) => setTimeout(r, 15000));
    }
  }

  console.log(`\n=======================================================`);
  console.log(`DISPARO FINALIZADO: ${successCount} postados com sucesso, ${failCount} falhas.`);
  console.log(`=======================================================`);
}

// Se executado diretamente pelo terminal
const limitArg = process.argv[2] ? parseInt(process.argv[2], 10) : 30;
const channelArg = process.argv[3] || undefined;
launchVideosWithoutDuplicates({ limitCount: limitArg, channelId: channelArg });
