import { downloadCleanTikTokVideo } from './services/mediaDownloader.ts';
import { uploadToTikTokWeb } from './services/tiktokWebUploader.ts';
import { db } from './db.ts';

// 9 Edits autênticos e virais recém-minerados
const BATCH_TARGETS = [
  // 1. SUPERNATURAL (Dean Winchester)
  {
    workName: 'Supernatural',
    charName: 'Dean Winchester',
    tag: 'supernatural',
    charTag: 'deanwinchester',
    url: 'https://www.tiktok.com/@caiiio160/video/7431708493163351301',
    hookTitle: 'Dean Winchester e o clássico Impala 67: A lenda dos caçadores 🚗💨',
  },
  {
    workName: 'Supernatural',
    charName: 'Dean Winchester',
    tag: 'supernatural',
    charTag: 'deanwinchester',
    url: 'https://www.tiktok.com/@acklesvs/video/7656105108412910870',
    hookTitle: 'A presença e frieza de Dean Winchester enfrentando o sobrenatural 💥👁️',
  },
  {
    workName: 'Supernatural',
    charName: 'Dean Winchester',
    tag: 'supernatural',
    charTag: 'deanwinchester',
    url: 'https://www.tiktok.com/@gavlzz/video/7529776080392113422',
    hookTitle: 'A lealdade e os momentos mais marcantes de Dean Winchester 🗡️🔥',
  },

  // 2. PEAKY BLINDERS (Thomas Shelby)
  {
    workName: 'Peaky Blinders',
    charName: 'Thomas Shelby',
    tag: 'peakyblinders',
    charTag: 'thomasshelby',
    url: 'https://www.tiktok.com/@ace7714/video/7699065241153309975',
    hookTitle: 'Thomas Shelby: “No fighting, no f*** fighting!” 🥃🚬',
  },
  {
    workName: 'Peaky Blinders',
    charName: 'Thomas Shelby',
    tag: 'peakyblinders',
    charTag: 'thomasshelby',
    url: 'https://www.tiktok.com/@virellonoir/video/7685520965291248918',
    hookTitle: 'A mente fria e calculista que dominou Birmingham 👑🐎',
  },
  {
    workName: 'Peaky Blinders',
    charName: 'Thomas Shelby',
    tag: 'peakyblinders',
    charTag: 'thomasshelby',
    url: 'https://www.tiktok.com/@zeus.shelbyyy/video/7680285095076449568',
    hookTitle: 'Thomas Shelby encarando qualquer ameaça sem pestanejar 💀💼',
  },

  // 3. LUCIFER (Lucifer Morningstar)
  {
    workName: 'Lucifer',
    charName: 'Lucifer Morningstar',
    tag: 'lucifer',
    charTag: 'lucifermorningstar',
    url: 'https://www.tiktok.com/@qevyren/video/7656180554559327511',
    hookTitle: '“Tell me, what is it that you truly desire?” 😈🍸',
  },
  {
    workName: 'Lucifer',
    charName: 'Lucifer Morningstar',
    tag: 'lucifer',
    charTag: 'lucifermorningstar',
    url: 'https://www.tiktok.com/@dante_aep/video/7676527082972728598',
    hookTitle: 'O charme inigualável e o poder real de Lucifer Morningstar 🍷🔥',
  },
  {
    workName: 'Lucifer',
    charName: 'Lucifer Morningstar',
    tag: 'lucifer',
    charTag: 'lucifermorningstar',
    url: 'https://www.tiktok.com/@crzwly/video/7531062100287048990',
    hookTitle: 'Quando o Diabo decide mostrar sua verdadeira face 😈👑',
  },
];

async function publishBatch() {
  console.log('=======================================================');
  console.log('DISPARANDO NOVO LOTE: SUPERNATURAL, PEAKY BLINDERS & LUCIFER');
  console.log('=======================================================');

  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  if (!account || !account.access_token) {
    console.error('Conta de upload não configurada.');
    return;
  }

  let count = 0;

  for (let i = 0; i < BATCH_TARGETS.length; i++) {
    const item = BATCH_TARGETS[i];
    console.log(`\n---------------------------------------------------`);
    console.log(`[${i + 1}/${BATCH_TARGETS.length}] Baixando edit de ${item.workName} (${item.charName}): ${item.url}`);

    // 1. Download limpo para o Disco Local D:
    const dl = await downloadCleanTikTokVideo(item.url);
    if (!dl.success || !dl.filePath) {
      console.error(`Falha no download de ${item.url}:`, dl.error);
      continue;
    }

    // 2. Legenda contextualizada com chamada específica para maratonar na Ego TV
    const caption = `🎬 ${item.hookTitle}

🍿 Assista a todas as temporadas de ${item.workName} completas e dubladas em alta definição na EGO TV!
📲 Acesse o catálogo no link da bio @egotv00
🔗 https://egotv.net/r/braghin

#${item.tag} #${item.tag}edit #${item.charTag} #series #cenasdeseries #filmeseseries #EgoTV`;

    console.log(`Legenda formatada:\n${caption}\n`);

    // 3. Postagem no TikTok Studio
    console.log(`Enviando para o TikTok Studio...`);
    const uploadRes = await uploadToTikTokWeb({
      filePath: dl.filePath,
      caption,
      sessionId: account.access_token,
      headless: true,
    });

    if (uploadRes.success) {
      count++;
      console.log(`[SUCESSO] Edit de ${item.workName} postado com sucesso! (ID: ${uploadRes.publishId})`);

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
        item.hookTitle,
        item.url,
        item.url.match(/\/video\/(\d+)/)?.[1] || `tt_${Date.now()}`,
        dl.filePath,
        caption,
        item.workName,
        `#${item.tag}`,
        `EDIT VIRAL REAL DE ${item.workName.toUpperCase()} POSTADO (ID: ${uploadRes.publishId})`
      );
    } else {
      console.error(`Erro ao postar edit de ${item.workName}:`, uploadRes.message);
    }

    if (i < BATCH_TARGETS.length - 1) {
      console.log('Aguardando 15 segundos antes do próximo envio...');
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  console.log(`\n=======================================================`);
  console.log(`LOTE CONCLUÍDO: ${count} edits virais de alto hype postados!`);
  console.log(`=======================================================`);
}

publishBatch();
