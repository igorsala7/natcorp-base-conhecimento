import { describe, it, expect } from "vitest";
import { recortarMeusDados, blocoMeusDados } from "./meus-dados";

// Payload real de `meus_dados` (recortado), incluindo os campos sensíveis.
const PAYLOAD = {
  items: [{
    cod_empresa: 700, nome_empresa: "NATCORP DO BRASIL", cnpj: "01.111.075/0001-08",
    filial: 97, nome_filial: "LOJA 97 - ESCRITÓRIO RH/MG",
    centro_de_custo: 10970101, nome_centro_de_custo: null,
    cod_unidade_adm: 97, nome_unidade_adm: "LOJA 97 - ESCRITÓRIO RH/MGG",
    matricula: 365785, cod_candidato: 913867, nome: "FERNANDO MATTOS TORRES", nome_social: null,
    dt_nascimento: "30/09/1963", sexo: "Masculino",
    email_funcional: "patricia.mota@natcorp.com.br", email_pessoal: "igorsala7@gmail.com",
    celular_pessoal: "+55(11)98266-4699", cpf: "070.386.368-12",
    dt_admissao: "09/11/2009", situacao_funcional: "ATIVO", descricao_situacao_funcional: null,
  }],
};

describe("recortarMeusDados", () => {
  const dados = recortarMeusDados(PAYLOAD);
  const texto = JSON.stringify(dados);

  it("traz a lotação e o vínculo, que é o que o agente precisa", () => {
    expect(texto).toContain("700");
    expect(texto).toContain("NATCORP DO BRASIL");
    expect(texto).toContain("10970101");
    expect(texto).toContain("365785");
    expect(texto).toContain("09/11/2009");
    expect(texto).toContain("ATIVO");
  });

  it("traz CPF, contatos, nascimento e sexo — decisão explícita do responsável", () => {
    // Foram deliberadamente INCLUÍDOS (07/08/2026). Se um dia forem retirados,
    // este teste é o lugar de registrar a volta atrás.
    for (const campo of ["070.386.368-12", "igorsala7@gmail.com", "patricia.mota", "98266-4699", "30/09/1963", "Masculino"])
      expect(texto).toContain(campo);
  });

  it("continua ALLOWLIST: campo novo da API fica de fora por padrão", () => {
    // Mesmo com os pessoais liberados, o que a ORDS acrescentar amanhã só entra
    // quando alguém decidir — nunca em silêncio.
    const comNovo = recortarMeusDados({ items: [{ nome: "X", salario_liquido: "9999,00", conta_bancaria: "12345-6" }] });
    expect(JSON.stringify(comNovo)).not.toContain("9999");
    expect(JSON.stringify(comNovo)).not.toContain("12345-6");
  });

  it("descarta vazio e o literal 'null' — senão o modelo repete 'null' ao usuário", () => {
    expect(texto).not.toContain("null");
    const so = recortarMeusDados({ items: [{ nome: "X", nome_filial: "", cargo: null }] });
    expect(so).toEqual([{ rotulo: "Nome", valor: "X" }]);
  });

  it("aceita objeto solto além de {items:[…]}, e payload inválido vira lista vazia", () => {
    expect(recortarMeusDados({ nome: "Y" })).toEqual([{ rotulo: "Nome", valor: "Y" }]);
    expect(recortarMeusDados(null)).toEqual([]);
    expect(recortarMeusDados({ items: [] })).toEqual([]);
  });
});

describe("blocoMeusDados", () => {
  it("sem dados, não gera cabeçalho órfão", () => {
    expect(blocoMeusDados([])).toBe("");
  });

  it("avisa para NÃO usar como filtro em pedido amplo", () => {
    const b = blocoMeusDados(recortarMeusDados(PAYLOAD));
    expect(b).toMatch(/n[ãa]o use como filtro/i);
    expect(b).toContain("em branco");
  });

  it("manda usar a ferramenta para o que ficou de fora da lista", () => {
    expect(blocoMeusDados(recortarMeusDados(PAYLOAD))).toMatch(/N[ÃA]O esteja nesta lista.*use a ferramenta/i);
  });
});
