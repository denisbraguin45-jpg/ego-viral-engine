import { downloadCleanTikTokVideo } from './services/mediaDownloader.ts';
import { uploadToTikTokWeb } from './services/tiktokWebUploader.ts';
import { db } from './db.ts';

// 9 Edits autênticos de filmes cult/hype com notas máximas no IMDb
const CULT_MOVIE_EDITS = [
  // 1. CLUBE DA LUTA (Tyler Durden)
  {
    movieName: 'Clube da Luta',
    charName: 'Tyler Durden',
    tag: 'fightclub',
    charTag: 'tylerdurden',
    url: 'https://www.tiktok.com/@october15th07/video/7679578848513527061',
    hookTitle: 'Tyler Durden desconstruindo a sociedade moderna 💥🧠',
  },
  {
    movieName: 'Clube da Luta',
    charName: 'Tyler Durden',
    tag: 'fightclub',
    charTag: 'tylerdurden',
    url: 'https://www.tiktok.com/@burningreid/video/7660617027186429205',
    hookTitle: '“As coisas que você possui acabam possuindo você.” 🧼📦',
  },
  {
    movieName: 'Clube da Luta',
    charName: 'Tyler Durden',
    tag: 'fightclub',
    charTag: 'tylerdurden',
    url: 'https://www.tiktok.com/@momoeditx/video/7506589978810649878',
    hookTitle: 'A energia caótica e o carisma de Brad Pitt em Clube da Luta 🔥👊',
  },

  // 2. O CAVALEIRO DAS TREVAS (Heath Ledger - Joker)
  {
    movieName: 'O Cavaleiro das Trevas',
    charName: 'Coringa',
    tag: 'darkknight',
    charTag: 'heathledger',
    url: 'https://www.tiktok.com/@6r2l/video/7571542485260897557',
    hookTitle: '“Why so serious?” — A atuação lendária de Heath Ledger 🃏🤡',
  },
  {
    movieName: 'O Cavaleiro das Trevas',
    charName: 'Coringa',
    tag: 'darkknight',
    charTag: 'jokeredit',
    url: 'https://www.tiktok.com/@lazarosaso/video/7609469560156179742',
    hookTitle: 'A mente imprevisível do Coringa que colocou Gotham de joelhos 💥💣',
  },
  {
    movieName: 'O Cavaleiro das Trevas',
    charName: 'Coringa',
    tag: 'darkknight',
    charTag: 'heathledgerjoker',
    url: 'https://www.tiktok.com/@rk.hyde/video/7673743902368697613',
    hookTitle: 'O vilão mais icônico e memorável de toda a história do cinema 🎬👑',
  },

  // 3. O PODEROSO CHEFÃO (The Godfather - Vito & Michael Corleone)
  {
    movieName: 'O Poderoso Chefão',
    charName: 'Don Corleone',
    tag: 'godfather',
    charTag: 'michaelcorleone',
    url: 'https://www.tiktok.com/@naleeedits/video/7681422022261378327',
    hookTitle: '“Vou fazer uma proposta que ele não poderá recusar.” 🍷🚬',
  },
  {
    movieName: 'O Poderoso Chefão',
    charName: 'Michael Corleone',
    tag: 'godfather',
    charTag: 'corleone',
    url: 'https://www.tiktok.com/@akamorph2/video/7675418645828209934',
    hookTitle: 'A frieza implacável e o respeito eterno da família Corleone 💼🩸',
  },

  // 4. SCARFACE (Tony Montana)
  {
    movieName: 'Scarface',
    charName: 'Tony Montana',
    tag: 'scarface',
    charTag: 'tonymontana',
    url: 'https://www.tiktok.com/@musafx_/video/7674713030596381985',
    hookTitle: 'Tony Montana: “The world is yours.” 🌎💰',
  },
];

async function publishMovieBatch() {
  console.log('=======================================================');
  console.log('PUBLICANDO EDITS VIRAIS DE FILMES CULT NO TIKTOK STUDIO');
  console.log('=======================================================');

  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  if (!account || !account.access_token) {
    console.error('Conta de upload não configurada.');
    return;
  }

  let count = 0;

  for (let i = 0; i < CULT_MOVIE_EDITS.length; i++) {
    const item = CULT_MOVIE_EDITS[i];
    console.log(`\n---------------------------------------------------`);
    console.log(`[${i + 1}/${CULT_MOVIE_EDITS.length}] Baixando edit de ${item.movieName} (${item.charName}): ${item.url}`);

    // 1. Download do vídeo MP4 limpo diretamente no Disco Local D:
    const dl = await downloadCleanTikTokVideo(item.url);
    if (!dl.success || !dl.filePath) {
      console.error(`Falha no download de ${item.url}:`, dl.error);
      continue;
    }

    // 2. Legenda contextualizada com chamada específica para assistir ao filme na EGO TV
    const caption = `🎬 ${item.hookTitle}

🍿 Assista ao filme ${item.movieName} completo em 4K e sem anúncios na EGO TV!
📲 Acesse o catálogo no link da bio @egotv00
🔗 https://egotv.net/r/braghin

#${item.tag} #${item.tag}edit #${item.charTag} #filmes #cinema #dicasdefilmes #filmeseseries #EgoTV`;

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
      console.log(`[SUCESSO] Edit de ${item.movieName} postado com sucesso! (ID: ${uploadRes.publishId})`);

      db.prepare(`
        INSERT INTO video_pipeline_items (
          channel_id, title, source_url, source_platform, original_external_id,
          pipeline_state, file_path, caption_tiktok, work_reference, niche_label,
          acquisition_notes, created_at, updated_at
        ) VALUES (
          'ego-filmes', ?, ?, 'TIKTOK', ?,
          'PUBLICADO', ?, ?, ?, ?,
          ?, datetime('now'), datetime('now')
        )
      `).run(
        item.hookTitle,
        item.url,
        item.url.match(/\/video\/(\d+)/)?.[1] || `tt_${Date.now()}`,
        dl.filePath,
        caption,
        item.movieName,
        `#${item.tag}`,
        `EDIT VIRAL REAL DE ${item.movieName.toUpperCase()} POSTADO (ID: ${uploadRes.publishId})`
      );
    } else {
      console.error(`Erro ao postar edit de ${item.movieName}:`, uploadRes.message);
    }

    if (i < CULT_MOVIE_EDITS.length - 1) {
      console.log('Aguardando 15 segundos antes do próximo envio...');
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  console.log(`\n=======================================================`);
  console.log(`LOTE CONCLUÍDO: ${count} edits de filmes cult postados com sucesso!`);
  console.log(`=======================================================`);
}

publishMovieBatch();
