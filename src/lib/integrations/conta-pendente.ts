import { NOME_PROVEDOR } from "./user-key";

/** Ferramentas que existem na base mas ficaram de fora deste turno por falta de
 *  conta pessoal. Os três motivos pedem respostas diferentes (ver o corte). */
export type ContaPendente = {
  provider: string;
  motivo: "sem_conexao" | "sem_credencial" | "sem_identidade";
  /** Nomes legíveis das ferramentas cortadas ("Enviar e-mail"…). */
  tools: string[];
};

/**
 * O aviso que entra no prompt quando ferramentas de conta pessoal ficaram de
 * fora. Dizer ao modelo o que FALTA é o que impede a resposta observada em
 * 11/08/2026 — "não tenho uma ferramenta de envio de e-mail", com o
 * `ms_email_enviar` cadastrado, habilitado e cortado dois segundos antes.
 *
 * A instrução é deliberadamente estreita: informar e parar. Sem ela o modelo
 * inventa contorno ("peça ao RH", "use seu Outlook"), que é pior que a verdade.
 */
export function avisoContaPendente(pendencias: ContaPendente[]): string {
  if (!pendencias.length) return "";
  const linhas = pendencias.map((p) => {
    const nome = NOME_PROVEDOR[p.provider] ?? p.provider;
    const lista = p.tools.join(", ");
    if (p.motivo === "sem_credencial") {
      return `- ${nome} (${lista}): a integração ainda não foi configurada para esta empresa. Diga que o ADMINISTRADOR precisa cadastrar a integração ${nome} — o usuário não tem como resolver sozinho.`;
    }
    if (p.motivo === "sem_identidade") {
      return `- ${nome} (${lista}): não foi possível identificar a matrícula do usuário nesta conversa, então não há conta pessoal a usar. Diga isso e sugira reabrir o assistente pelo sistema, logado.`;
    }
    return `- ${nome} (${lista}): o usuário AINDA NÃO conectou a conta ${nome} dele. Diga que você FAZ isso assim que ele conectar, e que basta clicar em "Conectar ${nome}" no menu do assistente (o botão aparece junto desta conversa).`;
  });
  return (
    "\n\nCONTA PESSOAL PENDENTE — estas ferramentas EXISTEM neste assistente e ficaram indisponíveis " +
    "só neste turno:\n" +
    linhas.join("\n") +
    "\nNUNCA diga que a ferramenta não existe nem que você não tem como fazer: diga o que falta e ofereça " +
    "fazer depois. NÃO sugira contorno manual (mandar pelo Outlook, pedir ao RH) como se fosse a solução, " +
    "e não tente outra ferramenta para obter o mesmo resultado."
  );
}

