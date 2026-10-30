import assert from 'node:assert';
import { app } from '../index.ts';
import { db } from '../db.ts';
import { buildMultiFrameVideoBuffer } from '../services/videoIntelligenceEngine.ts';

function cleanupSyntheticTestRecords() {
  const testPattern = `
    source_url LIKE 'https://www.tiktok.com/@cine.%'
    OR source_url LIKE 'https://www.tiktok.com/@cortes.marca.fixa_%'
    OR source_url LIKE 'https://www.tiktok.com/@otaku.intermittent_%'
    OR source_url LIKE 'https://www.tiktok.com/@series.editorial_%'
    OR source_url LIKE 'https://www.tiktok.com/@sakuga.multiscene_%'
    OR source_url LIKE 'https://www.tiktok.com/@suspense.clips_%'
    OR source_url LIKE 'https://www.tiktok.com/@seq.master_%'
    OR source_url LIKE 'https://www.tiktok.com/@creator.alpha_%'
    OR source_url LIKE 'https://www.tiktok.com/@creator.beta_%'
    OR source_url LIKE 'https://www.tiktok.com/@cinema.widescreen_%'
    OR source_url LIKE 'https://www.tiktok.com/@lowres.%'
  `;
  db.prepare(`
    DELETE FROM video_continuation_candidates
    WHERE parent_pipeline_id IN (SELECT id FROM video_pipeline_items WHERE ${testPattern})
       OR candidate_pipeline_id IN (SELECT id FROM video_pipeline_items WHERE ${testPattern})
  `).run();
  db.prepare(`
    DELETE FROM video_intelligence_analyses
    WHERE pipeline_id IN (SELECT id FROM video_pipeline_items WHERE ${testPattern})
  `).run();
  db.prepare(`DELETE FROM video_pipeline_items WHERE ${testPattern}`).run();
  db.prepare(`DELETE FROM radar_items WHERE ${testPattern}`).run();
}

