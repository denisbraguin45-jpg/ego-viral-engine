import { downloadCleanTikTokVideo } from './services/mediaDownloader.ts';
import { uploadToTikTokWeb } from './services/tiktokWebUploader.ts';
import { db } from './db.ts';

// Lista de URLs fornecida pelo usuário (removendo duplicados automaticamente)
const rawUrls = [
  "https://www.tiktok.com/@jxveed____/video/7621211523096038678",
  "https://www.tiktok.com/@.5htm/video/7677052539656834324",
  "https://www.tiktok.com/@zyroedltzz/video/7667967601976298773",
  "https://www.tiktok.com/@cineflixhd0/video/7705008317264923924",
  "https://www.tiktok.com/@zyroedltzz/video/7679138019689008404",
  "https://www.tiktok.com/@xerife.ae/video/7446519080795901189",
  "https://www.tiktok.com/@ae.guigo/video/7386802583291088133",
  "https://www.tiktok.com/@juninho_dx/video/7666218067029921045",
  "https://www.tiktok.com/@uxeiomp4/video/7688407713029606676",
  "https://www.tiktok.com/@vn_ed_/video/7592422803819810066",
  "https://www.tiktok.com/@mightyselly/video/7692814406144511253",
  "https://www.tiktok.com/@ji.09/video/7675497406946938132",
  "https://www.tiktok.com/@st1ngviuu/video/7638149816920345877",
  "https://www.tiktok.com/@vextr1/video/7695886924396907796",
  "https://www.tiktok.com/@jamessedits_/video/7686635948892785942",
  "https://www.tiktok.com/@ji.09/video/7684572514919484692",
  "https://www.tiktok.com/@edducore/video/7662839404775410962",
  "https://www.tiktok.com/@user_1232123210/video/7700727703724625175",
  "https://www.tiktok.com/@jamessedits_/video/7686635948892785942",
  "https://www.tiktok.com/@vextr1/video/7695886924396907796",
  "https://www.tiktok.com/@davidsemcafe/video/7630138102652095751",
  "https://www.tiktok.com/@obiaep18/video/7614978708708789536",
  "https://www.tiktok.com/@peakyediz/video/7674231080559463702",
  "https://www.tiktok.com/@clipzarr1/video/7704878044506361106",
  "https://www.tiktok.com/@az..13/video/7663947494702730512",
  "https://www.tiktok.com/@_randomsteven1/video/7682109256472005921",
  "https://www.tiktok.com/@s1mon.editz/video/7662784360256507158",
  "https://www.tiktok.com/@tallariks/video/7639868873826651408",
  "https://www.tiktok.com/@tweezyy69/video/7573039564160372023",
  "https://www.tiktok.com/@z3nith0_/video/7628991202561395988",
  "https://www.tiktok.com/@edducore/video/7662839404775410962"
];

// Remove duplicados preservando a ordem
const urls = Array.from(new Set(rawUrls));

async function runDirectBatchPosting() {
  console.log('=======================================================');
  console.log(`INICIANDO DISPARO DIRETO DE ${urls.length} VÍDEOS ENVIADOS PELO CHAT`);
  console.log('CONTA: @egotv00 | DESTINO: TikTok Studio');
  console.log('=======================================================');

  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  if (!account || !account.access_token) {
    console.error('Conta não encontrada ou sem token/cookie.');
    return;
  }

  const hooks = [
    "A cena que marcou época e continua insuperável 🎬🔥",
    "Essa atuação merece ser revista um milhão de vezes 🍿👁️",
    "A frieza e o foco absoluto de quem sabe o que faz 💀💼",
    "Um dos diálogos mais icônicos de toda a história das telas 🍷🎙️",
    "Quando o roteiro, a atuação e a trilha sonora se alinham com perfeição ⚡👏",
    "Aquela cena que te arrepia do começo ao fim 🏃‍♂️💥",
    "Presença pura: o momento mais tenso e marcante da obra 👑⚔️",
    "O personagem mais respeitado por um motivo muito claro 🧠🎯"
  ];

  for (let i = 0; i < urls.length; i++) {
    const videoUrl = urls[i];
    console.log(`\n---------------------------------------------------`);
    console.log(`[${i + 1}/${urls.length}] Processando: ${videoUrl}`);

    // 1. Download do vídeo limpo (sem marca d'água)
    console.log('Baixando MP4 limpo no disco local D:...');
    const dl = await downloadCleanTikTokVideo(videoUrl);
    if (!dl.success || !dl.filePath) {
      console.error(`Falha ao baixar vídeo ${videoUrl}:`, dl.error);
      continue;
    }
    console.log(`Vídeo baixado: ${dl.filePath}`);

    // 2. Legenda de alta conversão
    const hook = hooks[i % hooks.length];
    const caption = `🎬 ${hook}\n\n🍿 Assista a filmes e séries completos em 4K e sem anúncios na EGO TV!\n📲 Acesse o catálogo no link da bio @egotv00\n🔗 https://egotv.net/r/braghin\n\n#filmes #series #cenasdefilmes #cenasdeseries #filmeseseries #dicasdefilmes #cinema #EgoTV`;

    // 3. Postagem no TikTok Studio
    console.log('Enviando para o TikTok Studio...');
    const res = await uploadToTikTokWeb({
      filePath: dl.filePath,
      caption,
      sessionId: account.access_token,
      headless: true
    });

    if (res.success) {
      console.log(`[SUCESSO] Vídeo [${i + 1}/${urls.length}] postado com sucesso! (ID: ${res.publishId})`);
    } else {
      console.error(`[FALHA] Vídeo [${i + 1}/${urls.length}]:`, res.message);
    }

    if (i < urls.length - 1) {
      console.log('Aguardando 18 segundos antes do próximo envio...');
      await new Promise(r => setTimeout(r, 18000));
    }
  }

  console.log('\n=======================================================');
  console.log(`FINALIZADO: Lote de vídeos enviados processado com sucesso!`);
  console.log('=======================================================');
}

runDirectBatchPosting().catch(console.error);
