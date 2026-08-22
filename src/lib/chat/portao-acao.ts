/**
 * PORTÃO DE AÇÃO — tirar a escolha do modelo quando não há escolha a fazer.
 *
 * O defeito medido: em 18 dos 36 erros de roteamento a ferramenta certa ESTAVA
 * na mesa e o agente não a chamou. Onze desses turnos têm até 6 palavras
 * ("excel", "Faz em pdf", "Tudo junto"), e o acerto em mensagens curtas é de
 * 6/22 (27%) contra 13/26 (50%) nas longas.
 *
 * ── Por que não é mais um texto de prompt ───────────────────────────────────
 * Este projeto já mediu duas vezes que diretiva quase não move: DIRETIVA_PERGUNTAR
 * levou "perguntou de menos" de 10 para 8 num modelo e nada nos outros dois
 * (`perguntar.ts`), e a bancada mostra 66 dos 81 casos com a pergunta REPETIDA
 * dentro do próprio histórico — a ênfase máxima concebível já está ligada em 81%
 * do conjunto e o eixo de ferramenta continua em 41–45 de 74. O que moveu os dois
 * eixos foram PORTÕES (`periodo.ts` no execute, `entrega.ts` antes do modelo).
 *
 * A lição escrita em `perguntar.ts` vale aqui: onde a regra é enumerável, portão.
 * O mecanismo não é texto, é o `toolChoice` do provedor, que retira do modelo a
 * opção de NARRAR a ação em vez de executá-la ("Vou consultar seu histórico…"
 * sem nenhuma chamada foi o desfecho real de 7 dos 18).
 *
 * ── UMA regra, e o que ela custou para ser aceita ───────────────────────────
 * FORMATO — a mensagem é só recipiente ("excel", "Faz em pdf", "Agora gere um
 * PPT e Word") e o conteúdo já foi entregue antes. Medida contra os 131 casos de
 * `eval/cenarios.jsonl`: dispara em 4, e nos 4 o gabarito pede exatamente
 * `gerar_relatorio`. Zero falso positivo no conjunto inteiro. Medida contra 25
 * dias de `ai_chat_traces` (1.400 turnos): dispara em 14 (1,0%), dos quais 5 já
 * chamavam o gerador sozinhos — o portão MUDA 9 turnos, e nos 9 a mensagem é
 * literalmente "Faça um pdf" / "Faz em pdf" / "excel" / "GERAR PDF" com o agente
 * não chamando nada. Quatro deles morreram em `clarify_tool`.
 *
 * ── A regra ÚNICA foi MEDIDA E DESCARTADA ───────────────────────────────────
 * "O funil entregou UMA ferramenta de integração, logo não há o que discriminar"
 * parece a regra mais segura possível, e na bancada ela é: dispara em 6 dos 74
 * casos e acerta 6/6. A bancada, porém, não tem poder nenhum para reprovar essa
 * regra — NENHUM dos seus disparos cai num caso de `espera_tool: null`, que é
 * exatamente onde ela erra.
 *
 * Contra a produção o veredito se inverte. Em 25 dias a regra dispararia em 146
 * turnos (10,7% dos turnos com ferramenta) e MUDARIA o comportamento de 86.
 * Nos últimos 7 dias são 22 turnos mudados, e ao olhar o que o agente fez neles:
 *
 *   "Qual ocorrência tem o maior valor?"        → fez `consultar_registros`  (certo)
 *   "Quantas são do tipo Provento?"             → fez `consultar_registros`  (certo)
 *   "Analise esse relatório"                    → fez `agrupar` ×4           (certo)
 *   "Crie um PDF com essa analise…"             → fez `gerar_relatorio`      (certo)
 *   "Cria um PDF com essas informações…"        → fez `gerar_relatorio`      (certo)
 *
 * Catorze dos 22 já faziam a coisa certa com ferramenta LOCAL sobre o dado que
 * já estava na mesa. A regra ÚNICA substituiria essas chamadas por uma consulta
 * de cadastro ao ERP — e nos dois casos de PDF ela atropelaria justamente o
 * `gerar_relatorio` que este portão existe para garantir. Ou seja: ela fabrica,
 * em escala, o balde "chamou algo devendo não chamar nada", que já custa 7 dos
 * 36 erros. Vinte e duas vezes mais exposição em produção do que evidência na
 * bancada, na direção errada. Fica de fora.
 *
 * ── O que também ficou de fora ──────────────────────────────────────────────
 * INSISTÊNCIA ("Mas eu desde o início estou pedindo…", "volte a trazer…"). A
 * regex acerta 3 de 3 no gabarito, mas forçar não move nenhum: nos três o modelo
 * JÁ chama uma ferramenta — a errada. Forçar "alguma" não separa
 * `consultar_registros` de `historico_financeiro` nem `ferias_validar` de
 * `consultar_ferias`. É problema de DISCRIMINAÇÃO, não de ação.
 *
 * Puro (sem IO, sem `server-only`): testável isolado e usável pelo eval, que é o
 * que permite medir a mudança — ver `scripts/eval-cenarios.ts`.
 */

