import { downloadCleanTikTokVideo } from './services/mediaDownloader.ts';
import { uploadToTikTokWeb } from './services/tiktokWebUploader.ts';
import { db } from './db.ts';

// Os edits reais capturados das buscas no TikTok
const VERIFIED_SERIES_EDITS = [
  // 1. THE MENTALIST (Patrick Jane - Aura / Leitura Mental / Sarcasmo)
  {
    workName: 'O Mentalista',
    tag: 'thementalist',
    charTag: 'patrickjane',
    url: 'https://www.tiktok.com/@tekno_edit_/video/7656541594300222727',
    hookTitle: 'Patrick Jane provando que ninguém esconde a verdade dele 🧠☕',
  },
  {
    workName: 'O Mentalista',
    tag: 'thementalist',
    charTag: 'patrickjane',
    url: 'https://www.tiktok.com/@undead.aep/video/7659444977096854806',
    hookTitle: 'A calma assustadora do Patrick Jane ao desmascarar o culpado 🥶👤',
  },
  {
    workName: 'O Mentalista',
    tag: 'thementalist',
    charTag: 'patrickjane',
    url: 'https://www.tiktok.com/@povered_zach/video/7678231865479728405',
    hookTitle: 'O sorriso de quem já descobriu tudo antes mesmo do interrogatório começar 😏🔍',
  },

  // 2. BREAKING BAD (Heisenberg / Walter White - Poder / Frieza)
  {
    workName: 'Breaking Bad',
    tag: 'breakingbad',
    charTag: 'walterwhite',
    url: 'https://www.tiktok.com/@zyroedltzz/video/7667967601976298773',
    hookTitle: '“You got me” — A frieza lendária de Walter White 🧪👑',
  },
  {
    workName: 'Breaking Bad',
    tag: 'breakingbad',
    charTag: 'heisenberg',
    url: 'https://www.tiktok.com/@jxveed____/video/7621211523096038678',
    hookTitle: 'A transição de professor para o homem mais temido do narcotráfico 💀💥',
  },
  {
    workName: 'Breaking Bad',
    tag: 'breakingbad',
    charTag: 'heisenberg',
    url: 'https://www.tiktok.com/@klvz.ae/video/7631560651974069507',
    hookTitle: '“Say My Name” — O exato instante em que ele se tornou intocável 👑🚪',
  },

  // 3. PRISON BREAK (Michael Scofield - QI Genial / Fuga Calculada)
  {
    workName: 'Prison Break',
    tag: 'prisonbreak',
    charTag: 'michaelscofield',
    url: 'https://www.tiktok.com/@frans_aep/video/7568880636161690902',
    hookTitle: 'Michael Scofield: O homem que transformou o próprio corpo no mapa de fuga 🏢🧠',
  },
  {
    workName: 'Prison Break',
    tag: 'prisonbreak',
    charTag: 'michaelscofield',
    url: 'https://www.tiktok.com/@sz4.edi/video/7593839585382141215',
    hookTitle: 'Scofield calculando cada fração de segundo dentro de Fox River ⛓️⏱️',
  },
  {
    workName: 'Prison Break',
    tag: 'prisonbreak',
    charTag: 'michaelscofield',
    url: 'https://www.tiktok.com/@kyleb_edits/video/7595087004816166157',
    hookTitle: 'A mente brilhante de Michael Scofield desafiando o impossível 🏃‍♂️🚪',
  },
];

async function executePublishing() {
  console.log('=======================================================');
  console.log('PUBLICANDO EDITS VIRAIS REAIS COM LEGENDAS ESPECÍFICAS');
  console.log('=======================================================');

  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  if (!account || !account.access_token) {
    console.error('Conta de upload não configurada.');
    return;
  }

  let count = 0;

  for (let i = 0; i < VERIFIED_SERIES_EDITS.length; i++) {
    const item = VERIFIED_SERIES_EDITS[i];
    console.log(`\n---------------------------------------------------`);
    console.log(`[${i + 1}/${VERIFIED_SERIES_EDITS.length}] Baixando edit de ${item.workName}: ${item.url}`);

    // 1. Download MP4 limpo no Disco Local D:
    const dl = await downloadCleanTikTokVideo(item.url);
    if (!dl.success || !dl.filePath) {
      console.error(`Falha no download de ${item.url}:`, dl.error);
      continue;
    }

    // 2. Legenda contextualizada, limpa e natural com CTA para a EGO TV
    const caption = `🎬 ${item.hookTitle}

🍿 Assista a todas as temporadas de ${item.workName} completas e dubladas em alta definição na EGO TV!
📲 Acesse o catálogo no link da bio @egotv00
🔗 https://egotv.net/r/braghin

#${item.tag} #${item.tag}edit #${item.charTag} #series #cenasdeseries #filmeseseries #EgoTV`;

    console.log(`Legenda formatada:\n${caption}\n`);

    // 3. Postagem no TikTok Studio com visibilidade pública
    console.log(`Disparando envio para @egotv00 no TikTok Studio...`);
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

    // Pausa anti-spam
    if (i < VERIFIED_SERIES_EDITS.length - 1) {
      console.log('Aguardando 15 segundos antes do próximo envio...');
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  console.log(`\n=======================================================`);
  console.log(`FINALIZADO: ${count} edits virais autênticos postados no TikTok!`);
  console.log(`=======================================================`);
}

executePublishing();
