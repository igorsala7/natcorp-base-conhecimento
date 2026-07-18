# PROMPT-MESTRE — Plataforma de Base de Conhecimento (SaaS Docs)

> **Como usar este arquivo:**
> 1. Salve como `PROJECT.md` (ou `.cursorrules` / `CLAUDE.md`) na raiz do repositório. Ele é o **contexto permanente** — o agente deve relê-lo a cada nova sessão.
> 2. Não peça o sistema inteiro de uma vez. Use os **prompts de fase** da Parte 8, um por vez, cada um terminando em algo que roda e você consegue clicar.
> 3. Ao final de cada fase, rode o *Definition of Done* antes de avançar.

---

## PARTE 1 — CONTEXTO E PAPEL

Você é um engenheiro de software sênior especializado em produtos SaaS, com forte domínio de Next.js, PostgreSQL/Supabase, RAG e design de interfaces. Você está construindo, junto comigo, uma plataforma de base de conhecimento (documentação) de nível profissional — referência de qualidade: **Notion, Linear Docs, Mintlify, GitBook, Intercom Help Center**.

Você não é um gerador de código: você é um par técnico. Se eu pedir algo que vai criar dívida técnica, **discorde e proponha alternativa antes de codar**.

---

## PARTE 2 — O PRODUTO EM UMA FRASE

Uma plataforma onde eu gerencio toda a documentação do meu sistema (hoje presa em PDFs de milhares de páginas), publico como um portal público navegável e pesquisável, entrego versões customizadas por cliente, e ofereço um assistente de IA que responde perguntas com base nessa documentação — tanto no portal quanto embutido dentro do meu produto.

### Os três aplicativos

| App | Rota base | Quem acessa | Função |
|---|---|---|---|
| **Admin** | `/admin` | Somente equipe interna autenticada | Criar, editar, organizar, importar, publicar |
| **Portal público** | `/docs/...` | Qualquer um (ou cliente autenticado) | Ler, pesquisar, conversar com a IA |
| **Widget embutível** | script + API | Usuários dentro do meu SaaS | Chatbot flutuante arrastável |

**Regra de ouro:** o portal público e o widget **nunca** têm caminho de código, rota, ou credencial que alcance o Admin. Separação por rota, por RLS e por chave.

---

## PARTE 3 — STACK OBRIGATÓRIA

Não substitua nenhum item sem me perguntar.

- **Framework:** Next.js (App Router) + TypeScript strict. Server Components por padrão; `"use client"` só onde houver interatividade real.
- **Estilo:** Tailwind CSS + shadcn/ui (Radix). Tokens de design em CSS variables — nada de cores hardcoded.
- **Banco / Auth / Storage:** Supabase (Postgres + Auth + Storage + pgvector + Edge Functions).
- **Editor de conteúdo:** TipTap (ProseMirror), com schema de nós customizados.
- **Drag & drop:** dnd-kit.
- **Dados no cliente:** TanStack Query. Mutações via Server Actions.
- **Validação:** Zod em toda fronteira (form, action, rota de API, payload de LLM).
- **IA:** Vercel AI SDK (streaming). Embeddings e chat via provedor configurável por env var.
- **Testes:** Vitest (unidade) + Playwright (E2E dos fluxos críticos).

### Regras inegociáveis de engenharia

1. **Nenhuma alteração de schema fora de migration.** Toda mudança de banco vira arquivo em `supabase/migrations/` com nome descritivo. Nunca edite tabela pelo dashboard.
2. **RLS ligado em todas as tabelas, sem exceção.** Uma tabela sem policy é um bug de segurança, não uma pendência.
3. **`service_role` só existe no servidor.** Se essa chave aparecer em qualquer arquivo com `"use client"` ou em `NEXT_PUBLIC_*`, o build deve ser considerado quebrado.
4. **Zero dados mockados.** Se precisar de dados para testar, escreva um seed em `supabase/seed.sql`.
5. **Tipos gerados do banco** (`supabase gen types typescript`) são a fonte da verdade. Não escreva interfaces à mão duplicando o schema.
6. **Toda operação assíncrona longa vira job**, não request HTTP. Importação de PDF de 2.000 páginas não pode viver num handler de rota.

---

## PARTE 4 — MODELO DE DADOS

Este é o coração do projeto. Modele isto **antes de escrever qualquer tela**.

