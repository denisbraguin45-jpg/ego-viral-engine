import assert from 'node:assert';
import { app } from '../index.ts';

async function runTests() {
  const server = app.listen(0);
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  console.log(`\n================================================================`);
  console.log(`🧪 EGO VIRAL ENGINE — BATERIA DE TESTES AUTOMATIZADOS (FASES 1-5)`);
  console.log(`================================================================\n`);

  try {
    // ------------------------------------------------------------------------
    // FASE 1: FUNDAÇÃO (Canais, Metas 90/dia, 6 Contas, Dashboard, Auth JWT)
    // ------------------------------------------------------------------------
    console.log(`[FASE 1] Testando Autenticação JWT, 3 Canais (90 vídeos/dia) e Dashboard...`);
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@egotv.com.br', password: 'egotv2026' }),
    });
    assert.strictEqual(loginRes.status, 200, 'Login deve retornar HTTP 200');
    const loginData = await loginRes.json() as any;
    assert.ok(loginData.token, 'Token JWT deve ser emitido');

    const channelsRes = await fetch(`${baseUrl}/api/channels`);
    const channelsData = await channelsRes.json() as any;
    assert.strictEqual(channelsData.channels.length, 3, 'Devem existir 3 canais (EGO FILMES, EGO ANIME, EGO SÉRIES)');
    assert.strictEqual(channelsData.totalDailyGoal, 90, 'Meta diária total deve ser de 90 vídeos/dia');

    const totalAccounts = channelsData.channels.reduce((acc: number, c: any) => acc + c.social_accounts.length, 0);
    assert.strictEqual(totalAccounts, 6, 'Devem existir 6 contas sociais configuradas (3 TikTok + 3 Instagram)');

    const dashRes = await fetch(`${baseUrl}/api/dashboard?includeDemo=true`);
    const dashData = await dashRes.json() as any;
    assert.strictEqual(dashData.dataTransparency.showingDemoData, true, 'Deve identificar claramente os dados demonstrativos');
    console.log(`  ✅ Fase 1 validada: JWT OK, 3 canais (90/dia), 6 contas sociais e transparência de dados no Dashboard.`);

    // ------------------------------------------------------------------------
    // FASE 2: DESCOBERTA (VIRAL RADAR - Cadastro, Scoring Multicritério e Deduplicação)
    // ------------------------------------------------------------------------
    console.log(`[FASE 2] Testando Viral Radar, Score Multicritério e Deduplicação...`);
    const uniqueUrl = `https://www.youtube.com/watch?v=test-radar-${Date.now()}`;
    const radarRes = await fetch(`${baseUrl}/api/radar/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: 'ego-filmes',
        source_url: uniqueUrl,
        platform: 'YOUTUBE_OFFICIAL',
        title: 'Plot Twist em Ficção Científica — Bastidores do Cinema Oficial',
        franchise_or_work: 'Interestelar / Sci-Fi',
        views_observed: 50000,
        likes_observed: 6500,
        comments_observed: 420,
        original_published_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      }),
    });
    assert.strictEqual(radarRes.status, 200, 'Registro no Viral Radar deve retornar HTTP 200');
    const radarCreated = await radarRes.json() as any;
    assert.ok(radarCreated.scoreBreakdown.relevanceScore > 70, 'Score multicritério deve ser calculado');

    // Testar bloqueio de URL duplicada no Radar
    const dupRadarRes = await fetch(`${baseUrl}/api/radar/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: 'ego-filmes',
        source_url: uniqueUrl,
        platform: 'YOUTUBE_OFFICIAL',
        title: 'Duplicata de Teste',
      }),
    });
    assert.strictEqual(dupRadarRes.status, 409, 'URL duplicada no Radar deve retornar HTTP 409 Conflict');
    console.log(`  ✅ Fase 2 validada: Tendência classificada (Score: ${radarCreated.scoreBreakdown.relevanceScore}) e duplicata bloqueada.`);

    // ------------------------------------------------------------------------
    // FASE 3: BIBLIOTECA, CONTROLE DE DIREITOS (GATEKEEPER) E PREPARAÇÃO DE COPY
    // ------------------------------------------------------------------------
    console.log(`[FASE 3] Testando Promoção para Biblioteca, Bloqueio de Direitos e Geração de Copy...`);
    const promoteRes = await fetch(`${baseUrl}/api/radar/items/${radarCreated.id}/promote`, {
      method: 'POST',
    });
    assert.strictEqual(promoteRes.status, 200, 'Promoção do Radar para Biblioteca deve funcionar');
    const promotedData = await promoteRes.json() as any;
    const contentId = promotedData.contentId;

    // Testar REGRA CRÍTICA: Tentar aprovar sem verificar os direitos de uso antes (DEVE BLOQUEAR com HTTP 403)
    const illegalApproveRes = await fetch(`${baseUrl}/api/library/${contentId}/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_status: 'APPROVED' }),
    });
    assert.strictEqual(
      illegalApproveRes.status,
      403,
      'Gatekeeper deve bloquear aprovação de conteúdo sem direitos verificados (HTTP 403)'
    );

    // Agora verificar e autorizar os direitos de uso
    const verifyRes = await fetch(`${baseUrl}/api/library/${contentId}/verify-rights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rights_status: 'VERIFIED_AUTHORIZED',
        rights_license_notes: 'Press Kit Oficial verificado pelo jurídico Ego TV.',
      }),
    });
    assert.strictEqual(verifyRes.status, 200, 'Verificação de direitos deve retornar HTTP 200');

    // Agora aprovar legalmente
    const legalApproveRes = await fetch(`${baseUrl}/api/library/${contentId}/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_status: 'APPROVED' }),
    });
    assert.strictEqual(legalApproveRes.status, 200, 'Após direitos verificados, aprovação deve retornar HTTP 200');

    // Testar geração de modelos separados TikTok vs Instagram e bloqueio de alegação enganosa
    const copyRes = await fetch(`${baseUrl}/api/preparation/generate-copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: 'ego-filmes',
        title: 'Bastidores do Cinema',
        work_reference: 'Obra Licenciada',
        angle: 'CURIOSITY',
      }),
    });
    const copyPkg = await copyRes.json() as any;
    assert.notStrictEqual(copyPkg.tiktokCaption, copyPkg.instagramCaption, 'Legendas de TikTok e Instagram devem ter formatos distintos');

    console.log(`  ✅ Fase 3 validada: Bloqueio de direitos não verificados (HTTP 403), aprovação legal e templates TikTok/Instagram distintos.`);

    // ------------------------------------------------------------------------
    // FASE 4: CALENDÁRIO, FILA DE PUBLICAÇÃO, PREVENÇÃO DE DUPLICATA E NÃO-SIMULAÇÃO
    // ------------------------------------------------------------------------
    console.log(`[FASE 4] Testando Agendamento na Fila, Prevenção de Duplicata e Não-Simulação de API...`);
    const schedRes = await fetch(`${baseUrl}/api/queue/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id: contentId,
        social_account_id: 'tt-filmes',
        scheduled_for: '2026-10-28T18:00',
        approved_for_publish: true,
      }),
    });
    assert.strictEqual(schedRes.status, 200, 'Agendamento de item autorizado deve retornar HTTP 200');
    const schedData = await schedRes.json() as any;

    // Testar bloqueio de duplicata na mesma conta social
    const dupSchedRes = await fetch(`${baseUrl}/api/queue/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id: contentId,
        social_account_id: 'tt-filmes',
        scheduled_for: '2026-10-28T20:00',
        approved_for_publish: true,
      }),
    });
    assert.strictEqual(dupSchedRes.status, 409, 'Duplicata na fila para a mesma conta deve retornar HTTP 409');

    // Testar disparo na fila sem credenciais OAuth (Nunca deve fingir PUBLISHED_OFFICIAL_API)
    const dispatchRes = await fetch(`${baseUrl}/api/queue/${schedData.id}/dispatch`, {
      method: 'POST',
    });
    const dispatchData = await dispatchRes.json() as any;
    assert.strictEqual(
      dispatchData.status,
      'AWAITING_CREDENTIALS',
      'Sem chaves OAuth ativas, o sistema nunca deve simular publicação concluída, devendo registrar AWAITING_CREDENTIALS'
    );
    console.log(`  ✅ Fase 4 validada: Fila agendada, duplicata bloqueada e tentativa sem OAuth retida com transparência (${dispatchData.status}).`);

    // ------------------------------------------------------------------------
    // FASE 5: ANALYTICS, LINKS RASTREÁVEIS (/r/:code) E ATRIBUIÇÃO DE ASSINATURA
    // ------------------------------------------------------------------------
    console.log(`[FASE 5] Testando Links Rastreáveis (/r/:code), Contagem Real de Cliques e Atribuição...`);
    const customCode = `ego-test-${Date.now().toString(36)}`;
    const linkRes = await fetch(`${baseUrl}/api/analytics/tracking-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: 'ego-filmes',
        platform: 'TIKTOK',
        campaign_name: 'campanha_validacao',
        custom_code: customCode,
      }),
    });
    assert.strictEqual(linkRes.status, 200, 'Criação de link rastreável deve retornar HTTP 200');

    // Simular clique real no redirecionador
    const clickRes = await fetch(`${baseUrl}/r/${customCode}?preview=1`);
    const clickData = await clickRes.json() as any;
    assert.strictEqual(clickData.newClicksCount, 1, 'Clique real no link rastreável deve incrementar contador para 1');

    // Atribuir assinatura vinculada ao código UTM
    const convRes = await fetch(`${baseUrl}/api/analytics/conversions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tracking_code: customCode,
        subscriber_ref: 'SUB-REAL-TEST-01',
        plan_type: 'MENSAL',
        revenue_brl: 29.9,
      }),
    });
    assert.strictEqual(convRes.status, 200, 'Registro de conversão com tracking_code válido deve retornar HTTP 200');

    console.log(`  ✅ Fase 5 validada: Link /r/${customCode} criado, clique contabilizado e assinatura atribuída com vínculo UTM.\n`);

    // ------------------------------------------------------------------------
    // TESTE OBRIGATÓRIO DE 10 PASSOS: VIRAL RADAR -> VIDEO PIPELINE (90 VÍDEOS/DIA)
    // ------------------------------------------------------------------------
    console.log(`[VIDEO PIPELINE] Executando Teste Obrigatório dos 10 Passos (Integração VIRAL RADAR -> VIDEO PIPELINE)...`);

    // 1. Cadastrar um vídeo no VIRAL RADAR
    const pipeTestUrl = `https://www.youtube.com/watch?v=pipeline-e2e-${Date.now()}`;
    const step1Res = await fetch(`${baseUrl}/api/radar/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: 'ego-anime',
        source_url: pipeTestUrl,
        platform: 'YOUTUBE_OFFICIAL',
        title: 'Sequência Sakuga Episódio Final — Press Kit Oficial',
        franchise_or_work: 'Aether Chronicles',
        views_observed: 210000,
        likes_observed: 32000,
        comments_observed: 1900,
      }),
    });
    assert.strictEqual(step1Res.status, 200, 'Passo 1: Cadastrar vídeo no Viral Radar deve retornar HTTP 200');
    const step1Data = await step1Res.json() as any;
    console.log(`  ✓ Passo 1 concluído: Vídeo cadastrado no Viral Radar (#${step1Data.id}).`);

    // 2 & 3. Identificar a origem e aprovar o candidato encaminhando-o ao VIDEO PIPELINE
    const step3Res = await fetch(`${baseUrl}/api/radar/items/${step1Data.id}/approve-to-pipeline`, {
      method: 'POST',
    });
    assert.strictEqual(step3Res.status, 200, 'Passo 3: Aprovar candidato para o Video Pipeline deve retornar HTTP 200');
    const step3Data = await step3Res.json() as any;
    const pipelineId = step3Data.pipelineId;
    assert.ok(step3Data.originalExternalId.startsWith('yt_'), 'Passo 2: Identificador original e plataforma devem ser extraídos e preservados');
    console.log(`  ✓ Passos 2 e 3 concluídos: Origem identificada (${step3Data.originalExternalId}) e candidato aprovado no Pipeline (#${pipelineId}).`);

    // Validar proteção contra aprovação duplicada do mesmo candidato
    const dupApproveRes = await fetch(`${baseUrl}/api/radar/items/${step1Data.id}/approve-to-pipeline`, {
      method: 'POST',
    });
    assert.strictEqual(dupApproveRes.status, 409, 'Proteção contra aprovação duplicada deve retornar HTTP 409');

    // Validar bloqueio antes de confirmar direitos (tentar enviar arquivo com direitos pendentes deve falhar com 403)
    const blockedUploadForm = new FormData();
    blockedUploadForm.append('videoFile', new Blob(['video-bytes-blocked'], { type: 'video/mp4' }), 'blocked.mp4');
    const blockedUploadRes = await fetch(`${baseUrl}/api/pipeline/${pipelineId}/upload-file`, {
      method: 'POST',
      body: blockedUploadForm,
    });
    assert.strictEqual(blockedUploadRes.status, 403, 'Deve bloquear importação de arquivo enquanto direitos não estiverem confirmados (HTTP 403)');

    // 4. Confirmar a situação dos direitos
    const step4Res = await fetch(`${baseUrl}/api/pipeline/${pipelineId}/rights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rights_status: 'VERIFIED_AUTHORIZED',
        rights_notes: 'Licença promocional confirmada pelo operador Ego TV.',
      }),
    });
    assert.strictEqual(step4Res.status, 200, 'Passo 4: Confirmação dos direitos deve retornar HTTP 200');
    const step4Data = await step4Res.json() as any;
    assert.strictEqual(step4Data.pipelineState, 'LIBERADO_PARA_UTILIZACAO', 'Estado deve avançar para LIBERADO_PARA_UTILIZACAO');
    console.log(`  ✓ Passo 4 concluído: Situação dos direitos confirmada (${step4Data.pipelineState}).`);

    // Testar tentativa de obtenção automatizada (Opção A) de URL do YouTube -> não deve contornar restrições, marcando ARQUIVO_PENDENTE
    const autoAttemptRes = await fetch(`${baseUrl}/api/pipeline/${pipelineId}/acquire-auto`, {
      method: 'POST',
    });
    const autoAttemptData = await autoAttemptRes.json() as any;
    assert.strictEqual(autoAttemptData.obtained, false, 'Não deve fazer download não autorizado do YouTube');
    assert.strictEqual(autoAttemptData.pipelineState, 'ARQUIVO_PENDENTE', 'Deve marcar como ARQUIVO_PENDENTE quando não houver download direto autorizado');

    // 5 & 6. Importar um arquivo de teste (Opção C) e associar o arquivo ao candidato
    const uniqueFileContent = `EGO_ANIME_AUTHORIZED_TEST_VIDEO_${Date.now()}`;
    const uploadForm = new FormData();
    uploadForm.append('videoFile', new Blob([uniqueFileContent], { type: 'video/mp4' }), 'anime_sakuga_test.mp4');
    uploadForm.append('acquisition_method', 'OPTION_C_UPLOAD');
    uploadForm.append('duration_seconds', '38');

    const step5Res = await fetch(`${baseUrl}/api/pipeline/${pipelineId}/upload-file`, {
      method: 'POST',
      body: uploadForm,
    });
    assert.strictEqual(step5Res.status, 200, 'Passos 5 e 6: Importação e associação do arquivo de teste devem retornar HTTP 200');
    const step5Data = await step5Res.json() as any;
    assert.strictEqual(step5Data.pipelineState, 'ARQUIVO_RECEBIDO', 'Estado deve ser ARQUIVO_RECEBIDO');
    assert.ok(step5Data.fileHash, 'Arquivo deve ter hash SHA-256 calculado e vinculado ao registro original');
    console.log(`  ✓ Passos 5 e 6 concluídos: Arquivo importado, validado e associado ao candidato (${step5Data.fileName}).`);

    // 7. Preparar a legenda, hashtags, CTA e selecionar ambas as plataformas (TikTok + Instagram)
    const step7Res = await fetch(`${baseUrl}/api/pipeline/${pipelineId}/prepare`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption_tiktok: '⚡ Sequência Sakuga impecável em Aether Chronicles! Veja a programação oficial na Ego TV (link na bio). #EgoAnime #EgoTV',
        caption_instagram: '🔥 Direção de animação nota 10 em Aether Chronicles.\n👉 Acesse o link da bio para conhecer a Ego TV! #EgoAnime #AnimeBrasil',
        hashtags: '#EgoAnime #EgoTV #AnimeBrasil #Sakuga',
        cta_text: 'Acompanhe a programação otaku oficial na Ego TV — acesse pelo link no perfil.',
        target_platforms: 'BOTH',
        duration_seconds: 38,
        video_format: 'MP4 (9:16 1080x1920)',
        mark_ready: true,
      }),
    });
    assert.strictEqual(step7Res.status, 200, 'Passo 7: Preparação da legenda e revisão devem retornar HTTP 200');
    const step7Data = await step7Res.json() as any;
    assert.strictEqual(step7Data.pipelineState, 'PRONTO_PARA_PUBLICACAO', 'Estado deve avançar para PRONTO_PARA_PUBLICACAO');
    console.log(`  ✓ Passo 7 concluído: Legendas TikTok/Instagram preparadas e status PRONTO_PARA_PUBLICACAO.`);

    // Capturar contadores antes de enfileirar para validar Passo 9
    const beforePipeRes = await fetch(`${baseUrl}/api/pipeline?channelId=ego-anime`);
    const beforePipeData = await beforePipeRes.json() as any;
    const animeQueueBefore = beforePipeData.queuesByChannel.find((q: any) => q.channelId === 'ego-anime');

    // 8. Adicionar o vídeo à fila (selecionando BOTH = TikTok + Instagram)
    const step8Res = await fetch(`${baseUrl}/api/pipeline/${pipelineId}/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_for: '2026-10-29T19:30',
        platforms_override: 'BOTH',
      }),
    });
    assert.strictEqual(step8Res.status, 200, 'Passo 8: Adicionar vídeo à fila de publicação deve retornar HTTP 200');
    const step8Data = await step8Res.json() as any;
    assert.strictEqual(step8Data.publicationsCreated, 2, 'Publicar em TikTok + Instagram deve gerar 2 publicações separadas');
    console.log(`  ✓ Passo 8 concluído: Vídeo adicionado à fila (${step8Data.publicationsCreated} publicações criadas: TikTok + Instagram).`);

    // 9. Confirmar que o painel atualiza as quantidades corretamente (1 vídeo preparado único vs 2 publicações)
    const afterPipeRes = await fetch(`${baseUrl}/api/pipeline?channelId=ego-anime`);
    const afterPipeData = await afterPipeRes.json() as any;
    const animeQueueAfter = afterPipeData.queuesByChannel.find((q: any) => q.channelId === 'ego-anime');
    assert.strictEqual(
      animeQueueAfter.platformPublicationsTotal,
      animeQueueBefore.platformPublicationsTotal + 2,
      'Passo 9: Total de publicações na fila do canal deve aumentar em 2'
    );
    assert.strictEqual(
      animeQueueAfter.readyUniqueVideosCount,
      animeQueueBefore.readyUniqueVideosCount,
      'Passo 9: O mesmo vídeo publicado em 2 plataformas continua contabilizado como 1 único vídeo preparado para a meta de 30/dia'
    );
    assert.strictEqual(
      animeQueueAfter.remainingToGoal,
      30 - animeQueueAfter.readyUniqueVideosCount,
      'Passo 9: Quantidade necessária para atingir a meta de 30 vídeos deve estar exata'
    );
    console.log(
      `  ✓ Passo 9 concluído: Painel atualizou quantidades (Vídeos únicos prontos: ${animeQueueAfter.readyUniqueVideosCount}/30 | Faltam: ${animeQueueAfter.remainingToGoal} | Publicações nas redes: ${animeQueueAfter.platformPublicationsTotal}).`
    );

    // 10. Validar o tratamento de falhas (Duplicata na fila + Retenção sem simulação de publicação real)
    const dupEnqueueRes = await fetch(`${baseUrl}/api/pipeline/${pipelineId}/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_for: '2026-10-29T19:30',
        platforms_override: 'BOTH',
      }),
    });
    assert.strictEqual(dupEnqueueRes.status, 409, 'Passo 10a: Tentativa de enfileirar duplicata acidental deve ser bloqueada com HTTP 409');

    const firstQueueId = step8Data.queueIds[0];
    const dispatchCheckRes = await fetch(`${baseUrl}/api/queue/${firstQueueId}/dispatch`, {
      method: 'POST',
    });
    const dispatchCheckData = await dispatchCheckRes.json() as any;
    assert.notStrictEqual(
      dispatchCheckData.status,
      'PUBLISHED_OFFICIAL_API',
      'Passo 10b: Nunca simular publicação real sem confirmação oficial da plataforma'
    );
    assert.strictEqual(dispatchCheckData.status, 'AWAITING_CREDENTIALS', 'Deve indicar claramente a limitação de credenciais');
    console.log(`  ✓ Passo 10 concluído: Tratamento de falhas, bloqueio de duplicatas e não-simulação de publicação validados.\n`);

    console.log(`🎉 TODOS OS TESTES DAS 5 FASES + OS 10 PASSOS DO VIDEO PIPELINE PASSARAM COM SUCESSO!`);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});
