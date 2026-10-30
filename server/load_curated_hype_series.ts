import { db } from './db.ts';

// 1. Remove séries genéricas antigas que não condizem com a nova estratégia
const delResult = db.prepare(`
  DELETE FROM video_pipeline_items 
  WHERE channel_id = 'ego-series' 
    AND pipeline_state = 'PRONTO_PARA_PUBLICACAO'
`).run();
console.log(`[Limpeza] Removidos ${delResult.changes} vídeos genéricos antigos de séries.`);

// 2. Curadoria dos Maiores Hypes de Séries (IMDb Alto e Edits de Alta Retenção)
const curatedSeries = [
  // THE MENTALIST (Patrick Jane - Leitura corporal, deboche, frieza e genialidade)
  {
    title: 'Patrick Jane provando que ninguém esconde segredos dele 🧠☕ #OMentalista #PatrickJane #TheMentalist',
    source_url: 'https://www.tiktok.com/@umizooms_/video/7556774684184808717?q=%23thementalist',
    channel_id: 'ego-series',
    work_ref: 'The Mentalist (IMDb 8.2)',
    niche: 'Suspense Policial / Mentalismo',
  },
  {
    title: 'A calma assustadora do Patrick Jane quando encontra o culpado 🥶👤 #TheMentalist #PatrickJane #CenasDeSeries',
    source_url: 'https://www.tiktok.com/@speed.edirts/video/7335572447581818117?q=%23thementalist',
    channel_id: 'ego-series',
    work_ref: 'The Mentalist (IMDb 8.2)',
    niche: 'Suspense Policial / Mentalismo',
  },
  {
    title: 'Patrick Jane vs Red John: O momento que mudou tudo 😱🩸 #OMentalista #RedJohn #SeriesParaMaratonar',
    source_url: 'https://www.tiktok.com/@bloodqrr/video/7252107008189517062?q=%23thementalist',
    channel_id: 'ego-series',
    work_ref: 'The Mentalist (IMDb 8.2)',
    niche: 'Suspense Policial / Mentalismo',
  },
  
  // BREAKING BAD (Heisenberg, Walter White - O Rei do Narcotráfico)
  {
    title: '“Say My Name” — Walter White assumindo o controle total 🧪👑 #BreakingBad #Heisenberg #WalterWhite',
    source_url: 'https://www.tiktok.com/@cinenarradoficial/video/7616494994085432597?q=%23breakingbad',
    channel_id: 'ego-series',
    work_ref: 'Breaking Bad (IMDb 9.5)',
    niche: 'Drama / Crime',
  },
  {
    title: 'A risada no porão: O exato segundo em que Walter White morreu e nasceu o Heisenberg 💀🚪 #BreakingBad #CenasClassicas',
    source_url: 'https://www.tiktok.com/@spoilerzero0/video/7568539758763216149?q=%23breakingbad',
    channel_id: 'ego-series',
    work_ref: 'Breaking Bad (IMDb 9.5)',
    niche: 'Drama / Crime',
  },
  {
    title: 'Gus Fring ajustando a gravata no último instante: A cena mais fria da TV 👔💥 #BreakingBad #GusFring #SeriesHype',
    source_url: 'https://www.tiktok.com/@topmovies.nightmare/video/7232384293421583643?q=%23breakingbad',
    channel_id: 'ego-series',
    work_ref: 'Breaking Bad (IMDb 9.5)',
    niche: 'Drama / Crime',
  },

  // PRISON BREAK (Michael Scofield - Fuga calculada e QI genial)
  {
    title: 'Michael Scofield planejando a fuga perfeita passo a passo 🏢🧠 #PrisonBreak #MichaelScofield #SeriesDeAcao',
    source_url: 'https://www.tiktok.com/@recapjamesz/video/7666933887704059154?q=%23prisonbreak',
    channel_id: 'ego-series',
    work_ref: 'Prison Break (IMDb 8.3)',
    niche: 'Ação / Estratégia',
  },
  {
    title: 'Scofield encarando Mahone: Batalha de mentes mais tensa da história ⛓️👁️ #PrisonBreak #FoxRiver #SeriesNostalgia',
    source_url: 'https://www.tiktok.com/@edixx.serie/video/7540069032733494533?q=%23prisonbreak',
    channel_id: 'ego-series',
    work_ref: 'Prison Break (IMDb 8.3)',
    niche: 'Ação / Estratégia',
  },

  // LUCIFER & SUPERNATURAL (Carisma diabólico e lendas sobrenaturais)
  {
    title: '“Tell me, what is it that you truly desire?” 😈🍸 #Lucifer #LuciferMorningstar #TomEllis #Series',
    source_url: 'https://www.tiktok.com/@jcaspian216/video/7477566085454204167?q=%23lucifer',
    channel_id: 'ego-series',
    work_ref: 'Lucifer (IMDb 8.1)',
    niche: 'Fantasia Urbana / Charme',
  },
  {
    title: 'Dean Winchester e o lendário Impala 67: O caçador mais implacável 🚗💨 #Supernatural #DeanWinchester #Sobrenatural',
    source_url: 'https://www.tiktok.com/@matheuzxrs/video/7226087166697393413?q=%23supernatural',
    channel_id: 'ego-series',
    work_ref: 'Supernatural (IMDb 8.4)',
    niche: 'Sobrenatural / Ação',
  },
  {
    title: 'Thomas Shelby e a caminhada ao som de Red Right Hand 🥃🚬 #PeakyBlinders #ThomasShelby #SigmaEdit',
    source_url: 'https://www.tiktok.com/@ibra1502/video/7460724903000460550?q=%23peakyblinders',
    channel_id: 'ego-series',
    work_ref: 'Peaky Blinders (IMDb 8.8)',
    niche: 'Drama de Época / Máfia',
  }
];

let added = 0;
for (const item of curatedSeries) {
  // Prepara a legenda perfeita com CTA para Ego TV
  const caption = `🎬 ${item.title}

🍿 Assista a todas as temporadas completas em 4K e sem anúncios na EGO TV!
📲 Conheça no link da bio @egotv00
🔗 https://egotv.net/r/braghin

#EgoTV #series #filmeseseries #dicasdeseries #maratona #streaming`;

  // Insere se não existir
  const exists = db.prepare('SELECT id FROM video_pipeline_items WHERE source_url = ?').get(item.source_url);
  if (!exists) {
    const extId = item.source_url.match(/\/video\/(\d+)/)?.[1] || `tt_${Date.now()}_${added}`;
    db.prepare(`
      INSERT INTO video_pipeline_items (
        channel_id, title, source_url, source_platform, original_external_id, pipeline_state, caption_tiktok,
        work_reference, niche_label, acquisition_notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, 'TIKTOK', ?, 'PRONTO_PARA_PUBLICACAO', ?,
        ?, ?, 'CURADORIA DE ALTO HYPE: IMDb 8.0+ E EDITS LENDÁRIOS', datetime('now'), datetime('now')
      )
    `).run(
      item.channel_id,
      item.title,
      item.source_url,
      extId,
      caption,
      item.work_ref,
      item.niche
    );
    added++;
  }
}

console.log(`[Sucesso] ${added} novos itens de alta qualidade (O Mentalista, Breaking Bad, Prison Break, Lucifer, Supernatural, Peaky Blinders) adicionados à esteira de produção!`);