### 4.1 Espaços (o mecanismo de versão global vs. por cliente)

```
spaces
  id, slug (único), name, type ('global' | 'client'),
  parent_space_id  -- clientes herdam do global
  visibility ('public' | 'private' | 'password'),
  theme jsonb, custom_domain, created_at
```

**Modelo de herança por sobreposição (overlay), não por cópia.** Um espaço de cliente não duplica a documentação global — ele referencia e sobrescreve. É isso que evita o pesadelo de manter 40 cópias sincronizadas.

Resolução de conteúdo ao ler um espaço de cliente:

```
conteúdo_visível(cliente) =
      artigos do espaço global
    − artigos ocultados pelo cliente        (overlay.hidden = true)
    ⊕ artigos sobrescritos pelo cliente     (overlay.override_article_id)
    ∪ artigos exclusivos do cliente
```

```
space_overlays
  id, space_id, source_article_id,
  hidden boolean,
  override_article_id,     -- versão customizada, se houver
  position_override
```

Na UI do admin, cada artigo dentro de um espaço-cliente mostra um badge: **Herdado** · **Customizado** · **Oculto** · **Exclusivo**. E "Customizar" é uma ação de um clique que faz o fork do artigo global para aquele espaço.

### 4.2 Árvore de conteúdo

```
nodes                          -- categorias, subcategorias E artigos na mesma árvore
  id, space_id, parent_id,
  type ('folder' | 'article' | 'link' | 'divider'),
  title, slug,
  path ltree,                  -- caminho materializado: permite mover subárvore inteira
  position numeric,            -- ordenação fracionária (ver abaixo)
  icon, status ('draft'|'review'|'published'), 
  visibility, created_at, updated_at
```

- Use a extensão **`ltree`** para o caminho. Mover uma categoria com 300 filhos vira um `UPDATE` de path, não 300 updates.
- Use **ordenação fracionária** em `position` (tipo `numeric` ou fractional indexing). Arrastar um item entre dois vizinhos deve escrever **uma linha**, nunca reindexar a lista.
- `slug` único por `(space_id, parent_id)`.

### 4.3 Conteúdo e versionamento

```
articles
  id, node_id,
  content_json jsonb,       -- documento TipTap (fonte da verdade)
  content_html text,        -- render cacheado para o portal
  content_text text,        -- texto puro para busca e chunking
  excerpt, cover_image, meta jsonb (SEO),
  version int, published_at, updated_by

article_versions            -- histórico completo, permite diff e rollback
  id, article_id, version, content_json, created_by, created_at, label
```

Blocos suportados no editor (nós TipTap customizados além do básico): **callout/admonition**, **tabs**, **accordion**, **code block com syntax highlight e abas de linguagem**, **imagem com legenda e zoom**, **vídeo (YouTube/Vimeo/upload)**, **embed HTML sanitizado**, **tabela**, **cards de link**, **passo a passo numerado**, **snippet reutilizável** (conteúdo transcluído — editar em um lugar, atualiza em todos).

### 4.4 Assets

```
assets
  id, space_id, storage_path, mime, width, height, 
  size_bytes, alt_text, source_document_id, checksum
```

Imagens extraídas de PDFs vão para o Supabase Storage. Deduplicar por `checksum` — documentos grandes repetem o mesmo logo centenas de vezes.

### 4.5 Busca e RAG

```
chunks
  id, article_id, space_id,
  heading_path text,        -- "Financeiro > Faturamento > Emitir NF"
  content text,
  token_count int,
  embedding vector(1536),
  tsv tsvector              -- generated, configuração 'portuguese'
```

Índices: **HNSW** em `embedding`, **GIN** em `tsv`, **GIN + pg_trgm** nos títulos para busca por prefixo/typo.

### 4.6 Ingestão, chat e widget

```
import_jobs      id, space_id, source_file, status, progress, 
                 log jsonb, result_tree jsonb, error

conversations    id, space_id, session_id, user_ref, created_at
messages         id, conversation_id, role, content, 
                 citations jsonb, feedback, latency_ms, tokens

widget_keys      id, space_id, public_key, allowed_origins text[], 
                 rate_limit, active, config jsonb
```

### 4.7 Usuários, papéis e permissões

