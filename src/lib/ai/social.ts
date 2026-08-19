/**
 * Detecta um turno CONVERSACIONAL — que o chat deve responder com a PERSONA
 * (com simpatia, sem RAG, sem citação), não tratar como pergunta de
 * documentação. Cobre dois casos:
 *  1. SOCIAL: saudação, "tudo bem?", agradecimento, despedida.
 *  2. META/IDENTIDADE sobre o PRÓPRIO assistente: "quem é você?", "o que você
 *     faz?", "você é um robô?", "qual seu nome?", "com o que você ajuda?"…
 *     (era o buraco: "Quem é vc?" caía no RAG e virava desambiguação).
 *
 * Puro e testável. Conservador: casa a MENSAGEM INTEIRA (âncoras ^…$) e as
 * regras de meta EXIGEM referência a "você/vc/seu" — assim "o que faz o
 * sistema?" (pergunta real) NÃO casa e segue para o RAG.
 */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// `[^a-z0-9]` como separador/cauda: tolera pontuação, espaços e emojis/emoticons
// (o texto já vem normalizado — minúsculo e sem acentos).
const PADROES: RegExp[] = [
  // Saudações puras: oi, olá, opa, e aí, salve, hey…
  /^(oi+|ola+|opa+|e ?a[ie]|eae|salve|hey|hi+|hello)[^a-z0-9]*$/,
  // Bom dia / boa tarde / boa noite (com saudação opcional antes).
  /^((oi+|ola+|opa+|hey|hi+|hello)[^a-z0-9]+)?(bom dia|boa tarde|boa noite)[^a-z0-9]*$/,
  // "tudo bem?", "como vai?", "beleza?" (com saudação opcional antes).
  /^((oi+|ola+|opa+|hey|hi+|hello|bom dia|boa tarde|boa noite)[^a-z0-9]+)?(tudo bem|tudo bom|td bem|td bom|como (voce |vc )?vai|como (voce |vc )?esta|beleza|blz|de boa)[^a-z0-9]*$/,
  // Agradecimentos. A cauda é FECHADA de propósito: era `([^a-z0-9].*)?$` — aceitava
  // QUALQUER coisa depois, então "obrigado! agora me diz quantos estão de férias" e
  // "perfeito, e o fechamento da folha?" viravam turno social e o pipeline inteiro
  // desligava (RAG vazio, glossário vazio, todos os gates pulados). Ver `separarSocial`:
  // agradecimento SEGUIDO de pergunta real não é mais engolido.
  /^(muito )?(obrigad[oa]|obg|valeu|vlw|brigad[oa]|agradecid[oa]|thanks|thank you|show|perfeito|otimo|excelente)([^a-z0-9]+(pela ajuda|por tudo|por isso|pela informacao|pelas informacoes|mesmo|demais|viu|hein|entao|ai|cara|amigo|gente))?[^a-z0-9]*$/,
  // Despedidas.
  /^(tchau+|ate mais|ate logo|ate breve|falou|flw|abraco|abracos)[^a-z0-9]*$/,
];

// Meta/identidade sobre o assistente — todas EXIGEM "você/vc/seu/te" para não
// pegar pergunta real ("o que faz o sistema?").
const META: RegExp[] = [
  // quem é você / quem é vc / quem são vocês
  /^quem (e|eh|es|sao)? ?(voce|vc|voces|vcs|tu)[^a-z0-9]*$/,
  // o que é você / o que você é
  /^(o que|oq|que) (e|eh)? ?(voce|vc|tu)( e| eh)?[^a-z0-9]*$/,
  // você é um robô / humano / ia / bot / real / de verdade
  /^(voce|vc|tu|voces|vcs) (e|eh|es|sao) (um |uma )?(robo|bot|chatbot|humano|humana|pessoa|ia|inteligencia artificial|maquina|programa|assistente|real|de verdade)[^a-z0-9]*$/,
  // qual/como (é) o seu nome / sua função / seu propósito
  /^(qual|como)( e| eh)? ?(o |a )?(seu|sua|teu|tua) (nome|funcao|papel|proposito|objetivo)[^a-z0-9]*$/,
  // como você funciona / se chama / foi feito|criado|treinado
  /^como (voce|vc|tu) (funciona|se chama|trabalha|foi (feito|feita|criado|criada|treinado|treinada|desenvolvido|desenvolvida))[^a-z0-9]*$/,
  // quem te criou / fez / desenvolveu / treinou / programou
  /^quem (te|o|lhe|voce) (criou|fez|desenvolveu|treinou|programou)[^a-z0-9]*$/,
  // capacidade — família "o quê": "o que/com o que/no que/em que você (pode) faz/ajuda/serve"
  // (também pega "o que você faz"). EXIGE "você" p/ não pegar "o que faz o sistema?".
  /^(o que|oq|que|com o que|no que|em que|pra que|para que) (voce|vc|tu|voces)( pode| poderia| sabe| consegue| da pra)? ?(me )?(ajud\w*|faz|faze|fazer|serve|auxili\w*|fazer por mim|sabe faz\w*)[a-z ]{0,20}[^a-z0-9]*$/,
  // capacidade — família "como": "como você (pode) me ajudar/fazer". EXIGE um
  // modal (pode/sabe/…) OU "me ajudar", senão "como você faz backup?" (pergunta
  // real) seria capturado por engano.
  /^(como|de que forma|de que maneira) (voce|vc|tu|voces) ((pode|poderia|sabe|consegue|da pra) ?(me )?(ajud\w*|faz\w*|auxili\w*|resolver|servir)|me (ajud\w*|auxili\w*))[a-z ]{0,20}[^a-z0-9]*$/,
];

