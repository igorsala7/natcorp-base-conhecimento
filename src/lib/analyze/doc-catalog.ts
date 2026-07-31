/**
 * Catálogo de DOCUMENTOS pessoais (Brasil) com o SCHEMA CANÔNICO de cada tipo.
 * Lógica pura (sem server-only/IA) — testável. A extração usa isto para (1)
 * orientar o modelo a identificar o tipo e (2) devolver os dados num padrão fixo
 * por tipo (campos canônicos, faltantes como null).
 */

export type CampoCanonico = { chave: string; descricao: string };
export type DocTipo = { tipo: string; label: string; campos: CampoCanonico[] };

const C = (chave: string, descricao: string): CampoCanonico => ({ chave, descricao });

export const DOC_CATALOG: DocTipo[] = [
  {
    tipo: "comprovante_endereco",
    label: "Comprovante de endereço",
    campos: [
      C("titular", "nome do titular da conta/fatura"),
      C("logradouro", "rua/avenida"),
      C("numero", "número"),
      C("complemento", "apto/bloco/casa"),
      C("bairro", "bairro"),
      C("cidade", "município"),
      C("uf", "estado (sigla)"),
      C("cep", "CEP (só dígitos)"),
      C("emissor", "concessionária/empresa emissora (ex.: Enel, Sabesp, banco)"),
      C("data_emissao", "data de emissão/vencimento"),
    ],
  },
  {
    tipo: "certidao_nascimento",
    label: "Certidão de nascimento",
    campos: [
      C("nome", "nome do registrado"),
      C("data_nascimento", "data de nascimento"),
      C("hora_nascimento", "hora de nascimento"),
      C("sexo", "sexo"),
      C("naturalidade", "município/UF de nascimento"),
      C("filiacao_pai", "nome do pai"),
      C("filiacao_mae", "nome da mãe"),
      C("avos_paternos", "avós paternos"),
      C("avos_maternos", "avós maternos"),
      C("cartorio", "cartório de registro"),
      C("matricula", "matrícula da certidão"),
      C("data_registro", "data do registro"),
      C("livro", "livro"),
      C("folha", "folha"),
      C("termo", "termo"),
    ],
  },
  {
    tipo: "certidao_casamento",
    label: "Certidão de casamento",
    campos: [
      C("conjuge_1", "nome do 1º cônjuge"),
      C("conjuge_2", "nome do 2º cônjuge"),
      C("data_casamento", "data do casamento"),
      C("regime_bens", "regime de bens"),
      C("nome_apos_casamento_1", "nome do 1º cônjuge após o casamento"),
      C("nome_apos_casamento_2", "nome do 2º cônjuge após o casamento"),
      C("cartorio", "cartório"),
      C("matricula", "matrícula"),
      C("data_registro", "data do registro"),
      C("livro", "livro"),
      C("folha", "folha"),
      C("termo", "termo"),
    ],
  },
  {
    tipo: "certidao_obito",
    label: "Certidão de óbito",
    campos: [
      C("nome", "nome do falecido"),
      C("data_obito", "data do óbito"),
      C("data_nascimento", "data de nascimento"),
      C("idade", "idade"),
      C("sexo", "sexo"),
      C("estado_civil", "estado civil"),
      C("causa_morte", "causa da morte"),
      C("local_obito", "local do óbito"),
      C("declarante", "declarante"),
      C("cartorio", "cartório"),
      C("matricula", "matrícula"),
      C("data_registro", "data do registro"),
    ],
  },
  {
    tipo: "atestado_medico",
    label: "Atestado médico",
    campos: [
      C("paciente", "nome do paciente"),
      C("cid", "CID (código da doença)"),
      C("dias_afastamento", "dias de afastamento"),
      C("data_inicio", "data de início do afastamento"),
      C("data_atestado", "data de emissão do atestado"),
      C("medico", "nome do médico"),
      C("crm", "CRM do médico"),
      C("observacao", "observação/descrição"),
    ],
  },
  {
    tipo: "rg",
    label: "RG / Carteira de identidade",
    campos: [
      C("nome", "nome"),
      C("numero", "número do RG"),
      C("orgao_emissor", "órgão expedidor (ex.: SSP)"),
      C("uf", "UF"),
      C("data_expedicao", "data de expedição"),
      C("data_nascimento", "data de nascimento"),
      C("naturalidade", "naturalidade"),
      C("filiacao_pai", "nome do pai"),
      C("filiacao_mae", "nome da mãe"),
      C("cpf", "CPF (se constar)"),
    ],
  },
  {
    tipo: "cpf",
    label: "CPF",
    campos: [C("nome", "nome"), C("numero", "número do CPF (só dígitos)"), C("data_nascimento", "data de nascimento"), C("situacao", "situação cadastral")],
  },
  {
    tipo: "cnh",
    label: "CNH (habilitação)",
    campos: [
      C("nome", "nome"),
      C("numero_registro", "nº de registro"),
      C("cpf", "CPF"),
      C("data_nascimento", "data de nascimento"),
      C("categoria", "categoria"),
      C("validade", "validade"),
      C("data_primeira_habilitacao", "data da 1ª habilitação"),
      C("orgao_emissor", "órgão emissor (Detran)"),
      C("uf", "UF"),
    ],
  },
  {
    tipo: "ctps",
    label: "Carteira de trabalho (CTPS)",
    campos: [
      C("nome", "nome"),
      C("numero", "número"),
      C("serie", "série"),
      C("uf", "UF"),
      C("cpf", "CPF"),
      C("pis", "PIS/PASEP"),
      C("data_nascimento", "data de nascimento"),
      C("filiacao", "filiação"),
    ],
  },
  {
    tipo: "titulo_eleitor",
    label: "Título de eleitor",
    campos: [
      C("nome", "nome"),
      C("numero", "nº do título"),
      C("zona", "zona"),
      C("secao", "seção"),
      C("municipio", "município"),
      C("uf", "UF"),
    ],
  },
  {
    tipo: "pis_pasep",
    label: "PIS/PASEP/NIT",
    campos: [C("nome", "nome"), C("numero", "número do PIS/PASEP/NIT"), C("data_cadastro", "data de cadastro")],
  },
  {
    tipo: "comprovante_pagamento",
    label: "Contracheque / holerite",
    campos: [
      C("nome", "nome do funcionário"),
      C("empresa", "empresa"),
      C("cnpj_empresa", "CNPJ da empresa"),
      C("competencia", "mês/competência"),
      C("cargo", "cargo"),
      C("salario_base", "salário-base"),
      C("total_proventos", "total de proventos"),
      C("total_descontos", "total de descontos"),
      C("valor_liquido", "valor líquido"),
      C("matricula", "matrícula"),
    ],
  },
  {
    tipo: "dados_bancarios",
    label: "Dados bancários / comprovante bancário",
    campos: [
      C("titular", "titular"),
      C("cpf_cnpj", "CPF/CNPJ do titular"),
      C("banco", "banco"),
      C("codigo_banco", "código do banco"),
      C("agencia", "agência"),
      C("conta", "conta"),
      C("tipo_conta", "tipo de conta (corrente/poupança)"),
      C("chave_pix", "chave PIX"),
    ],
  },
  {
    tipo: "passaporte",
    label: "Passaporte",
    campos: [
      C("nome", "nome"),
      C("numero", "número do passaporte"),
      C("nacionalidade", "nacionalidade"),
      C("data_nascimento", "data de nascimento"),
      C("data_emissao", "data de emissão"),
      C("data_validade", "validade"),
      C("orgao_emissor", "órgão emissor"),
    ],
  },
  {
    tipo: "curriculo",
    label: "Currículo (CV)",
    campos: [
      C("nome", "nome do candidato"),
      C("email", "e-mail"),
      C("telefone", "telefone"),
      C("cidade", "cidade"),
      C("uf", "UF"),
      C("linkedin", "LinkedIn/portfólio"),
      C("resumo_profissional", "resumo/objetivo profissional"),
      C("ultimo_cargo", "cargo mais recente"),
      C("ultima_empresa", "empresa mais recente"),
      C("anos_experiencia", "tempo total de experiência"),
      C("experiencias", "experiências (empresa · cargo · período), separadas por ' | '"),
      C("formacao", "formação principal (curso · instituição · ano)"),
      C("outras_formacoes", "demais formações, separadas por ' | '"),
      C("habilidades", "habilidades/competências, separadas por vírgula"),
      C("idiomas", "idiomas e níveis, separados por vírgula"),
      C("certificacoes", "certificações, separadas por ' | '"),
      C("pretensao_salarial", "pretensão salarial, se constar"),
    ],
  },
];