/** Tira acento e baixa a caixa: `\b` do JavaScript é ASCII (mesmo motivo de `entrega.ts`). */
function norm(texto: string): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** A ferramenta que embala conteúdo já existente em arquivo. */
export const GERADOR = "gerar_relatorio";

/**
 * Palavras que dizem RECIPIENTE DE SAÍDA, nunca assunto.
 *
 * `anexo` NÃO está aqui, de propósito: ele é palavra de ENTRADA ("conforme
 * anexo", "calcule utilizando este anexo") tanto quanto de saída, e em 25 dias
 * de produção o único turno em que ele decidiu o disparo sozinho foi a mensagem
 * "anexo" — uma palavra, sem nada que diga que se quer um arquivo NOVO. Tirá-lo
 * não custa nenhum caso do gabarito e remove o único disparo duvidoso do período.
 *
 * `relatorio` fica, porque neste produto é o nome do próprio arquivo
 * (`gerar_relatorio`). Quem escreve "me gere um relatório de férias" é barrado
 * pela palavra FÉRIAS, não pela palavra relatório.
 */
const RX_RECIPIENTE =
  /^(pdf|excel|xlsx|xls|csv|planilha|word|doc|docx|ppt|pptx|powerpoint|apresentacao|apresentacoes|slide|slides|arquivo|documento|relatorio)$/;

/**
 * Palavras que não carregam assunto: cortesia, dêixis, conectivo e verbo de
 * ENTREGA. "gere", "faz", "manda" não dizem sobre o quê — dizem só para onde.
 */
const RX_SEM_ASSUNTO =
  /^(ok|okay|beleza|blz|entao|agora|tambem|e|ou|me|te|se|de|do|da|dos|das|em|no|na|nos|nas|um|uma|uns|umas|o|a|os|as|por|para|pra|pro|favor|isso|isto|esse|essa|esses|essas|este|esta|aquilo|aquele|aquela|tudo|disso|dessa|desse|daquilo|ai|la|aqui|com|sem|so|mais|bem|ja|obrigado|obrigada|versao|formato|outro|outra|novo|nova|mesmo|mesma|manda|mande|mandar|envia|envie|enviar|gera|gere|gerar|cria|crie|criar|monta|monte|montar|faz|faca|fazer|exporta|exporte|exportar|baixa|baixe|baixar|quero|queria|preciso|poderia|pode|coloca|coloque|colocar|transforma|transforme|passa|passe|passar|converte|converta|converter)$/;

/**
 * A mensagem é SÓ formato — recipiente e nada mais?
 *
 * O teste é por SUBTRAÇÃO, não por lista de frases: tira cortesia, dêixis e
 * verbo de entrega; se sobrar qualquer palavra de assunto, não é pedido de
 * formato. É o que separa "Faz em pdf" (dispara) de "Crie um template de
 * documento de contrato de admissão" (não dispara: sobrou "template",
 * "contrato", "admissao"), e de "Cria um PDF com essas informações pra eu
 * enviar pro meu gestor" (sobrou "informacoes", "gestor").
 */
export function soFormato(pergunta: string): boolean {
  const toks = norm(pergunta).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  // Teto de 8 palavras: acima disso a frase quase sempre traz assunto, e o teto
  // evita que uma enumeração de formatos ("pdf, word, ppt, excel, csv…") passe.
  if (!toks.length || toks.length > 8) return false;
  let recipiente = false;
  for (const t of toks) {
    if (RX_RECIPIENTE.test(t)) { recipiente = true; continue; }
    if (RX_SEM_ASSUNTO.test(t)) continue;
    return false;
  }
  return recipiente;
}

export type Acao = { modo: "livre" } | { modo: "forcar"; tool: string; regra: "formato" };

export type EntradaAcao = {
  pergunta: string;
  /** EXATAMENTE as chaves que o modelo vai receber (`Object.keys(allTools)`). */
  ferramentas: readonly string[];
  /** Há turno anterior do assistente nesta conversa — existe o que embalar. */
  conversaEmAndamento: boolean;
  social: boolean;
  tutorial: boolean;
  documental: boolean;
  /**
   * Loop autônomo de tela (`payload.continuation`), onde `continuationNote`
   * manda continuar por clicar/preencher e `harvestDoneNote` cuida da coleta.
   * Duas ordens de continuação no mesmo turno, para lados opostos, é pior que
   * nenhuma. Custa quase nada: em 25 dias, 1 turno dos 103 de continuation
   * casaria o predicado.
   */
  continuation: boolean;
};

