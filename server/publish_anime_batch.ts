import { downloadCleanTikTokVideo } from './services/mediaDownloader.ts';
import { uploadToTikTokWeb } from './services/tiktokWebUploader.ts';
import { db } from './db.ts';

// Tabela de copy personalizada para cada anime
const animeCopies: Record<string, { hook: string; tags: string }> = {
  jujutsu: {
    hook: "O Rei das Maldições Ryomen Sukuna mostrando a verdadeira hierarquia do poder 👑👁️",
    tags: "#jujutsukaisen #sukuna #jjk #anime #animes #animeedit #otaku #EgoTV"
  },
  solo: {
    hook: "Sung Jinwoo de caçador mais fraco ao mais temido de todo o mundo ⚔️⚡",
    tags: "#sololeveling #sungjinwoo #anime #animes #animeedit #otaku #EgoTV"
  },
  kakegurui: {
    hook: "A loucura e a adrenalina das apostas de alto risco em Hyakkaou 🎲🃏",
    tags: "#kakegurui #yumekojabami #anime #animes #animeedit #otaku #EgoTV"
  },
  deathnote: {
    hook: "A maior batalha intelectual de todos os tempos: Light Yagami vs L 🍎📓",
    tags: "#deathnote #lightyagami #anime #animes #animeedit #otaku #EgoTV"
  },
  naruto: {
    hook: "A frieza e os mistérios mais profundos dos membros da Akatsuki 🌧️🍥",
    tags: "#naruto #narutoshippuden #anime #animes #animeedit #otaku #EgoTV"
  },
  bokunohero: {
    hook: "Heróis vs Vilões: Quando a lealdade e os sentimentos colidem em batalha 💥🦸",
    tags: "#bokunoheroacademia #myheroacademia #anime #animes #animeedit #otaku #EgoTV"
  },
  demonslayer: {
    hook: "A precisão implacável e a respiração dos Caçadores de Demônios ⚔️🌊",
    tags: "#demonslayer #kimetsunoyaiba #tanjiro #anime #animes #animeedit #otaku #EgoTV"
  },
  default: {
    hook: "As melhores cenas e momentos mais marcantes do mundo dos animes 🔥🎬",
    tags: "#anime #animes #animeedit #otakubrasil #otaku #animesbrasil #EgoTV"
  }
};

function getAnimeDetails(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes('jujutsu') || lower.includes('sukuna') || lower.includes('jjk')) return animeCopies.jujutsu;
  if (lower.includes('solo') || lower.includes('jinwoo')) return animeCopies.solo;
  if (lower.includes('kakegurui')) return animeCopies.kakegurui;
  if (lower.includes('deathnote') || lower.includes('death note') || lower.includes('ryuk')) return animeCopies.deathnote;
  if (lower.includes('naruto') || lower.includes('itachi') || lower.includes('tobi') || lower.includes('deidara')) return animeCopies.naruto;
  if (lower.includes('boku no hero') || lower.includes('uraraka') || lower.includes('toga')) return animeCopies.bokunohero;
  if (lower.includes('demon slayer') || lower.includes('kimetsu')) return animeCopies.demonslayer;
  return animeCopies.default;
}

async function publishAnimeBatch() {
  console.log('=======================================================');
  console.log('DISPARANDO LOTE DE ANIMES APROVADOS NO TIKTOK @EGOTV00');
  console.log('=======================================================');

  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  if (!account || !account.access_token) {
    console.error('Conta não configurada.');
    return;
  }

  // Primeiro atualiza o 379 que já foi postado com sucesso
  db.prepare(`
    UPDATE video_pipeline_items 
    SET pipeline_state = 'PUBLICADO', updated_at = CURRENT_TIMESTAMP
    WHERE id = 379
  `).run();

  const items = db.prepare(`
    SELECT * FROM video_pipeline_items
    WHERE channel_id = 'ego-anime' AND pipeline_state = 'PRONTO_PARA_PUBLICACAO'
    ORDER BY id ASC
  `).all() as any[];

  console.log(`Encontrados ${items.length} animes para publicação.`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\n---------------------------------------------------`);
    console.log(`[${i + 1}/${items.length}] Preparando: ${item.title}`);

    // 1. Download
    let filePath = item.file_path;
    if (!filePath || !filePath.includes('.')) {
      console.log('Baixando MP4 limpo...');
      const dl = await downloadCleanTikTokVideo(item.source_url);
      if (!dl.success || !dl.filePath) {
        console.error(`Falha no download #${item.id}:`, dl.error);
        continue;
      }
      filePath = dl.filePath;
    }

    // 2. Legenda e Tags
    const details = getAnimeDetails(item.title);
    const caption = `🎬 ${details.hook}\n\n🍿 Assista a animes completos, dublados e em alta qualidade na EGO TV!\n📲 Acesse o catálogo no link da bio @egotv00\n🔗 https://egotv.net/r/braghin\n\n${details.tags}`;

    // 3. Postagem
    console.log('Enviando para o TikTok Studio...');
    const res = await uploadToTikTokWeb({
      filePath,
      caption,
      sessionId: account.access_token,
      headless: true
    });

    if (res.success) {
      console.log(`[SUCESSO] Anime #${item.id} postado! (ID: ${res.publishId})`);
      db.prepare(`
        UPDATE video_pipeline_items 
        SET pipeline_state = 'PUBLICADO', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(item.id);
    } else {
      console.error(`[FALHA] Anime #${item.id}:`, res.message);
    }

    if (i < items.length - 1) {
      console.log('Aguardando 15 segundos antes do próximo envio...');
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  console.log('\n=======================================================');
  console.log('LOTE DE ANIMES CONCLUÍDO!');
  console.log('=======================================================');
}

publishAnimeBatch().catch(console.error);
