# Catalogo de correcoes

Uma correcao por achado. Toda entrada traz o risco, porque recomendacao sem risco declarado e propaganda.

## Cache com taxa zero ou baixa

**Correcao.** Reordene a requisicao: `[persona + regras + schemas de tools]` → breakpoint → `[data, usuario, sessao, ontologia resolvida, chunks de RAG, historico]`. Garanta ordem deterministica no array de tools (`ORDER BY` explicito na query, nao iteracao sobre dict).

**Risco.** Baixo. Nao muda o que o modelo ve, so a ordem. Verifique que nenhuma regra dependia de vir depois de um dado dinamico.

**Validacao.** `cache_read_input_tokens` sobe no turno seguinte. Confirme com `cache_check.py`.

---

## Chamadas ao modelo sem tool call nem resposta final

**Correcao.** Ache a instrucao que gera a iteracao vazia. Suspeitos: "verifique antes de responder", "reflita sobre qual ferramenta usar", "confirme que tem todos os dados". Remova e meça.

**Risco.** Medio. Alguma dessas instrucoes pode estar segurando erro real. Rode o eval antes de remover em producao.

**Validacao.** Mediana de `chamadas_por_turno` cai; acuracia no eval nao cai junto.

---

## Resultado de tool inflando o contexto entre iteracoes

**Correcao.** Depois que o modelo consumiu o resultado, substitua no historico por digest (contagem, agregados, ids). Projete campos na origem -- se o modelo precisa de 3 colunas, nao devolva 40.

**Risco.** Medio-alto. Se o usuario fizer follow-up sobre uma linha especifica que o digest descartou, a resposta degrada. Mitigue guardando o resultado completo fora do contexto, recuperavel por id.

**Validacao.** `crescimento` por turno cai; follow-ups no eval continuam corretos.

---

## Excesso de tools por agente

**Correcao, em ordem de preferencia.**

1. **Subdividir por subdominio.** Alvo de 8–12 tools por agente. Melhor opcao quando os subdominios sao obvios e as consultas raramente cruzam.
2. **Catalogo com busca semantica.** Tools viram indice; retrieval carrega 5–8 candidatas por turno. Escala melhor, mas adiciona ponto de falha.
3. **Tools hierarquicas.** Poucas tools de dominio que expandem. Bom quando ha estrutura natural em arvore.

**Risco.** Alto. O roteador vira novo ponto de falha: se erra o dominio, a tool certa fica invisivel e o modelo nao tem como se recuperar. Sempre inclua rota de escape para o conjunto completo, e otimize o roteador para recall, nao precisao.

**Validacao.** Acuracia de selecao **sobe** (menos candidatas confundiveis) enquanto os schemas por chamada caem. Se a acuracia cair, o roteador esta errando -- meça o roteador isoladamente antes de culpar a divisao.

---

## Tools com sobreposicao confirmada pelo eval

**Correcao.** Escolha uma:
- **Fundir** numa tool com parametro discriminante, quando a diferenca e so de filtro.
- **Opor as descricoes** explicitamente: cada uma diz o que faz *e* quando usar a outra ("para historico consolidado use X; esta aqui retorna apenas lancamentos em aberto").
- **Separar em dominios** que nunca carregam juntos.

**Risco.** Baixo para reescrita, medio para fusao (muda o contrato, exige mexer no orquestrador).

**Validacao.** Erros naquele par especifico caem no eval. Confira que nao migraram para outro par.

---

## Ontologia dentro do system prompt

**Correcao.** Vire etapa de resolucao antes da chamada: tabela de aliases + embeddings para fuzzy. Injete so os termos canonicos resolvidos. No Supabase, `pgvector` ja cobre isso; alias exato resolve por indice comum e sai mais barato e mais rapido.

**Risco.** Medio. Termo que a resolucao nao cobre deixa de ser entendido -- antes o modelo improvisava a partir do bloco inline. Logue os misses e trate como backlog vivo.

**Validacao.** Camada `ontologia` some da contagem por camada. Taxa de resolucao monitorada em producao.

---

## RAG carregado em todo turno

**Correcao.** Condicione a intencao. Consulta de dado puro nao precisa da documentacao; ela entra em "como faço", "onde ajusto", "por que". Consulta multi-etapa vira plano explicito, cada passo carregando so o que precisa.

**Risco.** Medio. Classificacao de intencao erra, e a resposta perde a parte de orientacao. Na duvida, o classificador deve carregar -- falso positivo custa tokens, falso negativo custa resposta errada.

**Validacao.** Turnos sem RAG ficam mais baratos; perguntas de orientacao no eval continuam corretas.

---

## System prompt grande demais

**Ultimo item da lista, sempre.** Menor retorno, maior risco de regressao silenciosa.

**Correcao.** Mova instrucao de uso de tool para dentro da descricao da tool -- duplicar no prompt e desperdicio puro, ja que o schema e tokenizado de qualquer jeito. Corte few-shots que nao correspondem a falha observada. Remova hedge que o modelo ja segue por padrao.

**Risco.** Alto e insidioso. Cada linha removida pode ser a que impedia um erro raro, e voce so descobre em producao. Nao mexa sem eval set.

**Validacao.** Acuracia identica ou superior no eval. Se nao houver eval, nao faça essa correcao.
