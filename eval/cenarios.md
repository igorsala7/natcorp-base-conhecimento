# Cenários com contexto — 2026-08-19 23:20

3 casos remontados com histórico, tela e as ferramentas que o funil realmente entregou.

| modelo | ferramenta | pergunta | perguntou demais | de menos | tok in | US$/1k | s |
|---|---|---|---|---|---|---|---|
| `google:gemini-3.5-flash` | 2/3 (67%) | 1/3 (33%) | 0 | 2 | 5227 | 12.99 | 3.9 |

## Falha de funil — nenhum modelo pode passar nestes

- **"quais sao os meus dados cadastrais?"** precisava de `meus_dados` — inequívoco — perguntar aqui é o excesso que irrita
- **"Agora gere um PPT e Word"** precisava de `gerar_relatorio` — mesmo conteúdo, outros formatos — perguntar é fazer o usuário repetir o que já disse
- **"preencha esse campo com a descrição das atividades  para o cargo de co"** precisava de `preencher_campo` — DEFEITO: preencher_campo não chegou ao modelo (formAssist), e ainda gastou um turno perguntando a fonte
- **"Compara com o mês de Abril"** precisava de `historico_financeiro` — 
- **"Pode enviar"** precisava de `ms_email_enviar` — DEFEITO GRAVE: confirmação pendente do turno anterior e ms_email_enviar sumiu do turno seguinte (só vieram tools de tela). Confirmação pendente tem que fixar a tool, acima do teto
- **"Informe a empresa 700 e matrícula 205818"** precisava de `preencher_campo` — "informe" = PREENCHER os campos do formulário em tela, não consultar e mostrar
- **"Preencha pra mim, a empresa 700, matrícula 205818, situação de pedido "** precisava de `preencher_campo` — preencher TUDO, inclusive a justificativa — o gestor revisa antes de salvar
- **"Qual o colaborador com maior quantidade de benefícios?"** precisava de `agrupar` — a tela É de benefícios com 380 colaboradores — responde da tela. Se a coluna não estivesse lá: avisar que não está no relatório, oferecer continuar/cancelar, e ao continuar HERDAR os filtros da página como parâmetros da tool (empresa/filial/CC), confirmando o recorte

## Onde erraram ou discordaram

**"Crie um template de documento de contrato de admissão de contrato dete"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"requisição de férias"** — esperado `ferias_criar`

- ❌ `google:gemini-3.5-flash` → ferias_situacao

**"Explique o que e o motor de blocos do editor"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)

