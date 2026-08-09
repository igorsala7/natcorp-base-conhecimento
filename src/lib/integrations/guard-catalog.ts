/**
 * CATÁLOGO DE GUARDS — metadados (chave + rótulo + descrição) dos guards de servidor.
 *
 * Módulo PURO (sem imports de servidor) para poder ser usado no cliente (seletor da
 * tela de ferramentas) e no servidor. A LÓGICA de cada guard vive em `guards.ts`; aqui
 * só o que a UI precisa mostrar. Ao criar um guard novo em `guards.ts`, adicione a
 * entrada aqui — um teste garante que os dois lados não divergem.
 */
export type GuardInfo = { key: string; label: string; description: string };

export const GUARD_CATALOG: GuardInfo[] = [
  {
    key: "escopo_painel",
    label: "Escopo por painel (configurável)",
    description:
      "Aplica o alcance definido no panel_scope da própria ferramenta (próprios/equipe/todos + \"≠ eu\"). O guard usado pela maioria das consultas de dados.",
  },
  {
    key: "escopo_pessoa",
    label: "Escopo por pessoa (fixo)",
    description:
      "Regra fixa por painel: Operador vê todos, Gestor só a sua equipe, Colaborador só os próprios dados. Use quando o alcance não depende de configuração.",
  },
  {
    key: "team_membership",
    label: "Equipe do gestor",
    description: "Só passa se a matrícula pedida estiver na equipe do gestor logado. Bloqueia consultar quem não é da equipe.",
  },
  {
    key: "saque_confirmation",
    label: "Confirmação de saque (e-mail)",
    description:
      "Ação sensível: gera um código, envia por e-mail (o modelo não vê) e exige que o usuário informe o código antes de efetivar. Use em gravações críticas (saque).",
  },
  {
    key: "confirmation",
    label: "Confirmação por e-mail (genérico)",
    description:
      "Como o de saque, mas reusável em QUALQUER gravação sensível: gera um código, envia por e-mail e exige confirmação antes de executar. O e-mail usa o nome da ferramenta e o código é isolado por ferramenta (um não confirma outro).",
  },
  {
    key: "confirmation_detalhada",
    label: "Confirmação mostrando o conteúdo",
    description:
      "Para ações que SAEM PARA FORA (enviar e-mail, convidar terceiros, compartilhar arquivo). Pergunta mostrando os valores reais — destinatário, assunto, trecho do corpo — em vez de um rótulo genérico: contra um documento que tente induzir o agente a agir, o que defende é a pessoa LER para quem e o quê antes de dizer sim. A pendência inclui uma impressão digital dos argumentos, então um 'sim' nunca autoriza um conteúdo diferente.",
  },
];

/** Descrição de um guard pela chave (ou null se desconhecido). */
export function guardInfo(key: string | null | undefined): GuardInfo | null {
  const k = String(key ?? "").trim();
  return GUARD_CATALOG.find((g) => g.key === k) ?? null;
}