/** Rollback de uma variável de ambiente, como `PROMPT_DADOS_FORA_DO_SYSTEM`. */
export function portaoAcaoLigado(): boolean {
  return process.env.PORTAO_ACAO_OFF !== "1";
}

export function decidirAcao(e: EntradaAcao): Acao {
  const livre: Acao = { modo: "livre" };
  if (!portaoAcaoLigado()) return livre;
  // Conversa social não tem ferramenta nenhuma (a rota já corta); tutorial e
  // documentação se respondem pelo RAG, e forçar um arquivo ali é trocar a
  // resposta certa por um anexo que ninguém pediu.
  if (e.social || e.tutorial || e.documental || e.continuation) return livre;
  // No PRIMEIRO turno não existe conteúdo entregue — "pdf" ali é pedido novo.
  if (!e.conversaEmAndamento) return livre;
  if (!soFormato(e.pergunta)) return livre;
  // Sem o gerador na mesa não há o que forçar: `toolChoice` para uma ferramenta
  // ausente é erro de payload, não comportamento.
  if (!e.ferramentas.includes(GERADOR)) return livre;
  return { modo: "forcar", tool: GERADOR, regra: "formato" };
}

/**
 * ── POR QUE ESTE MÓDULO NÃO ESTÁ LIGADO ─────────────────────────────────────
 *
 * O mecanismo foi PROVADO e o gatilho foi REPROVADO. Os dois com número, num
 * painel adversarial de três lentes (22/08/2026).
 *
 * O QUE SOBREVIVEU. `toolChoice` não é diretiva: não disputa a atenção do modelo,
 * remove a opção de narrar a ação em vez de executá-la. A/B isolado nos 4 casos
 * que o predicado dispara, 3 repetições de cada lado, mudando só o flag:
 * ferramenta 3/12 → 12/12, com as faixas por rodada SEM sobreposição (0–2 contra
 * 4–4), e pergunta 10/12 → 12/12 sem nenhum "perguntou demais". O efeito existe.
 *
 * O QUE REPROVOU. `soFormato` decide por SUBTRAÇÃO de palavras vazias, e a lista
 * tem buraco de sinônimo. Verificado à mão:
 *
 *   soFormato("Gostaria de gerar o PDF por aquu")  === false
 *   soFormato("Queria  gerar o PDF por aqui")      === true
 *   soFormato("Quero   gerar o PDF por aqui")      === true
 *   soFormato("Poderia gerar o PDF por aqui")      === true
 *
 * A primeira é o caso real #126 do gabarito, e o gabarito do dono ali é
 * `relatorio_recibo_pagamento` — NÃO `gerar_relatorio`. Ele escapa do portão só
 * porque "gostaria" ficou de fora de `RX_SEM_ASSUNTO` enquanto "queria",
 * "quero", "poderia", "pode" e "preciso" estão dentro. Um sinônimo, e o portão
 * força determinANTEmente a ferramenta errada, fechando as duas saídas (o
 * `toolChoice` tira `perguntar_ao_usuario` do passo 0).
 *
 * E a colisão é ESTRUTURAL, não um item faltando na lista: cinco ferramentas do
 * ERP existem para EMITIR um PDF (`relatorio_recibo_pagamento`,
 * `relatorio_informe_rendimentos`, `relatorio_espelho_ponto`,
 * `relatorio_aviso_ferias`, `relatorio_aviso_ferias_meses`), três casos do
 * gabarito as esperam, e elas estão na mesa nos quatro disparos. A guarda óbvia
 * — "não forçar quando há emissor ofertado" — custa 4 dos 4 acertos.
 *
 * PIOR: o caso #126 hoje fica FORA dos 74 medidos porque
 * `relatorio_recibo_pagamento` não foi ofertada — ou seja, é uma das falhas de
 * FUNIL que o projeto está consertando. **Consertar o funil ARMA esta
 * regressão.**
 *
 * O DISCRIMINADOR QUE FALTA, e o que já foi descartado. O que separa "empacotar
 * o que está na mesa" de "emitir um documento do ERP" é o turno ANTERIOR ter
 * entregado alguma coisa. Testei o sinal mais óbvio — `dataset:registro` no
 * turno — e ele mede AO CONTRÁRIO: os quatro casos em que forçar está certo NÃO
 * têm dataset (é justamente por isso que falharam: o agente não chamou nada), e
 * o #126, onde forçar está errado, TEM. O registro reflete o que aconteceu
 * DENTRO do turno, não o que estava na mesa antes dele.
 *
 * Para ligar, é preciso um sinal do turno anterior — `reidratarDatasets`
 * (`route.ts:716`) roda antes das ferramentas do turno e é o candidato, mas não
 * está instrumentado no trace, então a hipótese não é testável contra o
 * histórico. Instrumentar primeiro; ligar depois.
 */
