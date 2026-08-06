# syntax=docker/dockerfile:1
#
# Imagem ÚNICA que serve tanto o WEB (Next) quanto o WORKER (fila de jobs +
# Playwright). O docker-compose escolhe o comando de cada serviço a partir da
# mesma imagem — mais simples de operar num servidor só.
#
# A porta do WEB é sempre a variável de ambiente PORT (padrão 3000). Veja o
# docker-compose.yml e o .env.production.example para trocá-la.

# ---- base --------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
# wget: usado pelo healthcheck. ca-certificates: TLS p/ Supabase e provedores de IA.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates wget \
 && rm -rf /var/lib/apt/lists/*

# ---- deps: instala TODAS as dependências ------------------------------------
# O build precisa das devDependencies (tailwindcss e plugins, typescript) e o
# worker roda TypeScript via `tsx`, que também é devDependency.
#
# `--include=dev` é OBRIGATÓRIO aqui: o estágio `base` define NODE_ENV=production
# e, com isso, o `npm ci` OMITE as devDependencies por padrão. Sem a flag o build
# quebra em "Cannot find module 'tailwindcss'" — e só no servidor, porque em
# desenvolvimento as dependências já estão instaladas.
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev

# ---- builder: compila o Next -------------------------------------------------
FROM base AS builder
# As NEXT_PUBLIC_* são EMBUTIDAS no bundle do cliente em tempo de BUILD — por
# isso entram como build args. (Trocar NEXT_PUBLIC_SITE_URL exige rebuild.)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    # Placeholder só para o schema de env do servidor passar no build. O valor
    # REAL entra em runtime (env_file). Nenhum segredo real fica na imagem.
    SUPABASE_SERVICE_ROLE_KEY=build-time-placeholder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: imagem final (web + worker) ------------------------------------
FROM base AS runner
ENV PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Dependências completas (o worker roda .ts via tsx, que é devDependency).
COPY --from=deps /app/node_modules ./node_modules
# Artefatos do build + tudo que o worker precisa em runtime.
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/supabase ./supabase
# Chromium do Playwright (captura de prints por URL no worker) + libs do SO.
RUN npx playwright install --with-deps chromium \
 && chmod -R a+rx /ms-playwright
# LibreOffice (headless) — o worker converte PLANILHAS COM FLUXOGRAMAS em PDF para a IA
# ler por visão (bibliotecas JS de xlsx não renderizam a tela). Só o Calc + fontes.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libreoffice-calc fonts-dejavu fonts-liberation \
 && rm -rf /var/lib/apt/lists/*
# Roda como usuário não-root (o `node` já existe na imagem oficial).
RUN chown -R node:node /app
USER node
EXPOSE 3000
# Por padrão sobe o WEB. O serviço "worker" do compose troca este comando.
CMD ["npm", "run", "start:prod"]