async function createAndApproveCandidate(
  baseUrl: string,
  params: {
    channelId: 'ego-filmes' | 'ego-anime' | 'ego-series';
    sourceUrl: string;
    title: string;
    workReference: string;
  }
): Promise<number> {
  const radarRes = await fetch(`${baseUrl}/api/radar/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel_id: params.channelId,
      source_url: params.sourceUrl,
      platform: 'TIKTOK',
      title: params.title,
      franchise_or_work: params.workReference,
      views_observed: 480000,
      likes_observed: 64000,
      comments_observed: 2100,
    }),
  });
  assert.strictEqual(radarRes.status, 200, `Cadastro no radar deve retornar HTTP 200 (${params.title})`);
  const radarData = (await radarRes.json()) as any;

  const approveRes = await fetch(`${baseUrl}/api/radar/items/${radarData.id}/approve-to-pipeline`, {
    method: 'POST',
  });
  assert.strictEqual(approveRes.status, 200, `Aprovação para o pipeline deve retornar HTTP 200`);
  const approveData = (await approveRes.json()) as any;
  return Number(approveData.pipelineId);
}

async function uploadMultiFrameVideoToPipeline(
  baseUrl: string,
  pipelineId: number,
  fileName: string,
  buffer: Buffer
): Promise<any> {
  const form = new FormData();
  form.append('videoFile', new Blob([new Uint8Array(buffer)], { type: 'video/mp4' }), fileName);
  form.append('acquisition_method', 'OPTION_C_UPLOAD');
  form.append('duration_seconds', '36');

  const res = await fetch(`${baseUrl}/api/pipeline/${pipelineId}/upload-file`, {
    method: 'POST',
    body: form,
  });
  assert.strictEqual(res.status, 200, `Upload do arquivo multi-quadro ${fileName} deve retornar HTTP 200`);
  const data = (await res.json()) as any;
  return data.intelligenceAnalysis;
}

export async function runVideoIntelligenceAcceptanceTests(existingBaseUrl?: string) {
  let server: any = null;
  let baseUrl = existingBaseUrl || '';

  if (!baseUrl) {
    server = app.listen(0);
    const address = server.address() as { port: number };
    baseUrl = `http://localhost:${address.port}`;
  }

  console.log(`\n================================================================`);
  console.log(`🧠 VIDEO INTELLIGENCE & WATERMARK DETECTOR — 10 CENÁRIOS DE ACEITAÇÃO`);
  console.log(`================================================================\n`);

  const evaluationLog: Array<{
    scenario: number;
    name: string;
    expected: string;
    observed: string;
    passed: boolean;
    falsePositive: boolean;
    falseNegative: boolean;
  }> = [];

  try {
    const ts = Date.now();
    // Limpar candidatos anteriores de testes de aceitação para evitar colisão de SHA-256
    cleanupSyntheticTestRecords();

    // ------------------------------------------------------------------------
    // CENÁRIO 1: Vídeo sem marca d'água aparente (Perfil VÍDEO A -> Avança p/ Preparação)
    // ------------------------------------------------------------------------
    console.log(`[CENÁRIO 1] Testando vídeo sem marca d'água aparente...`);
    const p1 = await createAndApproveCandidate(baseUrl, {
      channelId: 'ego-filmes',
      sourceUrl: `https://www.tiktok.com/@cine.clean_${ts}/video/7500001${ts}`,
      title: 'A manobra impossível na doca espacial em Interestelar (Cena Completa)',
      workReference: 'Interestelar (Interstellar)',
    });

    const buf1 = buildMultiFrameVideoBuffer({
      width: 1080,
      height: 1920,
      durationSeconds: 36,
      fps: 30,
      hasBlackBars: false,
      audioTrackPresent: true,
      audioMeanDb: -12,
      abruptCutsCount: 1,
      repeatedSegmentsCount: 0,
      subtitlesLegibility: 'NO_SUBTITLES',
      endsInSuspense: false,
      sceneInterrupted: false,
      declaredCategory: 'FILME',
      declaredSubcategory: 'Ficção Científica & Drama Espacial',
      declaredWorkHypothesis: 'Interestelar (Interstellar)',
      workEvidenceLevel: 'STRONG_CONFIRMED',
      frames: [
        {
          frameIndex: 1,
          timestampSec: 0,
          sceneId: 'docking_start',
          sceneDescription: 'Nave Endurance girando em órbita após explosão na escotilha',
          dominantAction: 'Aproximação do módulo Ranger comandado por Cooper',
          charactersInFrame: ['Joseph Cooper', 'Dra. Amelia Brand'],
          ocrTexts: [],
          dialogueSnippet: 'CASE, prepare para igualar a rotação da Endurance.',
          sharpnessScore: 90,
          brightnessScore: 68,
          cornerAndRegionOverlays: [],
        },
        {
          frameIndex: 2,
          timestampSec: 18,
          sceneId: 'docking_climax',
          sceneDescription: 'Alinhamento do eixo central em alta rotação',
          dominantAction: 'Acoplamento bem-sucedido e estabilização dos propulsores',
          charactersInFrame: ['Joseph Cooper', 'Dra. Amelia Brand'],
          ocrTexts: [],
          dialogueSnippet: 'Não é possível. — Não, é necessário.',
          sharpnessScore: 92,
          brightnessScore: 70,
          cornerAndRegionOverlays: [],
        },
      ],
    });

    const a1 = await uploadMultiFrameVideoToPipeline(baseUrl, p1, `cenario1_clean_${ts}.mp4`, buf1);
    assert.strictEqual(a1.watermark_detected, 0, 'Cenário 1: Não deve detectar marca d’água');
    assert.strictEqual(a1.watermark_classification, 'NONE', 'Cenário 1: Classificação deve ser NONE');
    assert.strictEqual(a1.recommended_decision, 'AVANCAR_PARA_PREPARACAO', 'Cenário 1: Deve avançar para preparação (VÍDEO A)');
    assert.strictEqual(a1.decision_archetype, 'VIDEO_A_APROVADO');
    evaluationLog.push({
      scenario: 1,
      name: 'Vídeo sem marca d’água aparente',
      expected: 'watermark=NONE, decision=AVANCAR_PARA_PREPARACAO (VÍDEO A)',
      observed: `watermark=${a1.watermark_classification}, decision=${a1.recommended_decision} (${a1.decision_archetype})`,
      passed: true,
      falsePositive: false,
      falseNegative: false,
    });
    console.log(`  ✅ Cenário 1 aprovado: Sem marca d'água (${a1.watermark_confidence}% conf.) → ${a1.recommended_decision}.`);

    // ------------------------------------------------------------------------
    // CENÁRIO 2: Vídeo com marca d'água fixa (@handle do criador no canto superior direito)
    // ------------------------------------------------------------------------
    console.log(`[CENÁRIO 2] Testando vídeo com marca d'água fixa de criador...`);
    const p2 = await createAndApproveCandidate(baseUrl, {
      channelId: 'ego-filmes',
      sourceUrl: `https://www.tiktok.com/@cortes.marca.fixa_${ts}/video/7500002${ts}`,
      title: 'O interrogatório do Coringa em Gotham',
      workReference: 'Batman: O Cavaleiro das Trevas',
    });

    const buf2 = buildMultiFrameVideoBuffer({
      width: 1080,
      height: 1920,
      durationSeconds: 32,
      fps: 30,
      hasBlackBars: false,
      audioTrackPresent: true,
      audioMeanDb: -14,
      abruptCutsCount: 1,
      repeatedSegmentsCount: 0,
      subtitlesLegibility: 'LEGIBLE',
      endsInSuspense: false,
      sceneInterrupted: false,
      declaredCategory: 'FILME',
      declaredSubcategory: 'Ação, Crime & Suspense',
      declaredWorkHypothesis: 'Batman: O Cavaleiro das Trevas',
      workEvidenceLevel: 'STRONG_CONFIRMED',
      frames: [
        {
          frameIndex: 1,
          timestampSec: 0,
          sceneId: 'interrogation_1',
          sceneDescription: 'Luzes da sala de interrogatório acendem sobre o Coringa',
          dominantAction: 'Batman surge atrás do Coringa',
          charactersInFrame: ['Bruce Wayne / Batman', 'Coringa (Joker)'],
          ocrTexts: ['@cortes_cinema_vip'],
          sharpnessScore: 86,
          brightnessScore: 55,
          cornerAndRegionOverlays: [
            {
              region: 'TOP_RIGHT',
              overlayKind: 'CREATOR_HANDLE',
              text: '@cortes_cinema_vip',
              opacity: 0.85,
              contrast: 80,
            },
          ],
        },
        {
          frameIndex: 2,
          timestampSec: 16,
          sceneId: 'interrogation_1',
          sceneDescription: 'Diálogo tenso na mesa de interrogatório',
          dominantAction: 'Coringa ri enquanto explica seu plano',
          charactersInFrame: ['Bruce Wayne / Batman', 'Coringa (Joker)'],
          ocrTexts: ['@cortes_cinema_vip'],
          sharpnessScore: 88,
          brightnessScore: 58,
          cornerAndRegionOverlays: [
            {
              region: 'TOP_RIGHT',
              overlayKind: 'CREATOR_HANDLE',
              text: '@cortes_cinema_vip',
              opacity: 0.85,
              contrast: 80,
            },
          ],
        },
      ],
    });

    const a2 = await uploadMultiFrameVideoToPipeline(baseUrl, p2, `cenario2_fixed_wm_${ts}.mp4`, buf2);
    assert.strictEqual(a2.watermark_detected, 1, 'Cenário 2: Deve detectar marca d’água fixa');
    assert.strictEqual(a2.watermark_classification, 'CREATOR_IDENTIFIER', 'Cenário 2: Deve classificar como CREATOR_IDENTIFIER');
    assert.strictEqual(a2.watermark_temporal_pattern, 'FIXED_PERSISTENT', 'Cenário 2: Padrão temporal deve ser FIXED_PERSISTENT');
    assert.ok(a2.watermark_locations.includes('TOP_RIGHT'), 'Cenário 2: Deve localizar no canto TOP_RIGHT');
    assert.strictEqual(a2.recommended_decision, 'MANTER_BLOQUEADO_PENDENCIAS', 'Cenário 2: Deve manter bloqueado (VÍDEO B)');
    evaluationLog.push({
      scenario: 2,
      name: 'Vídeo com marca d’água fixa',
      expected: 'CREATOR_IDENTIFIER em TOP_RIGHT (FIXED_PERSISTENT) -> MANTER_BLOQUEADO_PENDENCIAS',
      observed: `${a2.watermark_classification} em ${a2.watermark_locations.join(',')} (${a2.watermark_temporal_pattern}) -> ${a2.recommended_decision}`,
      passed: true,
      falsePositive: false,
      falseNegative: false,
    });
    console.log(`  ✅ Cenário 2 aprovado: Marca fixa detectada (${a2.watermark_detected_text} em TOP_RIGHT) → ${a2.recommended_decision}.`);

    // ------------------------------------------------------------------------
    // CENÁRIO 3: Vídeo com marca d'água intermitente (aparece apenas em parte dos quadros)
    // ------------------------------------------------------------------------
    console.log(`[CENÁRIO 3] Testando vídeo com marca d'água intermitente...`);
    const p3 = await createAndApproveCandidate(baseUrl, {
      channelId: 'ego-anime',
      sourceUrl: `https://www.tiktok.com/@otaku.intermittent_${ts}/video/7500003${ts}`,
      title: 'Expansão de Domínio de Satoru Gojo em Shibuya',
      workReference: 'Jujutsu Kaisen',
    });

    const buf3 = buildMultiFrameVideoBuffer({
      width: 1080,
      height: 1920,
      durationSeconds: 30,
      fps: 30,
      hasBlackBars: false,
      audioTrackPresent: true,
      audioMeanDb: -13,
      abruptCutsCount: 1,
      repeatedSegmentsCount: 0,
      subtitlesLegibility: 'NO_SUBTITLES',
      endsInSuspense: false,
      sceneInterrupted: false,
      declaredCategory: 'ANIME',
      declaredSubcategory: 'Shounen Sobrenatural & Batalha',
      declaredWorkHypothesis: 'Jujutsu Kaisen',
      workEvidenceLevel: 'STRONG_CONFIRMED',
      frames: [
        {
          frameIndex: 1,
          timestampSec: 0,
          sceneId: 'shibuya_1',
          sceneDescription: 'Satoru Gojo retira a venda na estação de Shibuya',
          dominantAction: 'Close-up nos Seis Olhos de Gojo sem marca visível no primeiro quadro',
          charactersInFrame: ['Satoru Gojo'],
          ocrTexts: [],
          sharpnessScore: 91,
          brightnessScore: 64,
          cornerAndRegionOverlays: [], // Quadro 1 limpo!
        },
        {
          frameIndex: 2,
          timestampSec: 10,
          sceneId: 'shibuya_1',
          sceneDescription: 'Ativação de 0.2 segundos do Vazio Infinito',
          dominantAction: 'Marca d’água da plataforma surge no canto inferior direito no meio do vídeo',
          charactersInFrame: ['Satoru Gojo'],
          ocrTexts: ['TikTok @anime_shibuya'],
          sharpnessScore: 89,
          brightnessScore: 66,
          cornerAndRegionOverlays: [
            {
              region: 'BOTTOM_RIGHT',
              overlayKind: 'PLATFORM_LOGO',
              text: 'TikTok @anime_shibuya',
              opacity: 0.75,
              contrast: 78,
            },
          ],
        },
        {
          frameIndex: 3,
          timestampSec: 22,
          sceneId: 'shibuya_1',
          sceneDescription: 'Efeito pós-expansão de domínio',
          dominantAction: 'Cena final sem overlay',
          charactersInFrame: ['Satoru Gojo'],
          ocrTexts: [],
          sharpnessScore: 90,
          brightnessScore: 62,
          cornerAndRegionOverlays: [],
        },
      ],
    });

    const a3 = await uploadMultiFrameVideoToPipeline(baseUrl, p3, `cenario3_intermittent_${ts}.mp4`, buf3);
    assert.strictEqual(a3.watermark_detected, 1, 'Cenário 3: Deve detectar marca d’água intermitente mesmo com o 1º quadro limpo');
    assert.strictEqual(a3.watermark_classification, 'PLATFORM_WATERMARK');
    assert.strictEqual(a3.watermark_temporal_pattern, 'INTERMITTENT');
    evaluationLog.push({
      scenario: 3,
      name: 'Vídeo com marca d’água intermitente',
      expected: 'PLATFORM_WATERMARK (INTERMITTENT em BOTTOM_RIGHT)',
      observed: `${a3.watermark_classification} (${a3.watermark_temporal_pattern} em ${a3.watermark_locations.join(',')})`,
      passed: true,
      falsePositive: false,
      falseNegative: false,
    });
    console.log(`  ✅ Cenário 3 aprovado: Marca intermitente detectada no quadro intermediário (${a3.watermark_temporal_pattern}).`);

    // ------------------------------------------------------------------------
    // CENÁRIO 4: Vídeo com texto editorial / legenda (NÃO deve classificar como marca d'água!)
    // ------------------------------------------------------------------------
    console.log(`[CENÁRIO 4] Testando vídeo com texto editorial e legenda (prevenção de falso positivo)...`);
    const p4 = await createAndApproveCandidate(baseUrl, {
      channelId: 'ego-series',
      sourceUrl: `https://www.tiktok.com/@series.editorial_${ts}/video/7500004${ts}`,
      title: 'A frase mais icônica de Walter White em Breaking Bad',
      workReference: 'Breaking Bad',
    });

    const buf4 = buildMultiFrameVideoBuffer({
      width: 1080,
      height: 1920,
      durationSeconds: 28,
      fps: 30,
      hasBlackBars: false,
      audioTrackPresent: true,
      audioMeanDb: -11,
      abruptCutsCount: 1,
      repeatedSegmentsCount: 0,
      subtitlesLegibility: 'LEGIBLE',
      endsInSuspense: false,
      sceneInterrupted: false,
      declaredCategory: 'SERIE',
      declaredSubcategory: 'Drama Criminal & Thriller',
      declaredWorkHypothesis: 'Breaking Bad',
      workEvidenceLevel: 'STRONG_CONFIRMED',
      frames: [
        {
          frameIndex: 1,
          timestampSec: 0,
          sceneId: 'iam_the_danger',
          sceneDescription: 'Walter White conversa com Skyler na sala',
          dominantAction: 'Headline editorial no centro superior e legenda sincronizada na base',
          charactersInFrame: ['Walter White (Heisenberg)'],
          ocrTexts: ['O MOMENTO EM QUE WALTER VIROU HEISENBERG', 'Eu não estou em perigo, Skyler. Eu sou o perigo.'],
          dialogueSnippet: 'Eu sou aquele que bate na porta.',
          sharpnessScore: 89,
          brightnessScore: 60,
          cornerAndRegionOverlays: [
            {
              region: 'CENTER_OVERLAY',
              overlayKind: 'EDITORIAL_CAPTION',
              text: 'O MOMENTO EM QUE WALTER VIROU HEISENBERG',
              opacity: 1.0,
              contrast: 95,
            },
            {
              region: 'BOTTOM_SUBTITLE_AREA',
              overlayKind: 'SUBTITLE_LINE',
              text: 'Eu não estou em perigo, Skyler. Eu sou o perigo.',
              opacity: 1.0,
              contrast: 92,
            },
          ],
        },
        {
          frameIndex: 2,
          timestampSec: 15,
          sceneId: 'iam_the_danger',
          sceneDescription: 'Reação de Skyler diante de Walter White',
          dominantAction: 'Conclusão do monólogo com legenda',
          charactersInFrame: ['Walter White (Heisenberg)'],
          ocrTexts: ['Eu sou aquele que bate na porta!'],
          sharpnessScore: 90,
          brightnessScore: 61,
          cornerAndRegionOverlays: [
            {
              region: 'BOTTOM_SUBTITLE_AREA',
              overlayKind: 'SUBTITLE_LINE',
              text: 'Eu sou aquele que bate na porta!',
              opacity: 1.0,
              contrast: 92,
            },
          ],
        },
      ],
    });

    const a4 = await uploadMultiFrameVideoToPipeline(baseUrl, p4, `cenario4_editorial_${ts}.mp4`, buf4);
    assert.strictEqual(a4.watermark_detected, 0, 'Cenário 4: Texto editorial/legenda NÃO deve acionar flag de marca d’água de terceiro');
    assert.ok(
      ['EDITORIAL_TEXT', 'SUBTITLE'].includes(a4.watermark_classification),
      `Cenário 4: Deve distinguir como EDITORIAL_TEXT ou SUBTITLE (recebido: ${a4.watermark_classification})`
    );
    assert.strictEqual(a4.recommended_decision, 'AVANCAR_PARA_PREPARACAO', 'Cenário 4: Deve avançar para preparação');
    evaluationLog.push({
      scenario: 4,
      name: 'Vídeo com texto editorial / legenda',
      expected: 'watermark_detected=0, classification=EDITORIAL_TEXT/SUBTITLE, decision=AVANCAR_PARA_PREPARACAO',
      observed: `watermark_detected=${a4.watermark_detected}, classification=${a4.watermark_classification}, decision=${a4.recommended_decision}`,
      passed: true,
      falsePositive: false,
      falseNegative: false,
    });
    console.log(`  ✅ Cenário 4 aprovado: Distinguido corretamente como ${a4.watermark_classification} (0 falso positivo de marca d'água).`);

    // ------------------------------------------------------------------------
    // CENÁRIO 5: Vídeo com duas ou mais cenas (Mudanças de cena e Evento Inicial -> Evento Final)
    // ------------------------------------------------------------------------
    console.log(`[CENÁRIO 5] Testando vídeo com múltiplas cenas e progressão narrativa...`);
    const p5 = await createAndApproveCandidate(baseUrl, {
      channelId: 'ego-anime',
      sourceUrl: `https://www.tiktok.com/@sakuga.multiscene_${ts}/video/7500005${ts}`,
      title: 'Tanjiro vs Rui: Da respiração da água até a Hinokami Kagura',
      workReference: 'Demon Slayer (Kimetsu no Yaiba)',
    });

    const buf5 = buildMultiFrameVideoBuffer({
      width: 1080,
      height: 1920,
      durationSeconds: 42,
      fps: 30,
      hasBlackBars: false,
      audioTrackPresent: true,
      audioMeanDb: -12,
      abruptCutsCount: 2,
      repeatedSegmentsCount: 0,
      subtitlesLegibility: 'LEGIBLE',
      endsInSuspense: false,
      sceneInterrupted: false,
      declaredCategory: 'ANIME',
      declaredSubcategory: 'Shounen Espadachins & Sakuga',
      declaredWorkHypothesis: 'Demon Slayer (Kimetsu no Yaiba)',
      workEvidenceLevel: 'STRONG_CONFIRMED',
      frames: [
        {
          frameIndex: 1,
          timestampSec: 0,
          sceneId: 'scene_forest_clash',
          sceneDescription: 'Tanjiro tenta cortar os fios de sangue de Rui na floresta escura',
          dominantAction: 'Aespada de Tanjiro se parte ao meio diante dos fios',
          charactersInFrame: ['Tanjiro Kamado'],
          ocrTexts: [],
          sharpnessScore: 93,
          brightnessScore: 54,
          cornerAndRegionOverlays: [],
        },
        {
          frameIndex: 2,
          timestampSec: 18,
          sceneId: 'scene_flashback_father',
          sceneDescription: 'Flashback da dança ritual do Deus do Fogo na neve com o pai de Tanjiro',
          dominantAction: 'Despertar da memória da respiração Hinokami Kagura',
          charactersInFrame: ['Tanjiro Kamado', 'Nezuko Kamado'],
          ocrTexts: [],
          sharpnessScore: 95,
          brightnessScore: 72,
          cornerAndRegionOverlays: [],
        },
        {
          frameIndex: 3,
          timestampSec: 36,
          sceneId: 'scene_fire_slash_finale',
          sceneDescription: 'Golpe final flamejante combinado com o Arte Demoníaca de Sangue de Nezuko',
          dominantAction: 'Corte decisivo atravessando os fios de Rui',
          charactersInFrame: ['Tanjiro Kamado', 'Nezuko Kamado'],
          ocrTexts: [],
          sharpnessScore: 96,
          brightnessScore: 78,
          cornerAndRegionOverlays: [],
        },
      ],
    });

    const a5 = await uploadMultiFrameVideoToPipeline(baseUrl, p5, `cenario5_multiscene_${ts}.mp4`, buf5);
    assert.strictEqual(a5.scene_changes_count, 2, 'Cenário 5: Deve detectar exatamente 2 mudanças de cena (3 cenas distintas)');
    assert.strictEqual(a5.scenes_breakdown.length, 3, 'Cenário 5: Breakdown deve conter as 3 cenas');
    assert.notStrictEqual(a5.initial_event, a5.final_event, 'Cenário 5: Evento inicial e evento final devem refletir a progressão');
    evaluationLog.push({
      scenario: 5,
      name: 'Vídeo com duas ou mais cenas',
      expected: 'scene_changes_count=2 (3 cenas), initial_event != final_event',
      observed: `scene_changes_count=${a5.scene_changes_count} (${a5.scenes_breakdown.length} cenas)`,
      passed: true,
      falsePositive: false,
      falseNegative: false,
    });
    console.log(`  ✅ Cenário 5 aprovado: ${a5.scenes_breakdown.length} cenas e ${a5.scene_changes_count} transições detectadas.`);

    // ------------------------------------------------------------------------
    // CENÁRIO 6: Vídeo que termina em suspense (Cliffhanger / Cena interrompida)
    // ------------------------------------------------------------------------
    console.log(`[CENÁRIO 6] Testando vídeo que termina em momento de suspense...`);
    const p6 = await createAndApproveCandidate(baseUrl, {
      channelId: 'ego-series',
      sourceUrl: `https://www.tiktok.com/@suspense.clips_${ts}/video/7500006${ts}`,
      title: 'Gi-hun abre a caixa preta no final de Round 6... o que tinha dentro?! Continua',
      workReference: 'Round 6 (Squid Game)',
    });

    const buf6 = buildMultiFrameVideoBuffer({
      width: 1080,
      height: 1920,
      durationSeconds: 29,
      fps: 30,
      hasBlackBars: false,
      audioTrackPresent: true,
      audioMeanDb: -13,
      abruptCutsCount: 1,
      repeatedSegmentsCount: 0,
      subtitlesLegibility: 'LEGIBLE',
      endsInSuspense: true,
      sceneInterrupted: true,
      declaredCategory: 'SERIE',
      declaredSubcategory: 'Suspense de Sobrevivência & Thriller',
      declaredWorkHypothesis: 'Round 6 (Squid Game)',
      workEvidenceLevel: 'STRONG_CONFIRMED',
      frames: [
        {
          frameIndex: 1,
          timestampSec: 0,
          sceneId: 'box_delivery',
          sceneDescription: 'Gi-hun recebe uma caixa preta com laço rosa misteriosa',
          dominantAction: 'Aproximação hesitante da mesa',
          charactersInFrame: ['Seong Gi-hun (Jogador 456)'],
          ocrTexts: [],
          sharpnessScore: 88,
          brightnessScore: 60,
          cornerAndRegionOverlays: [],
        },
        {
          frameIndex: 2,
          timestampSec: 27,
          sceneId: 'cliffhanger_cut',
          sceneDescription: 'A tampa começa a abrir e o rosto de Gi-hun congela em choque antes de revelar o interior',
          dominantAction: 'Corte abrupto em suspense máximo (cliffhanger)',
          charactersInFrame: ['Seong Gi-hun (Jogador 456)'],
          ocrTexts: ['CONTINUA NA PARTE 2...'],
          sharpnessScore: 89,
          brightnessScore: 58,
          cornerAndRegionOverlays: [],
        },
      ],
    });

    const a6 = await uploadMultiFrameVideoToPipeline(baseUrl, p6, `cenario6_suspense_${ts}.mp4`, buf6);
    assert.strictEqual(a6.ends_in_suspense, 1, 'Cenário 6: Deve identificar término em suspense');
    assert.strictEqual(a6.scene_interrupted, 1, 'Cenário 6: Deve identificar cena interrompida');
    assert.strictEqual(a6.continuation_classification, 'CONTINUACAO_PROVAVEL', 'Cenário 6: Deve classificar como CONTINUACAO_PROVAVEL');
    assert.strictEqual(a6.recommended_decision, 'MANTER_BLOQUEADO_PENDENCIAS', 'Cenário 6: Deve reter no pipeline aguardando continuação (VÍDEO B)');
    evaluationLog.push({
      scenario: 6,
      name: 'Vídeo que termina em suspense',
      expected: 'ends_in_suspense=1, CONTINUACAO_PROVAVEL, MANTER_BLOQUEADO_PENDENCIAS',
      observed: `ends_in_suspense=${a6.ends_in_suspense}, ${a6.continuation_classification}, ${a6.recommended_decision}`,
      passed: true,
      falsePositive: false,
      falseNegative: false,
    });
    console.log(`  ✅ Cenário 6 aprovado: Cliffhanger detectado → ${a6.continuation_classification} (${a6.recommended_decision}).`);

    // ------------------------------------------------------------------------
    // CENÁRIO 7: Dois vídeos que REALMENTE formam uma sequência (Parte 1 e Parte 2 do mesmo criador)
    // ------------------------------------------------------------------------
    console.log(`[CENÁRIO 7] Testando dois vídeos que realmente formam uma sequência (Parte 1 + Parte 2)...`);
    const seqCreator = `@seq.master_${ts}`;
    const p7Part1 = await createAndApproveCandidate(baseUrl, {
      channelId: 'ego-anime',
      sourceUrl: `https://www.tiktok.com/${seqCreator}/video/75000071${ts}`,
      title: 'Sung Jin-Woo vs Igris na Dungeon Vermelha (Parte 1)',
      workReference: 'Solo Leveling',
    });
    const p7Part2 = await createAndApproveCandidate(baseUrl, {
      channelId: 'ego-anime',
      sourceUrl: `https://www.tiktok.com/${seqCreator}/video/75000072${ts}`,
      title: 'Sung Jin-Woo vs Igris: O Despertar da Sombra "Ergam-se" (Parte 2)',
      workReference: 'Solo Leveling',
    });

    const buf7Part1 = buildMultiFrameVideoBuffer({
      width: 1080,
      height: 1920,
      durationSeconds: 34,
      fps: 30,
      hasBlackBars: false,
      audioTrackPresent: true,
      audioMeanDb: -12,
      abruptCutsCount: 1,
      repeatedSegmentsCount: 0,
      subtitlesLegibility: 'LEGIBLE',
      endsInSuspense: true,
      sceneInterrupted: true,
      explicitPartLabel: 'Parte 1',
      declaredCategory: 'ANIME',
      declaredSubcategory: 'Ação & Fantasia Sombria',
      declaredWorkHypothesis: 'Solo Leveling',
      workEvidenceLevel: 'STRONG_CONFIRMED',
      frames: [
        {
          frameIndex: 1,
          timestampSec: 0,
          sceneId: 'igris_duel_1',
          sceneDescription: 'Sung Jin-Woo entra na sala do trono e encara o cavaleiro vermelho Igris',
          dominantAction: 'Início do duelo de adagas contra espada longa',
          charactersInFrame: ['Sung Jin-Woo', 'Igris'],
          ocrTexts: ['PARTE 1'],
          sharpnessScore: 92,
          brightnessScore: 62,
          cornerAndRegionOverlays: [],
        },
        {
          frameIndex: 2,
          timestampSec: 32,
          sceneId: 'igris_duel_cliff',
          sceneDescription: 'Igris embainha a espada para lutar com as mãos limpas',
          dominantAction: 'Corte antes do golpe final',
          charactersInFrame: ['Sung Jin-Woo', 'Igris'],
          ocrTexts: [],
          sharpnessScore: 91,
          brightnessScore: 60,
          cornerAndRegionOverlays: [],
        },
      ],
    });

    const buf7Part2 = buildMultiFrameVideoBuffer({
      width: 1080,
      height: 1920,
      durationSeconds: 38,
      fps: 30,
      hasBlackBars: false,
      audioTrackPresent: true,
      audioMeanDb: -12,
      abruptCutsCount: 1,
      repeatedSegmentsCount: 0,
      subtitlesLegibility: 'LEGIBLE',
      endsInSuspense: false,
      sceneInterrupted: false,
      explicitPartLabel: 'Parte 2',
      declaredCategory: 'ANIME',
      declaredSubcategory: 'Ação & Fantasia Sombria',
      declaredWorkHypothesis: 'Solo Leveling',
      workEvidenceLevel: 'STRONG_CONFIRMED',
      frames: [
        {
          frameIndex: 1,
          timestampSec: 0,
          sceneId: 'igris_duel_2',
          sceneDescription: 'Continuação imediata do embate corpo a corpo entre Jin-Woo e Igris',
          dominantAction: 'Jin-Woo derrota Igris com a adaga presa na armadura',
          charactersInFrame: ['Sung Jin-Woo', 'Igris'],
          ocrTexts: ['PARTE 2'],
          sharpnessScore: 93,
          brightnessScore: 64,
          cornerAndRegionOverlays: [],
        },
        {
          frameIndex: 2,
          timestampSec: 35,
          sceneId: 'igris_arise',
          sceneDescription: 'Sung Jin-Woo pronuncia "Arise" (Ergam-se) e extrai a sombra de Igris',
          dominantAction: 'Conclusão épica da sequência',
          charactersInFrame: ['Sung Jin-Woo', 'Igris'],
          ocrTexts: ['ERGAM-SE'],
          sharpnessScore: 94,
          brightnessScore: 66,
          cornerAndRegionOverlays: [],
        },
      ],
    });

    await uploadMultiFrameVideoToPipeline(baseUrl, p7Part2, `cenario7_part2_${ts}.mp4`, buf7Part2);
    const a7Part1 = await uploadMultiFrameVideoToPipeline(baseUrl, p7Part1, `cenario7_part1_${ts}.mp4`, buf7Part1);

    assert.strictEqual(a7Part1.continuation_classification, 'CONTINUACAO_CONFIRMADA', 'Cenário 7: Deve confirmar a continuação');
    assert.ok(a7Part1.sequence_group_id, 'Cenário 7: Deve gerar um sequence_group_id agrupando as partes');
    assert.ok(
      a7Part1.continuation_candidates.some((c: any) => c.candidate_pipeline_id === p7Part2 && c.relationship_type === 'PARTE_POSTERIOR'),
      'Cenário 7: Parte 1 deve apontar para a Parte 2 como PARTE_POSTERIOR'
    );
    evaluationLog.push({
      scenario: 7,
      name: 'Dois vídeos que realmente formam uma sequência',
      expected: 'CONTINUACAO_CONFIRMADA + sequence_group_id + link PARTE_POSTERIOR',
      observed: `${a7Part1.continuation_classification} (Grupo: ${a7Part1.sequence_group_id}, Candidatos: ${a7Part1.continuation_candidates.length})`,
      passed: true,
      falsePositive: false,
      falseNegative: false,
    });
    console.log(`  ✅ Cenário 7 aprovado: Parte 1 e Parte 2 agrupadas em ${a7Part1.sequence_group_id} (${a7Part1.continuation_classification}).`);

    // ------------------------------------------------------------------------
    // CENÁRIO 8: Dois vídeos semelhantes que NÃO formam uma sequência (Prevenção de Falso Positivo)
    // ------------------------------------------------------------------------
    console.log(`[CENÁRIO 8] Testando dois vídeos semelhantes que NÃO formam uma sequência...`);
    const p8Video1 = await createAndApproveCandidate(baseUrl, {
      channelId: 'ego-filmes',
      sourceUrl: `https://www.tiktok.com/@creator.alpha_${ts}/video/75000081${ts}`,
      title: 'Cena do trem em Homem-Aranha 2 — Herói salvando passageiros',
      workReference: 'Homem-Aranha (Spider-Man)',
    });
    const p8Video2 = await createAndApproveCandidate(baseUrl, {
      channelId: 'ego-filmes',
      sourceUrl: `https://www.tiktok.com/@creator.beta_${ts}/video/75000082${ts}`,
      title: 'Curiosidade sobre o traje de Homem-Aranha no cinema',
      workReference: 'Homem-Aranha (Spider-Man)',
    });

    const buf8A = buildMultiFrameVideoBuffer({
      width: 1080,
      height: 1920,
      durationSeconds: 30,
      fps: 30,
      hasBlackBars: false,
      audioTrackPresent: true,
      audioMeanDb: -14,
      abruptCutsCount: 1,
      repeatedSegmentsCount: 0,
      subtitlesLegibility: 'NO_SUBTITLES',
      endsInSuspense: false,
      sceneInterrupted: false,
      declaredCategory: 'FILME',
      declaredSubcategory: 'Super-Herói & Ação',
      declaredWorkHypothesis: 'Homem-Aranha (Spider-Man)',
      workEvidenceLevel: 'STRONG_CONFIRMED',
      frames: [
        {
          frameIndex: 1,
          timestampSec: 0,
          sceneId: 'spidey_train',
          sceneDescription: 'Homem-Aranha lança teias para frear o metrô desgovernado',
          dominantAction: 'Esforço físico extremo na frente do vagão',
          charactersInFrame: ['Peter Parker / Homem-Aranha'],
          ocrTexts: [],
          sharpnessScore: 88,
          brightnessScore: 65,
          cornerAndRegionOverlays: [],
        },
        {
          frameIndex: 2,
          timestampSec: 25,
          sceneId: 'spidey_train_stop',
          sceneDescription: 'O trem para antes do abismo',
          dominantAction: 'Cena concluída integralmente',
          charactersInFrame: ['Peter Parker / Homem-Aranha'],
          ocrTexts: [],
          sharpnessScore: 89,
          brightnessScore: 66,
          cornerAndRegionOverlays: [],
        },
      ],
    });

    const buf8B = buildMultiFrameVideoBuffer({
      width: 1080,
      height: 1920,
      durationSeconds: 26,
      fps: 30,
      hasBlackBars: false,
      audioTrackPresent: true,
      audioMeanDb: -14,
      abruptCutsCount: 1,
      repeatedSegmentsCount: 0,
      subtitlesLegibility: 'NO_SUBTITLES',
      endsInSuspense: false,
      sceneInterrupted: false,
      declaredCategory: 'FILME',
      declaredSubcategory: 'Super-Herói & Ação',
      declaredWorkHypothesis: 'Homem-Aranha (Spider-Man)',
      workEvidenceLevel: 'STRONG_CONFIRMED',
      frames: [
        {
          frameIndex: 1,
          timestampSec: 0,
          sceneId: 'spidey_suit',
          sceneDescription: 'Análise dos detalhes de costura do uniforme nos bastidores',
          dominantAction: 'Exibição de bastidores independente',
          charactersInFrame: ['Peter Parker / Homem-Aranha'],
          ocrTexts: [],
          sharpnessScore: 87,
          brightnessScore: 68,
          cornerAndRegionOverlays: [],
        },
        {
          frameIndex: 2,
          timestampSec: 22,
          sceneId: 'spidey_suit_end',
          sceneDescription: 'Comparativo de lentes da máscara',
          dominantAction: 'Encerramento da curiosidade',
          charactersInFrame: ['Peter Parker / Homem-Aranha'],
          ocrTexts: [],
          sharpnessScore: 88,
          brightnessScore: 67,
          cornerAndRegionOverlays: [],
        },
      ],
    });

    await uploadMultiFrameVideoToPipeline(baseUrl, p8Video2, `cenario8_sim2_${ts}.mp4`, buf8B);
    const a8Video1 = await uploadMultiFrameVideoToPipeline(baseUrl, p8Video1, `cenario8_sim1_${ts}.mp4`, buf8A);

    assert.strictEqual(
      a8Video1.continuation_classification,
      'NAO_IDENTIFICADA',
      'Cenário 8: Vídeos apenas semelhantes (mesma franquia, mas criadores/cenas independentes) NÃO devem ser agrupados como continuação'
    );
    assert.strictEqual(a8Video1.sequence_group_id, null, 'Cenário 8: Não deve criar sequence_group_id falso');
    evaluationLog.push({
      scenario: 8,
      name: 'Dois vídeos semelhantes que não formam uma sequência',
      expected: 'continuation_classification=NAO_IDENTIFICADA, sequence_group_id=null',
      observed: `continuation_classification=${a8Video1.continuation_classification}, sequence_group_id=${a8Video1.sequence_group_id}`,
      passed: true,
      falsePositive: false,
      falseNegative: false,
    });
    console.log(`  ✅ Cenário 8 aprovado: Nenhuma falsa sequência criada entre vídeos independentes do mesmo tema.`);

    // ------------------------------------------------------------------------
    // CENÁRIO 9: Vídeo horizontal (16:9 1920x1080 -> Não descartar automaticamente se adaptável ao vertical)
    // ------------------------------------------------------------------------
    console.log(`[CENÁRIO 9] Testando vídeo horizontal Full HD (1920x1080) adaptável ao formato vertical...`);
    const p9 = await createAndApproveCandidate(baseUrl, {
      channelId: 'ego-series',
      sourceUrl: `https://www.tiktok.com/@cinema.widescreen_${ts}/video/7500009${ts}`,
      title: 'A caminhada de Thomas Shelby em Birmingham (16:9 Widescreen HD)',
      workReference: 'Peaky Blinders',
    });

    const buf9 = buildMultiFrameVideoBuffer({
      width: 1920,
      height: 1080,
      durationSeconds: 32,
      fps: 30,
      hasBlackBars: false,
      audioTrackPresent: true,
      audioMeanDb: -12,
      abruptCutsCount: 1,
      repeatedSegmentsCount: 0,
      subtitlesLegibility: 'LEGIBLE',
      endsInSuspense: false,
      sceneInterrupted: false,
      declaredCategory: 'SERIE',
      declaredSubcategory: 'Drama Histórico & Crime',
      declaredWorkHypothesis: 'Peaky Blinders',
      workEvidenceLevel: 'STRONG_CONFIRMED',
      frames: [
        {
          frameIndex: 1,
          timestampSec: 0,
          sceneId: 'shelby_walk_1',
          sceneDescription: 'Thomas Shelby caminhando em câmera lenta entre as fornalhas de Birmingham',
          dominantAction: 'Enquadramento centralizado perfeito para crop 9:16',
          charactersInFrame: ['Thomas Shelby'],
          ocrTexts: [],
          sharpnessScore: 91,
          brightnessScore: 62,
          cornerAndRegionOverlays: [],
        },
        {
          frameIndex: 2,
          timestampSec: 28,
          sceneId: 'shelby_walk_2',
          sceneDescription: 'Thomas Shelby tira o boné no escritório da Shelby Company Limited',
          dominantAction: 'Fechamento de cena nítido',
          charactersInFrame: ['Thomas Shelby'],
          ocrTexts: [],
          sharpnessScore: 92,
          brightnessScore: 64,
          cornerAndRegionOverlays: [],
        },
      ],
    });

    const a9 = await uploadMultiFrameVideoToPipeline(baseUrl, p9, `cenario9_horizontal_${ts}.mp4`, buf9);
    assert.strictEqual(a9.is_vertical, 0, 'Cenário 9: Deve identificar que não é vertical nativo (1920x1080)');
    assert.strictEqual(a9.adaptable_to_vertical, 1, 'Cenário 9: Deve identificar que é adaptável ao formato vertical');
    assert.strictEqual(a9.status_technical_quality, 'HORIZONTAL_ADAPTAVEL_9_16');
    assert.strictEqual(
      a9.recommended_decision,
      'AVANCAR_PARA_PREPARACAO',
      'Cenário 9: Não deve descartar automaticamente vídeo horizontal adaptável'
    );
    evaluationLog.push({
      scenario: 9,
      name: 'Vídeo horizontal (adaptável ao vertical)',
      expected: 'is_vertical=0, adaptable_to_vertical=1, HORIZONTAL_ADAPTAVEL_9_16, AVANCAR_PARA_PREPARACAO',
      observed: `is_vertical=${a9.is_vertical}, adaptable=${a9.adaptable_to_vertical}, ${a9.status_technical_quality}, ${a9.recommended_decision}`,
      passed: true,
      falsePositive: false,
      falseNegative: false,
    });
    console.log(`  ✅ Cenário 9 aprovado: Vídeo 1920x1080 classificado como ${a9.status_technical_quality} (Score: ${a9.quality_score}/100) sem descarte automático.`);

    // ------------------------------------------------------------------------
    // CENÁRIO 10: Vídeo de baixa resolução / borrado (Perfil VÍDEO C -> Revisão ou Descarte)
    // ------------------------------------------------------------------------
    console.log(`[CENÁRIO 10] Testando vídeo de baixa resolução (360x640), borrado e com barras pretas...`);
    const p10 = await createAndApproveCandidate(baseUrl, {
      channelId: 'ego-filmes',
      sourceUrl: `https://www.tiktok.com/@lowres.test_${ts}/video/7500010${ts}`,
      title: 'Gravação de baixa resolução borrada e sem nitidez',
      workReference: 'Trecho Desconhecido',
    });

    const buf10 = buildMultiFrameVideoBuffer({
      width: 360,
      height: 640,
      durationSeconds: 20,
      fps: 15,
      hasBlackBars: true,
      audioTrackPresent: false,
      audioMeanDb: -60,
      abruptCutsCount: 5,
      repeatedSegmentsCount: 2,
      subtitlesLegibility: 'ILLEGIBLE',
      endsInSuspense: false,
      sceneInterrupted: false,
      declaredCategory: 'FILME',
      declaredSubcategory: 'Indefinido',
      declaredWorkHypothesis: 'Inconclusivo',
      workEvidenceLevel: 'INSUFFICIENT_EVIDENCE',
      frames: [
        {
          frameIndex: 1,
          timestampSec: 0,
          sceneId: 'blur_1',
          sceneDescription: 'Quadro altamente pixelado e borrado',
          dominantAction: 'Silhuetas indistintas com barras pretas',
          charactersInFrame: [],
          ocrTexts: [],
          sharpnessScore: 22,
          brightnessScore: 30,
          cornerAndRegionOverlays: [],
        },
        {
          frameIndex: 2,
          timestampSec: 10,
          sceneId: 'blur_1',
          sceneDescription: 'Quadro duplicado de baixa definição e legenda ilegível',
          dominantAction: 'Sem movimento nítido',
          charactersInFrame: [],
          ocrTexts: [],
          sharpnessScore: 24,
          brightnessScore: 30,
          isDuplicateOfPrevious: true,
          cornerAndRegionOverlays: [],
        },
      ],
    });

    const a10 = await uploadMultiFrameVideoToPipeline(baseUrl, p10, `cenario10_lowres_${ts}.mp4`, buf10);
    assert.ok(a10.quality_score < 40, `Cenário 10: Score de qualidade deve ser baixo (obtido: ${a10.quality_score})`);
    assert.strictEqual(a10.content_classification, 'INCONCLUSIVO', 'Cenário 10: Sem evidências, deve classificar como INCONCLUSIVO sem inventar obra');
    assert.strictEqual(a10.recommended_decision, 'ENCAMINHAR_REVISAO_OU_DESCARTAR', 'Cenário 10: Deve encaminhar para revisão ou descarte (VÍDEO C)');
    assert.strictEqual(a10.decision_archetype, 'VIDEO_C_REVISAO_DESCARTE');
    evaluationLog.push({
      scenario: 10,
      name: 'Vídeo de baixa resolução e inconclusivo',
      expected: 'quality_score<40, content=INCONCLUSIVO, ENCAMINHAR_REVISAO_OU_DESCARTAR (VÍDEO C)',
      observed: `quality_score=${a10.quality_score}, content=${a10.content_classification}, ${a10.recommended_decision} (${a10.decision_archetype})`,
      passed: true,
      falsePositive: false,
      falseNegative: false,
    });
    console.log(`  ✅ Cenário 10 aprovado: Score ${a10.quality_score}/100 e conteúdo ${a10.content_classification} → ${a10.recommended_decision} (${a10.decision_archetype}).\n`);

    const passedCount = evaluationLog.filter((e) => e.passed).length;
    console.log(`📊 RESUMO DE PRECISÃO DOS 10 CENÁRIOS: ${passedCount}/10 aprovados (100% precisão | 0 falsos positivos | 0 falsos negativos).\n`);
    return evaluationLog;
  } finally {
    // Limpar os 12 vídeos sintéticos de teste do banco de produção para manter apenas os 90 vídeos reais do TikTok
    cleanupSyntheticTestRecords();
    if (server) {
      server.close();
    }
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith('run-intelligence-tests.ts');
if (isMain) {
  runVideoIntelligenceAcceptanceTests().catch((err) => {
    console.error('❌ Falha nos testes de Video Intelligence:', err);
    process.exit(1);
  });
}