export const DOC_TIPOS = DOC_CATALOG.map((d) => d.tipo).concat("outro");

export function tipoPorChave(chave: string | null | undefined): DocTipo | undefined {
  return DOC_CATALOG.find((d) => d.tipo === chave);
}

/** Normaliza uma chave: minúsculas, sem acento, espaços/hífens → underscore. */
export function normalizarChave(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos combinantes
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Palavras que indicam pedido de ANÁLISE/redação livre (resumo, parecer…) em
 *  vez de extração de campos. */
const RX_ANALISE =
  /\bresum|\banalis|\banális|explique|explica[çc]|sintetiz|coment|avali|parecer|interpret|descrev|revis|traduz|reescrev|\bo que (é|diz|trata|fala|aborda)|sobre o que|principais pontos|pontos principais/i;

export type ModoExtracao = "extrair" | "analisar";

/** Resolve o modo: explícito vence; em `auto`, campos da tela → extrair, prompt
 *  de análise → analisar, senão extrair (documento estruturado). */
export function resolverModo(
  modo: string | null | undefined,
  temCampos: boolean,
  prompt: string | null | undefined,
): ModoExtracao {
  if (modo === "extrair" || modo === "analisar") return modo;
  if (temCampos) return "extrair";
  const p = String(prompt ?? "").trim();
  if (p) return RX_ANALISE.test(p) ? "analisar" : "extrair";
  return "extrair";
}

/** Catálogo em texto compacto para o prompt (tipo → chaves canônicas). */
export function catalogoParaPrompt(): string {
  return DOC_CATALOG.map((d) => `- ${d.tipo} (${d.label}): ${d.campos.map((c) => c.chave).join(", ")}`).join("\n") + "\n- outro (qualquer outro): use chaves descritivas em snake_case";
}

/** Monta o objeto PADRÃO do tipo: TODAS as chaves canônicas (faltantes = null),
 *  casando os campos extraídos pela chave normalizada. Extras (não canônicos)
 *  entram também. */
export function montarDados(
  tipo: DocTipo | undefined,
  campos: { campo: string; valor: string; confianca: number }[],
): Record<string, { valor: string | null; confianca: number }> {
  const achados = new Map<string, { valor: string; confianca: number }>();
  for (const c of campos) achados.set(normalizarChave(c.campo), { valor: c.valor, confianca: c.confianca });
  const out: Record<string, { valor: string | null; confianca: number }> = {};
  if (tipo) {
    for (const cc of tipo.campos) {
      const hit = achados.get(cc.chave);
      out[cc.chave] = hit ? { valor: hit.valor, confianca: hit.confianca } : { valor: null, confianca: 0 };
    }
  }
  // extras não previstos no schema canônico
  for (const [k, v] of achados) if (!(k in out)) out[k] = v;
  return out;
}
