import "server-only";
import { loadBaseContext, loadCredentialSecret } from "./resolve";
import { executeTool } from "./executor";
import { getCachedExecMeta, cacheArgsKey } from "./tool-cache";
import { emailFuncionalDe } from "@/lib/chat/meus-dados";
import type { Identity } from "./params";

/**
 * O e-mail FUNCIONAL de quem está falando, pela ferramenta `meus_dados`.
 *
 * Existe porque o fluxo de conexão de conta pessoal precisa saber QUAL caixa a
 * pessoa deveria conectar, e a rota de consentimento só tem empresa e matrícula
 * (o token de rastreio não carrega e-mail). A fonte é a mesma que o chat já usa
 * para responder "quais são meus dados" — cadastro do RH, não algo que o
 * navegador afirme.
 *
 * Mesmo cache do chat (15 min, escopo por usuário): abrir o widget, clicar em
 * conectar e voltar não gera três idas à ORDS.
 *
 * Best-effort por decisão: falha aqui NUNCA pode impedir alguém de conectar a
 * conta. Sem e-mail, o consentimento apenas deixa de pré-selecionar a conta e a
 * checagem do callback não roda — tudo o mais segue igual.
 */
const TOOL = "meus_dados";
const TTL = 900;

export async function emailFuncionalDaPessoa(
  baseCode: string,
  identity: Identity,
): Promise<string | null> {
  if (!baseCode?.trim() || !identity.matricula) return null;
  try {
    const ctx = await loadBaseContext(baseCode);
    const bt = ctx?.tools.find((t) => t.tool.key === TOOL);
    if (!bt?.baseUrl) return null;
    const cred = bt.credentialId ? await loadCredentialSecret(bt.credentialId) : null;
    const r = await getCachedExecMeta(
      `${baseCode}:${TOOL}:${cacheArgsKey({}, identity, "user")}`,
      TTL,
      () => executeTool({ tool: bt.tool, baseUrl: bt.baseUrl!, credential: cred, modelArgs: {}, identity }),
    );
    return r.result.ok ? emailFuncionalDe(r.result.data) : null;
  } catch {
    return null;
  }
}
