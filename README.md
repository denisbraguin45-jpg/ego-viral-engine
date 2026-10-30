# EGO VIRAL ENGINE — Documentação Operacional, Instalação & Credenciais

Aplicação web independente de inteligência, curadoria autorizada, controle de direitos autorais, preparação de metadados, fila de publicação e atribuição comercial da **Ego TV**.

---

## 1. Arquitetura e Stack Implementada

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 (Interface escura minimalista estilo *AI Operational Console*).
- **Backend:** Node.js + Express + TypeScript (`server/index.ts`).
- **Banco de Dados Persistente:** SQLite nativo (`node:sqlite` -> `data/ego_viral_engine.sqlite`), zero dependência de binários externos, com integridade referencial (`FOREIGN KEYS`).
- **Autenticação:** JWT (`jsonwebtoken`) + Hashing de senhas (`bcryptjs`).
- **Upload & Deduplicação:** `multer` + Hash criptográfico `SHA-256` de cada vídeo enviado para bloqueio automático de arquivos duplicados.

---

## 2. Instalação e Execução

No terminal (Windows CMD ou PowerShell):

```bash
cd C:\Users\denis\.gemini\antigravity\scratch\ego-viral-engine

# 1. Instalar dependências (já instaladas)
npm.cmd install

# 2. Executar bateria de testes automatizados (Fases 1 a 5)
npm.cmd test

# 3. Iniciar Backend (Porta 3333) + Frontend (Porta 5173) simultaneamente
npm.cmd run dev
```

Acesse no navegador:
- **Painel Operacional (Frontend):** `http://localhost:5173`
- **API Backend:** `http://localhost:3333/api/dashboard`
- **Credenciais de Operador Padrão:**
  - **E-mail:** `admin@egotv.com.br`
  - **Senha:** `egotv2026`

---

## 3. Configuração das Integrações Oficiais (`.env`)

Edite o arquivo `.env` na raiz do projeto quando obtiver a aprovação dos aplicativos nas plataformas:

```env
PORT=3333
JWT_SECRET=ego-tv-super-secret-jwt-key-2026
EGO_TV_DESTINATION_URL=https://egotv.com.br/assinar

# 1. YouTube Data API v3 (Opcional para busca estendida no Viral Radar)
YOUTUBE_API_KEY=

# 2. TikTok Content Posting API v2 (Para as 3 contas do TikTok)
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=

# 3. Meta / Instagram Graph API - Reels Publishing (Para as 3 contas do Instagram)
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
```

### Procedimento de Homologação Externa:
1. **TikTok for Developers (`https://developers.tiktok.com`):**
   - Criar aplicativo, habilitar o produto *Content Posting API* e solicitar os escopos `user.info.basic`, `video.upload` e `video.publish`.
   - Enquanto as chaves não estiverem ativas, a fila de publicação retém os itens com o status transparente `AWAITING_CREDENTIALS` (nunca simula uma publicação falsa).
2. **Meta for Developers (`https://developers.facebook.com`):**
   - Criar aplicativo do tipo *Business*, adicionar o produto *Instagram Graph API* e solicitar as permissões `instagram_basic`, `instagram_content_publish` e `pages_read_engagement`.
   - Vincular as 3 contas (`@egofilmes.tv`, `@egoanime.tv`, `@egoseries.tv`) como contas comerciais/criador a uma Página do Facebook.
