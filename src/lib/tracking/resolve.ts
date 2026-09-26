import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { tryDecryptSecret } from "@/lib/crypto/secrets";
import { decodificarRastreioDetalhado } from "./token";
import { baseAlegada, escaparIlike } from "./base-alegada";
import type { TrackingKey } from "@/lib/chat/tracking";

export type TrackFields = Partial<Record<TrackingKey, string>>;

/**
 * Por que a identidade não veio. `sem_token` é o caso legítimo do portal
 * público; `expirado` é a sessão do painel que acabou; `sem_chave` é instalação
 * incompleta. Só `expirado` vira aviso na tela do usuário — os outros dois são
 * problema de configuração, não dele.
 *
 * `invalido` cobre assinatura que não fecha E as duas recusas novas da inversão
 * (base desconhecida, catraca fechada). É de propósito: os quatro valores são
 * lidos por 18 chamadores, `bloqueioPorIdentidade` traduz "tem token e não
 * decodificou" em `token_invalido`, e um literal novo obrigaria a editar cada
 * um deles para dizer a mesma coisa.
 */
export type MotivoSemIdentidade = "sem_token" | "sem_chave" | "expirado" | "invalido";

/** Extrai o token de um `track` do cliente (`{ token }` ou a própria string). */
function extrairToken(track: unknown): string | null {
  if (typeof track === "string") return track;
  if (track && typeof track === "object") {
    const t = (track as { token?: unknown }).token;
    if (typeof t === "string") return t;
  }
  return null;
}

/** Lê a chave de rastreio do espaço (cifrada em repouso) via service-role. */
async function chaveDoEspaco(spaceId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("space_tracking_keys")
    .select("key_enc")
    .eq("space_id", spaceId)
    .maybeSingle();
  return data?.key_enc ? tryDecryptSecret(data.key_enc) : null;
}

type Decisao = { campos: TrackFields; motivo: MotivoSemIdentidade | null };

const RECUSA: Decisao = { campos: {}, motivo: "invalido" };

/**
 * Bases já avisadas neste processo. Uma linha por base, e não uma por turno:
 * o caminho legado é o normal durante a transição, então logar a cada
 * requisição afogaria o log justamente enquanto ele é útil.
 */
const jaAvisadas = new Set<string>();

/**
 * O log do caminho legado. Só a BASE entra na mensagem.
 *
 * Mesma regra que `escopo-da-base.ts` segue nos dois pontos de queda: a
 * identidade carrega matrícula e usuário, e log não é lugar de dado de pessoa.
 * O token, muito menos — ele é credencial viva até `exp`.
 */
function avisarChaveDoEspaco(base: string): void {
  if (jaAvisadas.has(base)) return;
  jaAvisadas.add(base);
  console.warn(
    `[tracking] base "${base}" ainda assina com a chave do ESPAÇO (compartilhada). ` +
      `Recole o bloco do APEX desse cliente com a chave própria dele para fechar a catraca.`,
  );
}

/**
 * Grava a catraca na PRIMEIRA verificação que fechar com a chave da base.
 *
 * Um UPDATE só na vida daquele cliente: o `is` nulo no filtro garante que
 * chamadas seguintes não reescrevem nada (e duas requisições simultâneas na
 * virada gravam o mesmo valor, sem conflito).
 *
 * Falha aqui NÃO derruba o turno — a identidade já está provada. Mas grita,
 * porque catraca que não fecha deixa o furo aberto para aquele cliente e o
 * sintoma é invisível: tudo continua funcionando.
 */
