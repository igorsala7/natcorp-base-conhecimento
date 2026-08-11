/**
 * Diagnóstico de uma base/cliente: está tudo no lugar para as ferramentas
 * rodarem?
 *
 * Nasceu de um caso concreto: a `stefanini-dev` falhava no `meus_dados` com
 * "parâmetro key nulo". A causa era um campo opcional em branco na credencial
 * (`session_key`), três telas longe da mensagem de erro. Descobrir isso levou
 * uma investigação inteira — e se repetiria a cada base nova, porque nada no
 * cadastro avisa que aquele campo virou obrigatório assim que uma ferramenta
 * passou a depender dele.
 *
 * A regra de negócio mora AQUI, pura e testável. A parte de rede (pedir o
 * token) fica na server action: é o único passo que não dá para decidir sem
 * sair da máquina.
 */

export type EstadoPasso = "ok" | "aviso" | "erro";

export type Passo = {
  nome: string;
  estado: EstadoPasso;
  /** O que fazer, quando não está ok. Vazio quando não há nada a fazer. */
  detalhe: string;
};

/** O mínimo que o diagnóstico precisa saber da base. */
export type BaseDiag = {
  base_code: string;
  active: boolean;
  base_url: string | null;
  credential_id: string | null;
};

/** O mínimo que precisa saber da credencial padrão. */
export type CredDiag = {
  name: string;
  auth_type: string;
  active: boolean;
} | null;

/** Parâmetro de ferramenta, reduzido ao que importa aqui. */
export type ParamDiag = {
  nome: string;
  origem: string;
  obrigatorio: boolean;
  campoCredencial?: string | null;
};

/** Ferramenta habilitada na base, reduzida ao que importa aqui. */
export type ToolDiag = { key: string; name: string; params: ParamDiag[] };

/**
 * Campos de credencial que as ferramentas HABILITADAS exigem, com quem exige.
 *
 * É o cruzamento que ninguém faz à mão: o formulário de credencial marca
 * `session_key` como opcional — e ela é, para quem não usa `login/v1`. Deixa de
 * ser no instante em que uma ferramenta que a lê é liberada para a base, e
 * nada no cadastro avisa.
 */
export function camposDeCredencialExigidos(tools: ToolDiag[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const t of tools) {
    for (const p of t.params ?? []) {
      if (p.origem !== "credencial" || !p.obrigatorio || !p.campoCredencial) continue;
      const lista = out.get(p.campoCredencial) ?? [];
      lista.push(t.key);
      out.set(p.campoCredencial, lista);
    }
  }
  return out;
}

/** Formata "3 ferramentas (a, b, c)" sem despejar 40 chaves na tela. */
function listar(keys: string[], teto = 4): string {
  const mostrados = keys.slice(0, teto).join(", ");
  const resto = keys.length - teto;
  return resto > 0 ? `${mostrados} e mais ${resto}` : mostrados;
}

/**
 * Passos que dependem só de configuração — sem tocar na rede.
 *
 * Ordem deliberada: o que impede tudo vem primeiro. Não adianta apontar um
 * campo de credencial em branco quando a base sequer tem credencial apontada;
 * a pessoa corrigiria o segundo problema e continuaria travada no primeiro.
 */
export function passosDeConfiguracao(
  base: BaseDiag,
  cred: CredDiag,
  camposDaCredencial: string[],
  toolsHabilitadas: ToolDiag[],
): Passo[] {
  const passos: Passo[] = [];

  passos.push(
    base.active
      ? { nome: "Base ativa", estado: "ok", detalhe: "" }
      : { nome: "Base ativa", estado: "erro", detalhe: "A base está inativa: nenhuma ferramenta responde enquanto isso." },
  );

  passos.push(
    base.base_url?.trim()
      ? { nome: "URL base", estado: "ok", detalhe: base.base_url }
      : {
          nome: "URL base",
          estado: "erro",
          detalhe: "Sem URL base, as ferramentas internas não têm para onde chamar.",
        },
  );

  if (!base.credential_id) {
    passos.push({
      nome: "Credencial padrão",
      estado: "erro",
      detalhe: "A base não tem credencial padrão apontada — nenhuma ferramenta com autenticação vai funcionar.",
    });
    // Sem credencial não há o que checar adiante: parar aqui evita uma cascata
    // de erros derivados que escondem a causa única.
    return passos;
  }
  if (!cred) {
    passos.push({
      nome: "Credencial padrão",
      estado: "erro",
      detalhe: "A credencial apontada não existe mais. Escolha outra em Editar base.",
    });
    return passos;
  }
  passos.push(
    cred.active
      ? { nome: "Credencial padrão", estado: "ok", detalhe: `${cred.name} (${cred.auth_type})` }
      : { nome: "Credencial padrão", estado: "erro", detalhe: `"${cred.name}" está inativa.` },
  );

  // Campos que as ferramentas liberadas realmente exigem.
  const exigidos = camposDeCredencialExigidos(toolsHabilitadas);
  const presentes = new Set(camposDaCredencial);
  const faltando = [...exigidos.entries()].filter(([campo]) => !presentes.has(campo));

  if (exigidos.size === 0) {
    passos.push({ nome: "Campos exigidos pelas ferramentas", estado: "ok", detalhe: "Nenhuma ferramenta lê campo de credencial." });
  } else if (faltando.length === 0) {
    passos.push({
      nome: "Campos exigidos pelas ferramentas",
      estado: "ok",
      detalhe: `${[...exigidos.keys()].join(", ")} — presentes.`,
    });
  } else {
    for (const [campo, keys] of faltando) {
      passos.push({
        nome: `Campo "${campo}" da credencial`,
        estado: "erro",
        detalhe:
          `Está em branco e ${keys.length} ferramenta(s) dependem dele: ${listar(keys)}. ` +
          `Elas vão falhar com "parâmetro obrigatório ausente".`,
      });
    }
  }

  passos.push(
    toolsHabilitadas.length > 0
      ? { nome: "Ferramentas liberadas", estado: "ok", detalhe: `${toolsHabilitadas.length} nesta base.` }
      : {
          nome: "Ferramentas liberadas",
          estado: "aviso",
          detalhe: "Nenhuma ferramenta liberada — o chatbot não consulta sistemas nesta base.",
        },
  );

  return passos;
}

/** Verdadeiro se algum passo impede a base de funcionar. */
export function temFalha(passos: Passo[]): boolean {
  return passos.some((p) => p.estado === "erro");
}

/** Resumo de uma linha, para o toast e para o cabeçalho do resultado. */
export function resumo(passos: Passo[]): string {
  const erros = passos.filter((p) => p.estado === "erro").length;
  const avisos = passos.filter((p) => p.estado === "aviso").length;
  if (erros) return `${erros} problema(s) encontrado(s).`;
  if (avisos) return `Funcionando, com ${avisos} aviso(s).`;
  return "Tudo certo.";
}