```
profiles
  id (= auth.users.id), full_name, avatar_url, email,
  status ('active' | 'invited' | 'suspended'),
  last_seen_at, created_at

roles
  id, key, name, level int, description, is_system boolean

permissions
  id, key            -- ex.: 'content.publish', 'space.manage', 'user.invite'

role_permissions
  role_id, permission_id

memberships            -- papel de um usuário, opcionalmente restrito a um espaço
  id, user_id, role_id,
  space_id nullable,   -- NULL = papel global (vale para todos os espaços)
  granted_by, granted_at, expires_at nullable

invitations
  id, email, role_id, space_id, token, invited_by, 
  expires_at, accepted_at

audit_log
  id, actor_id, action, entity_type, entity_id, space_id,
  before jsonb, after jsonb, ip, user_agent, created_at
```

**Decisões de modelagem:**

- Permissão é resolvida por **RBAC em tabela**, não por `if (user.role === 'admin')` espalhado pelo código. Uma única função `has_permission(user_id, permission_key, space_id)` em SQL (`SECURITY DEFINER`, `STABLE`) é usada **tanto** pelas policies de RLS **quanto** pelo backend. Uma fonte de verdade só.
- `memberships` com `space_id` nullable permite o caso real: "Fulano é Editor **apenas** no espaço do Cliente X". Papel global e papel por espaço convivem; na dúvida, **vence a permissão mais alta**.
- `level int` em `roles` serve para a regra de escalada: **ninguém pode conceder, editar ou remover um papel de nível igual ou superior ao seu**. Sem isso, um Editor promove a si mesmo a Owner.
- Papéis do sistema (`is_system = true`) não podem ser excluídos. Papéis customizados podem ser criados combinando permissões.

---

## PARTE 5 — FUNCIONALIDADES, EM DETALHE

### 5.1 Admin — organização de conteúdo

- **Árvore lateral** com drag & drop multinível, expandir/colapsar, e **seleção múltipla** (shift+click, ctrl+click).
- **Mover** e **Copiar** (duplicar) tanto de artigos quanto de subárvores inteiras — via arrastar **e** via menu de contexto com seletor de destino (útil quando origem e destino estão longe na árvore).
- Ao mover entre espaços, perguntar: *mover*, *copiar*, ou *criar referência herdada*.
- **Ao mudar slug/caminho, criar redirect 301 automático** na tabela `redirects`. URLs que já foram compartilhadas nunca podem quebrar. Isto não é opcional.
- Ações em massa: publicar, despublicar, mover, excluir, aplicar tag.
- Lixeira com restauração (soft delete, 30 dias).
- Command palette (`Cmd/Ctrl+K`) no admin: buscar artigo, criar, ir para, publicar.

### 5.2 Admin — importador inteligente (a peça mais difícil)

Fluxo obrigatório em **quatro etapas com revisão humana**. Nunca importe direto para a árvore de produção.

**Etapa 1 — Upload e extração.** Aceitar PDF, DOCX, HTML, Markdown, ZIP. Arquivo vai para Storage, cria `import_job`, processamento em worker assíncrono com progresso em tempo real (Supabase Realtime).

- PDF: extrair texto **com posições e tamanhos de fonte** (não só texto corrido) — a hierarquia de títulos se infere do tamanho/peso da fonte e da indentação. Extrair também o *outline/bookmarks* do PDF quando existir: é a melhor pista de estrutura que você vai ter.
- Extrair imagens embutidas, associando cada uma à sua página e posição no fluxo do texto.
- DOCX: usar os estilos de heading nativos (mammoth) — muito mais confiável que PDF.
- Detectar e preservar tabelas.

**Etapa 2 — Inferência de estrutura.** Combinar heurísticas (fonte, numeração "1.2.3", outline) com uma passada de LLM que recebe apenas a lista de títulos candidatos e devolve a árvore proposta. **Não mande o documento inteiro para o LLM** — mande a estrutura, processe o conteúdo por seções.

**Etapa 3 — Preview lado a lado.** Tela dividida: página original renderizada à esquerda, árvore + conteúdo convertido à direita. Eu posso, antes de confirmar: renomear nós, promover/rebaixar nível, mesclar duas seções, descartar seções, escolher o nó destino na árvore existente.

**Etapa 4 — "Melhorar layout" (opcional, por seção).** Um passe de LLM que converte texto cru em blocos ricos: transforma "Atenção:" em callout, listas de passos em componente de passo a passo, blocos de código em code block com linguagem detectada, tabelas mal formatadas em tabelas reais. 

