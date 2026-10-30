import { db } from './db.ts';

const approved = db.prepare(`
  SELECT 
    vpi.id,
    vpi.title,
    vpi.source_url,
    vpi.pipeline_state,
    vpi.known_metrics_json
  FROM video_pipeline_items vpi
  WHERE vpi.channel_id = 'ego-filmes' AND vpi.pipeline_state = 'PRONTO_PARA_PUBLICACAO'
`).all() as any[];

console.log('APPROVED_VIDEOS_READY_FOR_EGOTV00:');
approved.forEach((v, idx) => {
  const m = JSON.parse(v.known_metrics_json || '{}');
  console.log(`${idx + 1}. [${m.views?.toLocaleString('pt-BR')} views] [${m.creator}] ${v.title.slice(0, 70)}...`);
});
