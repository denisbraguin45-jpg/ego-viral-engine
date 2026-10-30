import { scrapeViralEditsBySearch } from './services/liveSearchScraper.ts';
import { downloadCleanTikTokVideo } from './services/mediaDownloader.ts';
import { uploadToTikTokWeb } from './services/tiktokWebUploader.ts';
import { db } from './db.ts';

// Lista das buscas específicas com edits virais pesados
const HIGH_HYPE_TARGETS = [
  // 1. O MENTALISTA
  { query: 'the mentalist edit', name: 'O Mentalista', tag: 'thementalist', charTag: 'patrickjane' },
  // 2. BREAKING BAD
  { query: 'walter white edit', name: 'Breaking Bad', tag: 'breakingbad', charTag: 'heisenberg' },
  // 3. PRISON BREAK
  { query: 'michael scofield edit', name: 'Prison Break', tag: 'prisonbreak', charTag: 'michaelscofield' },
  // 4. LUCIFER
  { query: 'lucifer morningstar edit', name: 'Lucifer', tag: 'lucifer', charTag: 'lucifermorningstar' },
  // 5. SUPERNATURAL
  { query: 'dean winchester edit', name: 'Supernatural', tag: 'supernatural', charTag: 'deanwinchester' },
  // 6. PEAKY BLINDERS
  { query: 'thomas shelby edit', name: 'Peaky Blinders', tag: 'peakyblinders', charTag: 'thomasshelby' },
  // 7. INTERESTELAR (FILME)
  { query: 'interstellar edit', name: 'Interestelar', tag: 'interstellar', charTag: 'hanszimmer' },
  // 8. CLUBE DA LUTA (FILME)
  { query: 'fight club edit', name: 'Clube da Luta', tag: 'fightclub', charTag: 'tylerdurden' },
];

export async function runDirectViralPipeline(countPerTarget: number = 2) {
  console.log('=======================================================');
  console.log('LANÇADOR DE EDITS VIRAIS REAIS — TIKTOK STUDIO (@EGOTV00)');
  console.log('=======================================================');

  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  if (!account || !account.access_token) {
    console.error('Conta de upload não configurada.');
    return;
  }

  let totalPosted = 0;

  for (const target of HIGH_HYPE_TARGETS) {
    console.log(`\n>>> BUSCANDO CLIPS VIRAIS DE: ${target.name.toUpperCase()} <<<`);

    const candidates = await scrapeViralEditsBySearch(target.query, target.name, 'SERIES', countPerTarget);
    console.log(`Encontrados ${candidates.length} edits inéditos de ${target.name}.`);

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      console.log(`\n[Processando ${i + 1}/${candidates.length}] ${item.url}`);

      // 1. Download do vídeo MP4 limpo diretamente no Disco Local D:
      const dl = await downloadCleanTikTokVideo(item.url);
      if (!dl.success || !dl.filePath) {
        console.error(`Falha ao baixar vídeo ${item.url}:`, dl.error);
        continue;
      }

      // 2. Monta uma legenda limpa, profissional, específica do personagem e da série
      const caption = `🎬 Edit insano de ${target.name} 🔥

🍿 Assista a todas as temporadas completas em 4K na EGO TV!
📲 Acesse o catálogo no link da bio @egotv00
🔗 https://egotv.net/r/braghin

#${target.tag} #${target.tag}edit #${target.charTag} #series #filmes #EgoTV #edit`;

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
        totalPosted++;
        console.log(`[SUCESSO] Edit de ${target.name} postado! (ID: ${uploadRes.publishId})`);

        // Salva histórico no banco
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
          `Edit Viral de ${target.name}`,
          item.url,
          item.url.match(/\/video\/(\d+)/)?.[1] || `tt_${Date.now()}`,
          dl.filePath,
          caption,
          target.name,
          `#${target.tag}`,
          `POSTADO COM SUCESSO VIA BUSCA: ${target.query} (ID: ${uploadRes.publishId})`
        );
      } else {
        console.error(`Erro ao postar vídeo de ${target.name}:`, uploadRes.message);
      }

      console.log('Aguardando 15 segundos antes do próximo envio...');
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  console.log(`\n=======================================================`);
  console.log(`PIPELINE FINALIZADA: ${totalPosted} edits virais autênticos postados.`);
  console.log(`=======================================================`);
}

const perTarget = process.argv[2] ? parseInt(process.argv[2], 10) : 2;
runDirectViralPipeline(perTarget);