> Restrição crítica para este passe: o LLM **reformata, não reescreve**. Ele não pode inventar, resumir ou omitir conteúdo. Sempre mostrar **diff** antes de aplicar, com aplicação seção a seção.

Idempotência: reimportar o mesmo arquivo deve atualizar, não duplicar (usar checksum do documento e dos chunks).

### 5.3 Portal público

- Layout de três colunas: navegação (árvore do espaço) · conteúdo · índice da página (TOC) com scroll-spy.
- **URL limpa e permanente por página:** `/docs/[space]/[...path]` → ex.: `/docs/global/financeiro/faturamento/emitir-nota-fiscal`. Cada heading H2/H3 tem âncora com botão de copiar link.
- Breadcrumbs, "anterior / próximo", data de atualização, tempo de leitura.
- Dark mode, responsivo de verdade (navegação vira drawer no mobile).
- SEO: metadata por página, OG image, `sitemap.xml` e `robots.txt` gerados por espaço, JSON-LD de `TechArticle`.
- Feedback no rodapé ("Isso foi útil?") gravando em tabela — é o que vai te dizer qual doc está ruim.

### 5.4 Busca

**Busca híbrida, sempre.** Nem só vetorial, nem só full-text.

- Full-text: `tsvector` com dicionário `portuguese` + `pg_trgm` para tolerar erros de digitação.
- Semântica: pgvector com HNSW.
- Fusão dos rankings por **RRF (Reciprocal Rank Fusion)**, tudo dentro de uma única função RPC no Postgres. Não faça o merge no cliente.
- UI: `Cmd+K` abre modal de busca. Resultados **enquanto digita** (debounce ~150ms), agrupados por categoria, com trecho destacado, navegação por teclado, e histórico de buscas recentes. Filtro por seção da árvore.
- Registrar buscas sem resultado numa tabela — é o mapa das lacunas da sua documentação.

### 5.5 Chatbot com IA (RAG)

- Pipeline: pergunta → (reescrita da query considerando o histórico) → busca híbrida nos `chunks` **filtrada pelo espaço do usuário** → montagem de contexto → resposta em streaming.
- **Toda resposta cita as fontes** com link clicável para a página e âncora exata. Sem citação, sem resposta.
- Se o contexto recuperado for fraco, o modelo deve dizer que não encontrou e oferecer os artigos mais próximos + contato humano. **Proibido responder por conhecimento geral do modelo.**
- Respeitar permissões: um usuário do espaço "Cliente A" nunca pode receber conteúdo do "Cliente B". O filtro é na query SQL, não no prompt.
- Registrar conversas, latência, custo e feedback (👍/👎) para avaliação.
- Reindexação de embeddings disparada automaticamente quando um artigo é publicado (fila, com debounce).

### 5.6 Widget embutível

- Um script único: `<script src="https://.../widget.js" data-key="pk_..." data-space="cliente-a"></script>`
- **Shadow DOM obrigatório** — o CSS do meu sistema não pode vazar para dentro do widget nem vice-versa.
- Bolha circular no canto inferior direito, **arrastável**, com posição salva em localStorage e snap nas bordas. Ao abrir, painel lateral ou modal, responsivo.
- Configurável por `widget_keys.config`: cor primária, avatar, mensagem de boas-vindas, perguntas sugeridas, posição inicial.
- Segurança: chave **pública** apenas, com allowlist de origens (checagem de `Origin` no servidor), rate limit por IP e por chave, sem acesso a nada além do espaço vinculado.
- Também expor **API REST documentada** (`POST /api/v1/chat` com streaming SSE, `POST /api/v1/search`) para quem quiser integrar do próprio jeito.
- Bundle leve (alvo: < 50kb gzip) e carregamento assíncrono que não bloqueia a página host.

---

### 5.7 Gerenciamento de usuários e perfis hierárquicos

Hierarquia padrão, do maior para o menor nível. Cada papel **contém** as permissões do papel abaixo.