async function fecharCatraca(baseId: string, spaceId: string, base: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("ai_base_tracking_keys")
      .update({ confirmada_em: new Date().toISOString() })
      .eq("base_id", baseId)
      .eq("space_id", spaceId)
      .is("confirmada_em", null);
    if (error) {
      console.error(
        `[tracking] base "${base}" verificou com a chave PRÓPRIA mas a catraca não fechou:`,
        error.message,
      );
    }
  } catch (e) {
    console.error(
      `[tracking] base "${base}" verificou com a chave PRÓPRIA mas a catraca não fechou:`,
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * A INVERSÃO, com catraca POR BASE.
 *
 * Devolve `null` quando NÃO decidiu — e só então o chamador segue para a chave
 * do espaço. Qualquer outro retorno é a palavra final.
 *
 * ── A catraca, que é o coração disto ───────────────────────────────────
 *
 * A chave do espaço é UMA para todos os clientes do painel e mora em texto puro
 * na constante `c_key` do bloco PL/SQL dentro do APEX de cada cliente. Fechar o
 * furo de uma vez exigiria recolar o bloco em 14 clientes no mesmo instante, ou
 * manter à mão uma lista de quem já migrou. A catraca dispensa as duas coisas:
 *
 *   · `confirmada_em` nulo  → aquele cliente ainda não recolou o bloco. Token
 *     que não fecha com a chave da base cai no caminho legado, como sempre foi;
 *   · `confirmada_em` cheio → aquele cliente JÁ PROVOU ter a chave própria.
 *     Daí em diante, token que não fecha com a chave dele é RECUSADO. Aceitar a
 *     compartilhada depois disso reabriria o furo só para ele.
 *
 * Cada cliente fecha SOZINHO no instante em que o bloco dele é recolado, e
 * nunca mais volta atrás. Migração um por vez, sem derrubar ninguém.
 *
 * ── Quatro coisas que parecem detalhe e não são ────────────────────────
 *
 * 1. `active` de `ai_bases` NÃO entra aqui, diferente de `resolve-base.ts`.
 *    Medido em 25/09: seis das 14 bases estão inativas e quatro delas têm
 *    conversa real (`stefanini` 20, `leadec` 16, `saude` 13, `incor` 6).
 *    Recusar por inatividade transformaria a inversão num apagão para esses
 *    clientes. `active` governa se as ferramentas da base carregam, não se a
 *    pessoa existe.
 *
 * 2. Base que não está em `ai_bases` é RECUSADA, sem consultar chave nenhuma —
 *    não cai no legado. Se caísse, bastaria alegar uma base que a busca não
 *    resolve para escapar da amarração e voltar à chave compartilhada. Medido:
 *    a única base fora do catálogo que já conversou é `TESTE_FATURA`, 2
 *    conversas no Painel do Gestor, a última em 08/08.
 *
 * 3. Erro de LEITURA (não "não achei") também recusa. Sem ler a coluna não há
 *    como saber se aquele cliente já fechou a catraca, e adivinhar para o lado
 *    permissivo é o que reabre o furo. O custo real é zero: se o Postgres não
 *    responde, o turno não se completa de todo jeito.
 *
 * 4. O formato opaco (`kbt1.`, AES-GCM) nunca chega aqui — `baseAlegada`
 *    devolve `null` para ele e ele segue pelo caminho legado, de propósito. Não
 *    é possível descobrir a base antes de ter a chave, e tentar chave por chave
 *    até uma decifrar transformaria esta função num oráculo. Nada em produção
 *    emite esse formato: o bloco do APEX só emite `kbt1h.`. Não "conserte".
 */
async function verificarComChaveDaBase(
  spaceId: string,
  token: string,
  alegada: string,
): Promise<Decisao | null> {
  const supabase = createAdminClient();

  const { data: base, error: erroBase } = await supabase
    .from("ai_bases")
    .select("id")
    .ilike("base_code", escaparIlike(alegada))
    .maybeSingle();

  if (erroBase) {
    console.error(
      `[tracking] falha ao procurar a base "${alegada}" para escolher a chave, recusando:`,
      erroBase.message,
    );
    return RECUSA;
  }
  if (!base) return RECUSA;

  const { data: linha, error: erroChave } = await supabase
    .from("ai_base_tracking_keys")
    .select("key_enc, confirmada_em")
    .eq("base_id", base.id)
    .eq("space_id", spaceId)
    .maybeSingle();

  if (erroChave) {
    console.error(
      `[tracking] falha ao ler a chave da base "${alegada}", recusando:`,
      erroChave.message,
    );
    return RECUSA;
  }

  const confirmada = Boolean(linha?.confirmada_em);
  const chave = linha?.key_enc ? tryDecryptSecret(linha.key_enc) : null;

  // Sem chave própria (ou chave gravada que não abre, sinal de
  // `APP_ENCRYPTION_KEY` trocada): nada a verificar. Se a catraca já fechou,
  // recusa — o cliente provou ter chave própria e a compartilhada não volta a
  // valer para ele nem quando a NOSSA leitura da chave quebra.
  if (!chave) return confirmada ? RECUSA : null;

  const r = decodificarRastreioDetalhado(chave, token);

  // Assinatura não fechou com a chave da base. Aqui vive a recusa que é o
  // objeto desta tarefa: token assinado com a chave de OUTRA base (ou com a do
  // espaço) alegando esta. Quem já fechou a catraca recusa; quem não fechou
  // ainda cai no legado.
  if (!r.ok && r.motivo !== "expirado") return confirmada ? RECUSA : null;

  // Daqui para baixo a assinatura FECHOU com a chave da base — inclusive no
  // caso expirado, porque `decodificarRastreioDetalhado` só olha `exp` depois
  // de conferir o HMAC.
  //
  // A amarração só existe com a conferência abaixo. A chave foi escolhida pela
  // base ALEGADA; se o payload verificado trouxer outra, aceitar seria amarrar
  // de mentira — a identidade que seguiria para as consultas não é a que
  // autorizou a escolha da chave. No token vencido não há payload para
  // conferir, e fechar o HMAC com a chave da base já é prova de posse.
  const conferido = r.ok ? (r.campos.p_base ?? "").trim().toLowerCase() === alegada : true;
  if (!conferido) return RECUSA;

  // Prova de posse: o bloco daquele cliente já foi recolado com a chave própria.
  // Vale também para o token vencido — ele é dele, só está velho.
  if (!confirmada) await fecharCatraca(base.id, spaceId, alegada);

  return r.ok ? { campos: r.campos, motivo: null } : { campos: {}, motivo: "expirado" };
}

/**
 * Resolve a IDENTIDADE de rastreio (p_*) a partir do TOKEN assinado/cifrado
 * enviado pelo cliente, amarrando a verificação à chave DAQUELA BASE quando ela
 * existe (ver `verificarComChaveDaBase`) e caindo na chave do ESPAÇO enquanto o
 * cliente não tiver recolado o bloco do APEX. Devolve {} quando não há token
 * válido — nunca lança, nunca aceita texto forjado.
 */
export async function decodeTrackForSpace(spaceId: string, track: unknown): Promise<TrackFields> {
  return (await decodeTrackDetalhado(spaceId, track)).campos;
}

/**
 * Igual ao anterior, mas diz POR QUE não houve identidade.
 *
 * Existe porque o silêncio custava caro: com o token vencido, a conversa seguia
 * como anônima, as ferramentas que dependem de `p_usuario` eram cortadas e a IA
 * respondia "não tenho acesso" — indistinguível de um defeito do produto. Com o
 * motivo em mãos, o widget diz "sua sessão no painel expirou, atualize a
 * página", que é acionável.
 *
 * É o PONTO ÚNICO por onde passam as 18 chamadas de identidade do produto
 * (`/api/v1/*`, `/api/portal/*`, as actions do portal e os jobs de análise).
 * Por isso a inversão mora aqui e nenhum chamador foi tocado: corrigir neste
 * lugar move o produto inteiro de uma vez, inclusive rotas que nada têm a ver
 * com o projeto que exigiu a correção.
 */
export async function decodeTrackDetalhado(
  spaceId: string,
  track: unknown,
): Promise<{ campos: TrackFields; motivo: MotivoSemIdentidade | null }> {
  const token = extrairToken(track);
  if (!token || !spaceId) return { campos: {}, motivo: "sem_token" };

  // Passo 1: o que o token DIZ ser. Alegação, nunca fato — só escolhe a chave.
  const alegada = baseAlegada(token);
  if (alegada) {
    const decidido = await verificarComChaveDaBase(spaceId, token, alegada);
    if (decidido) return decidido;
  }

  // Caminho legado: a chave do ESPAÇO, como sempre foi. É onde caem o token sem
  // base no payload (portal público), o formato opaco `kbt1.` e a base que
  // ainda não recolou o bloco do APEX.
  const chave = await chaveDoEspaco(spaceId);
  if (!chave) return { campos: {}, motivo: "sem_chave" };
  const r = decodificarRastreioDetalhado(chave, token);
  if (alegada && (r.ok || r.motivo === "expirado")) avisarChaveDoEspaco(alegada);
  return r.ok ? { campos: r.campos, motivo: null } : { campos: {}, motivo: r.motivo };
}

/** Só existe identidade de cliente (biblioteca de prompts) com base + usuário. */
export function temIdentidadeCliente(t: TrackFields): t is TrackFields & { p_base: string; p_usuario: string } {
  return Boolean(t.p_base && t.p_usuario);
}
