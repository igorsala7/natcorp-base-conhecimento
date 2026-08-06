# Deploy em produção (Docker)

A plataforma sobe em **dois serviços a partir da mesma imagem**:

| Serviço  | O que faz                                                            |
| -------- | ------------------------------------------------------------------- |
| `web`    | O Next.js (admin, portal público, APIs, widget, `/embed`).          |
| `worker` | A fila de jobs (importação, embeddings, ontologia, backups agendados, captura de prints com Playwright). |

O banco/Auth/Storage é o **Supabase** (Cloud ou self-hosted) — não sobe em container aqui.

---

## 1. Pré-requisitos

- Docker **24+** e Docker Compose v2 (`docker compose`).
- Um projeto **Supabase** com as chaves (URL, `anon`, `service_role`) e a URL de conexão do Postgres.
- Uma pasta no servidor com o código (via `git clone`).

## 2. Configurar o ambiente

```bash
cp .env.production.example .env
# edite o .env e preencha Supabase, segredos e a porta
```

Pontos-chave do `.env`:

- **`WEB_PORT`** — a porta publicada no servidor (o que você acessa). Mude aqui para trocar a porta.
- **`PORT`** — a porta interna do container (pode deixar `3000`).
- **`NEXT_PUBLIC_SITE_URL`** — a URL pública final (ex.: `https://docs.suaempresa.com.br`). É **embutida no build**: se mudar, reconstrua a imagem.
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `APP_ENCRYPTION_KEY`, `PORTAL_COOKIE_SECRET` — obrigatórios.

## 3. Aplicar as migrations no banco

> Só é necessário se o banco de produção for **novo** (vazio). Se produção usa o
> mesmo projeto Supabase que você já vinha migrando, **pule este passo**.

```bash
# Constrói a imagem primeiro (passo 4) e então, num banco NOVO, aplica tudo em ordem:
docker compose run --rm worker sh -lc 'npm run migrate:apply:prod -- supabase/migrations/*.sql'
```

As migrations estão numeradas por data, então o `*` já aplica na ordem certa.

## 4. Construir e subir

```bash
> **O `.env` precisa existir ANTES do build.** As `NEXT_PUBLIC_*` são embutidas no
> bundle do navegador em tempo de build (build args). Se o compose avisar
> `The "NEXT_PUBLIC_SUPABASE_URL" variable is not set`, ele vai construir uma
> imagem com string vazia e o app não conecta no Supabase pelo navegador — pare,
> preencha o `.env` e rode de novo.

docker compose up -d --build
```

Isso constrói a imagem (`natcorp-kb:latest`) e sobe `web` + `worker`. Acompanhe:

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f worker
curl -f http://localhost:${WEB_PORT:-3000}/api/health   # {"ok":true}
```

## 5. Criar o primeiro Owner

O primeiro usuário administrador nasce em dois passos (a regra de não-escalada
impede promover a si mesmo depois).

**a) Criar o usuário no Auth.** O mais simples é pelo painel do Supabase
(*Authentication → Add user*, com e-mail e senha). Alternativa por convite
(exige SMTP configurado):

```bash
docker compose run --rm web npm run seed:prod -- voce@empresa.com.br
```

**b) Promover a Owner:**

```bash
docker compose run --rm web npm run bootstrap:owner:prod -- voce@empresa.com.br
```

Agora entre em `NEXT_PUBLIC_SITE_URL/admin`.

---

## Trocar a porta

Edite o `.env`:

```dotenv
WEB_PORT=8080      # porta acessível no servidor
PORT=3000          # interna (pode manter)
```

e recarregue **sem rebuild** (a porta não é embutida no build):

```bash
docker compose up -d
```

> Atrás de um proxy reverso (Nginx/Traefik/Caddy), aponte o proxy para
> `web:${PORT}` (rede do compose) ou `localhost:${WEB_PORT}` (host) e finalize o
> HTTPS lá. Mantenha `NEXT_PUBLIC_SITE_URL` = URL pública final.

## Atualizar (deploy de nova versão)

```bash
git pull
docker compose up -d --build      # reconstrói e reinicia web + worker
```

Se novas migrations vieram no `git pull`, aplique apenas as novas (passo 3) ou,
num banco compartilhado com o dev, elas já estarão aplicadas.

## Operação do dia a dia

```bash
docker compose logs -f web worker     # logs
docker compose restart worker         # reiniciar só o worker
docker compose down                   # derrubar tudo (mantém o Supabase intacto)
docker compose exec web sh            # shell no container web
```

## Notas

- **Imagem única** (web + worker) por simplicidade: ela inclui o Chromium do
  Playwright (para a captura de prints por URL). Se você não usa essa captura,
  ainda funciona — só ocupa mais espaço.
- **Segredos**: o `.env` preenchido **não** entra na imagem (está no
  `.dockerignore`) nem no git (`.gitignore`). Só as `NEXT_PUBLIC_*` (públicas)
  são embutidas no bundle.
- **Healthcheck**: `GET /api/health` responde `{"ok":true}` — use no
  orquestrador/load balancer.
- **Server Actions atrás de proxy**: se algum botão "não fizer nada" atrás do
  proxy, garanta que o proxy repassa o header `Host`/`X-Forwarded-Host` correto
  (o Next valida a origem contra o Host por CSRF).