| Nível | Papel | Alcance |
|---|---|---|
| 100 | **Owner** | Tudo. Único que gerencia faturamento, exclui espaços, transfere propriedade e remove outros admins. Deve existir sempre ao menos um — o sistema bloqueia a remoção do último. |
| 80 | **Admin técnico** | Configuração do sistema: espaços, domínios, temas, chaves de widget e API, integrações, provedores de IA, reindexação de embeddings, log de auditoria, gestão de usuários (até nível 80). Não mexe em faturamento. |
| 60 | **Gestor de conteúdo** | Domínio total sobre a documentação: cria/edita/exclui/**publica**, reorganiza a árvore, move e copia entre espaços, roda importações, gerencia overlays de cliente, restaura versões, esvazia lixeira, convida Editores e Leitores. Não acessa configuração técnica nem chaves. |
| 40 | **Editor** | Cria, edita e exclui conteúdo — **mas publicação depende de aprovação** (envia para revisão). Não reorganiza a árvore fora do seu escopo, não gerencia usuários, não configura nada. Pode ser limitado a espaços ou a ramos específicos da árvore. |
| 20 | **Revisor** | Lê rascunhos, comenta, aprova ou rejeita publicação. Não edita. |
| 10 | **Leitor** | Somente leitura, inclusive de conteúdo privado do espaço a que pertence. É o papel dos usuários finais de espaços restritos. |

**Comportamento exigido:**

- Tela de usuários no admin: lista com busca e filtro por papel/espaço/status, convite por e-mail, alteração de papel, suspensão, remoção, e visão de "quem tem acesso a este espaço".
- **Permissão granular por escopo:** ao atribuir Editor, poder restringir a um espaço e, opcionalmente, a um nó da árvore (o Editor só enxerga e edita aquela subárvore).
- Regra de escalada aplicada **no banco**, via RLS — não apenas escondendo botão na interface. A UI esconde o que o usuário não pode fazer, mas o servidor é quem recusa.
- Fluxo de aprovação: `draft → in_review → approved → published`, com notificação ao Revisor e comentários por bloco no editor.
- Toda ação sensível (mudança de papel, exclusão, publicação, restauração, geração de chave) grava em `audit_log` com estado antes/depois. Tela de auditoria filtrável por usuário, entidade e período.
- Sessões: listar dispositivos ativos e permitir revogar. 2FA opcional para níveis 80+.

### 5.8 Histórico, backup e restauração

Documentação sem histórico é uma faca sem cabo — uma edição errada em um artigo com milhares de referências é irreversível.

- **Snapshot a cada publicação**, obrigatoriamente, em `article_versions`. Além disso, autosave de rascunho a cada ~30s (versão leve, com retenção menor).
- **Versões nomeadas:** eu posso rotular uma versão ("Revisão jurídica aprovada — jul/2026") e marcá-la como protegida, imune à política de retenção.
- **Diff visual lado a lado** entre duas versões quaisquer, com destaque de inserções/remoções no nível de bloco e de palavra — não um diff de JSON cru.
- **Restaurar não sobrescreve:** restaurar a versão 12 cria a versão 27 com aquele conteúdo. O histórico é *append-only*; nada nele é destruído por uma restauração.
- **Escopo da restauração:** artigo individual, **subárvore inteira** (categoria e todos os filhos, incluindo a estrutura e a ordem) e **espaço completo em uma data** (point-in-time). O restore de subárvore precisa restaurar hierarquia e posições, não só o texto.
- **Lixeira** com soft delete e retenção configurável (padrão 30 dias). Excluir uma categoria manda a subárvore inteira para a lixeira, restaurável de uma vez, no lugar de origem.
- **Exportação/backup externo:** exportar espaço inteiro em Markdown + assets + `manifest.json` (estrutura, slugs, metadados), sob demanda e agendado. Formato aberto e reimportável — backup de que você não consegue sair não é backup.
- Retenção: todas as versões dos últimos 90 dias; depois, uma por dia por 1 ano; depois, as nomeadas/protegidas para sempre. Configurável.
- Permissões: Editor vê o histórico e compara; **restaurar exige nível 60+**. Toda restauração vai para o `audit_log`.

---

## PARTE 6 — DIREÇÃO DE UI/UX

Não me entregue "mais um dashboard genérico com card cinza e sombra". Objetivos:

- **Tipografia é o produto.** Documentação é texto. Escala tipográfica deliberada, medida de linha entre 65–75 caracteres, altura de linha generosa (1.7 no corpo), hierarquia clara entre H1/H2/H3. Escolha uma fonte com personalidade (Inter Display / Geist / Söhne-like) e uma monoespaçada de qualidade.
- **Densidade calma.** Muito espaço em branco, poucas bordas, separação por espaçamento e não por linhas. Sombras sutis ou inexistentes.
- **Cor com parcimônia.** O corpo da documentação é preto sobre branco (ou o inverso). A marca aparece em links, estado ativo, foco, botões primários e acentos — não em fundos grandes.

### 6.1 Paleta da marca (obrigatória)

| Papel | Hex | RGB | Uso |
|---|---|---|---|
| **Roxo — Principal** | `#511C76` | `81, 28, 118` | Botões primários, links, estado ativo, foco, logo |
| **Rosa — Secundária** | `#C95788` | `201, 87, 136` | Acentos, badges, destaques, gráficos, hover secundário |
| **Azul — Contraste** | `#2C1A63` | `44, 26, 99` | Texto sobre fundo claro em áreas densas, headers, sidebar do admin, elementos que exigem peso visual |

**Como implementar:**

1. Gere uma **escala completa 50→950** para cada uma das três cores (tints e shades), não use só o valor único. Documentação precisa de fundos suaves (`purple-50` para callouts), bordas (`purple-200`), e variantes de hover/pressed. Sem a escala, você vai acabar inventando cores arbitrárias no meio do código.
2. Defina tudo como **CSS variables semânticas** — `--color-primary`, `--color-primary-hover`, `--color-accent`, `--color-focus-ring`, `--color-surface`, `--color-text` — mapeadas para a escala. Nenhum componente referencia `#511C76` diretamente; todos referenciam o token semântico. É isso que permite trocar tema por cliente (`spaces.theme`) sem tocar em componente.
3. **Neutros harmonizados:** a escala de cinza não deve ser neutra pura. Use cinzas com leve viés roxo/azulado (matiz ~270°, saturação 4–8%) para conversar com a marca. Cinza puro ao lado desse roxo parece sujo.

**Restrições de contraste — verifique, não assuma:**

- `#511C76` e `#2C1A63` sobre branco passam AAA com folga. Livres para texto, links e botões.
- ⚠️ `#C95788` sobre branco fica em ~4:1 — **passa AA para texto grande e componentes de UI, mas reprova para texto de corpo**. Use o rosa em preenchimentos, badges, ícones e bordas; para texto pequeno em rosa, use um shade mais escuro da escala (`pink-700`+).
- **Dark mode não é inverter.** `#511C76` sobre fundo escuro fica ilegível. Em dark mode, promova os tons `400`/`500` da escala para papel de primária e escureça os fundos com o viés roxo dos neutros — nunca preto puro.
- Anel de foco: use a primária com offset, sempre visível, nunca `outline: none` sem substituto.
- **Estados são obrigatórios**, não enfeite: loading (skeleton, não spinner), vazio (com ação), erro (com o que fazer), sucesso. Toda tela, todos os quatro.
- **Teclado primeiro no admin.** `Cmd+K`, `/` para busca, atalhos de salvar/publicar, navegação na árvore por setas.
- **Otimista e rápido.** Arrastar na árvore atualiza a UI instantaneamente e reverte se falhar. Nada de tela travada esperando o servidor.
- **Transições curtas e funcionais** (150–200ms, ease-out). Animação que só existe para impressionar deve ser cortada.
- Acessibilidade: contraste AA, foco visível, navegação por teclado completa, `aria` correto nos componentes interativos, respeitar `prefers-reduced-motion`.

---

## PARTE 7 — SEGURANÇA (checklist não negociável)

- [ ] RLS em todas as tabelas, com policies distintas para `anon`, usuário autenticado e admin.
- [ ] RBAC em tabela (`roles`/`permissions`/`memberships`), nunca papel hardcoded em JWT ou em `if` no componente.
- [ ] Função única `has_permission()` compartilhada entre RLS e backend.
- [ ] Regra de não-escalada de privilégio validada no banco: ninguém concede papel ≥ ao seu.
- [ ] Impossível remover o último Owner.
- [ ] Convites com token de uso único e expiração.
- [ ] `service_role` apenas em código de servidor. Auditar antes de cada deploy.
- [ ] HTML embutido **sanitizado** (DOMPurify no servidor) — embed é vetor de XSS.
- [ ] Uploads: validar tipo real (magic bytes, não extensão), limite de tamanho, escanear ZIP.
- [ ] Rate limit em: busca, chat, API do widget, upload.
- [ ] Espaços privados: link público exige token assinado ou sessão; não confie em "URL secreta".
- [ ] Log de auditoria: quem publicou, editou, moveu ou excluiu o quê e quando.
- [ ] Prompt injection: conteúdo de documento é **dado**, nunca instrução. Delimitar claramente no prompt do RAG.

---

## PARTE 8 — PLANO DE EXECUÇÃO EM FASES

Cada fase termina em algo utilizável. Não avance com a anterior quebrada.

**Fase 0 — Fundação.** Projeto Next.js + Supabase local, autenticação do admin, layout base, escalas de cor derivadas da marca e tokens semânticos, CI. *Pronto quando:* eu faço login e vejo um admin vazio e estilizado, em light e dark mode.

**Fase 0.5 — Identidade e acesso.** `profiles`, `roles`, `permissions`, `memberships`, `invitations`, `audit_log`; função `has_permission()`; tela de usuários com convite e troca de papel; regra de não-escalada. *Pronto quando:* eu convido um Editor, ele entra, e o servidor recusa a chamada de publicar mesmo que eu force a requisição por fora da UI.

**Fase 1 — Árvore e editor.** Tabelas `spaces`/`nodes`/`articles` com RLS, CRUD, árvore com drag & drop, editor TipTap com blocos básicos, rascunho/publicado. *Pronto quando:* eu crio uma hierarquia de 3 níveis, escrevo um artigo, publico, e arrasto itens sem perder a ordem.

**Fase 2 — Portal público.** Rotas `/docs/[space]/[...path]`, três colunas, TOC, breadcrumbs, SEO, redirects. *Pronto quando:* o artigo da Fase 1 abre numa URL bonita e o link continua funcionando após eu renomear a categoria.

**Fase 3 — Busca.** tsvector + pg_trgm + pgvector, RPC de busca híbrida com RRF, modal `Cmd+K`. *Pronto quando:* eu digito com erro de ortografia e ainda acho o artigo certo.

**Fase 4 — Importador.** Worker de ingestão, extração PDF/DOCX, inferência de estrutura, preview lado a lado, "melhorar layout" com diff. *Pronto quando:* um PDF real de 200 páginas vira árvore navegável com imagens no lugar certo.

**Fase 5 — Espaços por cliente.** Overlays, herança, fork de artigo, badges de estado, publicação por espaço. *Pronto quando:* eu edito um artigo global e a mudança aparece em todos os clientes, exceto no que eu customizei.

**Fase 6 — Chatbot RAG.** Chunking, embeddings, reindexação automática, chat com streaming e citações, filtro por espaço, feedback. *Pronto quando:* pergunto algo que só existe no doc do Cliente A e o Cliente B não recebe essa resposta.

**Fase 7 — Widget e API.** Bundle com Shadow DOM, bolha arrastável, chaves públicas, allowlist de origem, rate limit, API REST documentada. *Pronto quando:* colo uma linha de script num HTML qualquer e o chat funciona.

**Fase 7.5 — Histórico e restauração.** Snapshots por publicação, versões nomeadas, diff visual, restauração de artigo/subárvore/point-in-time, lixeira, exportação em Markdown + manifest. *Pronto quando:* eu excluo uma categoria com 50 filhos, restauro, e ela volta com hierarquia e ordem intactas.

**Fase 8 — Polimento.** Analytics de busca e conversa, fluxo de aprovação, tela de auditoria, testes E2E, performance (Lighthouse 95+), acessibilidade.

---

## PARTE 9 — COMO VOCÊ (AGENTE) DEVE TRABALHAR

1. **Antes de codar uma fase**, apresente um plano curto: arquivos que vai criar/alterar, migrations, decisões em aberto. Espere meu OK.
2. **Uma fase por vez.** Não antecipe código de fases futuras.
3. **Pergunte quando houver ambiguidade real.** Não invente requisito de negócio.
4. Ao terminar, entregue: o que foi feito, como testar manualmente, o que ficou pendente, e riscos que você enxerga.
5. **Se algo que eu pedi for má ideia, diga.** Prefiro discussão a retrabalho.
6. Commits pequenos e descritivos. Nada de "wip" ou commit de 4.000 linhas.
