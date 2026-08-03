import { describe, it, expect } from "vitest";
import { identityFromTrack, buildModelSchema, resolveParams } from "./params";
import type { ToolParam } from "./tools";

describe("identityFromTrack", () => {
  it("mapeia p_* para os campos de identidade do motor", () => {
    const id = identityFromTrack({
      p_base: "ACME",
      p_usuario: "u1",
      p_empresa: "77",
      p_matricula: "12345",
      p_perfil: "gestor",
      p_portal: "rh",
    });
    expect(id).toEqual({
      usuario: "u1",
      cod_empresa: "77", // p_empresa → cod_empresa
      matricula: "12345",
      perfil: "gestor",
      portal: "rh",
      base: "ACME", // p_base → base (campo de identidade p/ a tool receber o cliente do token)
    });
  });

  it("deixa campos ausentes como undefined", () => {
    const id = identityFromTrack({ p_usuario: "só-esse" });
    expect(id.usuario).toBe("só-esse");
    expect(id.matricula).toBeUndefined();
  });
});

describe("buildModelSchema + resolveParams (fim a fim, sem HTTP)", () => {
  const params: ToolParam[] = [
    { nome: "cod_empresa", descricao: "", tipo: "string", origem: "identidade", obrigatorio: true, local: "query", campoIdentidade: "cod_empresa" },
    { nome: "competencia", descricao: "Mês", tipo: "date", origem: "modelo", obrigatorio: true, local: "query", mascara: "MM/yyyy" },
    { nome: "tipo", descricao: "", tipo: "enum", origem: "fixo", obrigatorio: false, local: "query", valorFixo: "proventos" },
  ];

  it("expõe ao modelo só o parâmetro origem=modelo", () => {
    expect(Object.keys(buildModelSchema(params).shape)).toEqual(["competencia"]);
  });

  it("resolve identidade + fixo + máscara na competência", () => {
    const identity = identityFromTrack({ p_empresa: "77" });
    const b = resolveParams(params, { competencia: "2026-08-01" }, identity);
    expect(b.query).toEqual({ cod_empresa: "77", competencia: "08/2026", tipo: "proventos" });
  });
});

describe("resolveParams — origem 'pessoa' (matrícula-alvo por painel)", () => {
  const params: ToolParam[] = [
    { nome: "matricula", descricao: "", tipo: "string", origem: "pessoa", obrigatorio: true, local: "query", campoIdentidade: "matricula" },
  ];
  it("usa a matrícula-ALVO do modelo quando informada (ex.: Operador consultando outro)", () => {
    const identity = identityFromTrack({ p_matricula: "123" });
    expect(resolveParams(params, { matricula: "999" }, identity).query).toEqual({ matricula: "999" });
  });
  it("cai para a matrícula do PRÓPRIO usuário quando o modelo não informa", () => {
    const identity = identityFromTrack({ p_matricula: "123" });
    expect(resolveParams(params, {}, identity).query).toEqual({ matricula: "123" });
    expect(resolveParams(params, { matricula: "" }, identity).query).toEqual({ matricula: "123" });
  });
  it("expõe o parâmetro 'pessoa' no schema do modelo (opcional)", () => {
    const schema = buildModelSchema(params);
    expect(schema.safeParse({}).success).toBe(true); // opcional
    expect(schema.safeParse({ matricula: "999" }).success).toBe(true);
  });
  it("BATCHING: matrícula-alvo que é param de loop-values vira LISTA no schema", () => {
    const schema = buildModelSchema(params, { unit: "values", param: "matricula", max: 20 });
    // aceita uma LISTA de matrículas (o servidor consulta cada uma e junta)…
    expect(schema.safeParse({ matricula: ["345", "5577", "32409"] }).success).toBe(true);
    // …e continua opcional (vazio = o próprio usuário, resolvido no servidor).
    expect(schema.safeParse({}).success).toBe(true);
    // string solta não bate o schema de lista (a IA é levada a mandar array).
    expect(schema.safeParse({ matricula: "345" }).success).toBe(false);
  });
});

describe("buildModelSchema — loop BATCH (API aceita lista por vírgula)", () => {
  const params: ToolParam[] = [
    { nome: "p_matricula", descricao: "Matrículas", tipo: "string", origem: "modelo", obrigatorio: false, local: "query" },
    { nome: "p_empresa", descricao: "Empresa", tipo: "string", origem: "modelo", obrigatorio: false, local: "query" },
  ];
  it("o parâmetro do batch vira LISTA; os demais seguem normais", () => {
    const schema = buildModelSchema(params, { unit: "batch", param: "p_matricula", max: 20 });
    expect(schema.safeParse({ p_matricula: ["123", "344", "502"] }).success).toBe(true);
    expect(schema.safeParse({ p_matricula: "123" }).success).toBe(false); // leva a IA a mandar a lista
    expect(schema.safeParse({ p_empresa: "700" }).success).toBe(true); // outro param segue string
  });
});