export function ehConversaSocial(texto: string): boolean {
  const t = normalizar(texto);
  if (!t || t.length > 80) return false;
  return PADROES.some((re) => re.test(t)) || META.some((re) => re.test(t));
}

/** Abertura social seguida de pedido real: "obrigado! agora me diz quantos…". */
const RX_ABERTURA_SOCIAL =
  /^(muito )?(obrigad[oa]|obg|valeu|vlw|brigad[oa]|agradecid[oa]|thanks|show|perfeito|otimo|excelente|beleza|blz|legal|bacana|massa|entendi|ok|okay|certo|isso|bom dia|boa tarde|boa noite|oi+|ola+|opa+|e ?a[ie]|eae|hey|hi+|hello)\b[^a-z0-9]*/;

/**
 * Separa uma ABERTURA social do PEDIDO real que vem depois.
 *
 * Num chat de RH "obrigado! agora me diz quantos estão de férias" e "perfeito, e o
 * fechamento da folha?" são altíssima frequência — e eram classificados como turno
 * social inteiro, o que zerava RAG, glossário e todos os gates: o agente respondia
 * "de nada!" e ignorava a pergunta.
 *
 * Devolve `{ saudacao, resto }`. Havendo `resto` com conteúdo, o turno NÃO é social:
 * o chamador segue o fluxo normal e só pede uma linha de cortesia antes da resposta.
 */
export function separarSocial(texto: string): { saudacao: string; resto: string } {
  const bruto = String(texto ?? "").trim();
  if (!bruto) return { saudacao: "", resto: "" };
  // Mensagem inteiramente social continua inteiramente social.
  if (ehConversaSocial(bruto)) return { saudacao: bruto, resto: "" };
  const t = normalizar(bruto);
  const m = RX_ABERTURA_SOCIAL.exec(t);
  if (!m) return { saudacao: "", resto: bruto };
  // Corta no TEXTO ORIGINAL pelo mesmo comprimento: `normalizar` só troca acento por
  // letra e colapsa espaço, então o deslocamento de índice é desprezível para o corte.
  const corte = m[0].length;
  const resto = bruto.slice(corte).trim();
  // Cauda curta demais não é pedido ("obrigado :)") — trata como social puro.
  if (resto.replace(/[^a-zà-ú0-9]/gi, "").length < 3) return { saudacao: bruto, resto: "" };
  return { saudacao: bruto.slice(0, corte).trim(), resto };
}

/**
 * O TURNO É SOCIAL? — a decisão inteira, num lugar só.
 *
 * `separarSocial` responde "sobrou alguma coisa depois da saudação?". Mas a
 * pergunta que decide o turno é outra: **sobrou algo que precise de dados?**
 *
 * Em `"Olá, como você pode me ajudar?"` o resto é `"como você pode me ajudar?"`
 * — que, isolado, é social. A mesma frase SEM o "Olá," já pegava o atalho; com
 * ele, o turno ia inteiro para RAG, ontologia e varredura de tela. Custo medido
 * de uma palavra de cortesia: **30.426 tokens e 12,5 s** (18/08/2026).
 *
 * O classificador que resolve isso é o `ehConversaSocial` logo acima — ele já
 * acertava a frase isolada; só nunca tinha sido aplicado ao resto que o próprio
 * separador produz.
 *
 * Continua NÃO social quando o resto é um pedido de verdade
 * (`"obrigado! agora me diz quantos estão de férias"`) — que é o caso para o
 * qual a separação foi criada, e o que este atalho não pode reintroduzir.
 */
export function ehTurnoSocial(texto: string): boolean {
  const t = String(texto ?? "").trim();
  if (!t) return false;
  // Parte do SEPARADOR, não de `ehConversaSocial(t)`: a frase inteira
  // ("Olá, como você pode me ajudar?") não é social — é a soma de duas partes
  // que são. Testar o todo primeiro devolvia `false` antes de olhar as partes,
  // que é exatamente o defeito original com outro nome.
  const { saudacao, resto } = separarSocial(t);
  if (!saudacao) return false;
  return !resto || ehConversaSocial(resto);
}
