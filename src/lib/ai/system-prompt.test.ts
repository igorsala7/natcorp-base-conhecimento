import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  withContext,
  resolvePersona,
  resolveRegras,
  REGRAS_ABSOLUTAS,
  PERSONA_PADRAO,
  type PersonaOpts,
} from "./prompt-cascade";
import { composeSystemPrompt, RECONCILIACAO_FERRAMENTAS } from "./system-prompt";

const CTX = "[1] Manual › Férias\nConteúdo de exemplo.";

/** Monta pelo compositor a partir das MESMAS entradas de buildSystemPrompt. */
function viaComposer(o: PersonaOpts & { regrasAbsolutas?: string | null }, ctx: string, extra = {}) {
  return composeSystemPrompt(
    { persona: resolvePersona(o), regras: resolveRegras(o.regrasAbsolutas), ...extra },
    ctx,
  );
}

describe("composeSystemPrompt — compatibilidade byte-idêntica", () => {
  const casos: (PersonaOpts & { regrasAbsolutas?: string | null })[] = [
    {},
    { promptDoEspaco: "Persona do espaço." },
    { promptDaChave: "Persona da chave.", promptDoEspaco: "Persona do espaço." },
    { personaPadrao: "Persona padrão custom." },
    { regrasAbsolutas: "REGRAS ABSOLUTAS custom." },
    { promptDaChave: "  \n ", promptDoEspaco: "Cai no espaço." },
  ];
  it.each(casos)("sem seções novas === withContext(buildSystemPrompt) (%#)", (o) => {
    expect(viaComposer(o, CTX)).toBe(withContext(buildSystemPrompt(o), CTX));
  });

  it("caso mais simples reproduz o formato persona\\n\\nregras\\n\\nCONTEXTO:", () => {
    expect(viaComposer({}, CTX)).toBe(`${PERSONA_PADRAO}\n\n${resolveRegras(null)}\n\nCONTEXTO:\n${CTX}`);
  });
});

describe("composeSystemPrompt — seções e ordem", () => {
  it("ordem: persona < especialização < ferramentas < regras < reconciliação < CONTEXTO", () => {
    const out = composeSystemPrompt(
      {
        persona: "PERSONA_X",
        especializacao: "Você é a Nati.",
        usoFerramentas: "Você tem FERRAMENTAS.",
        regras: REGRAS_ABSOLUTAS,
        comTools: true,
      },
      CTX,
    );
    const i = (s: string) => out.indexOf(s);
    expect(i("PERSONA_X")).toBeGreaterThanOrEqual(0);
    expect(i("PERSONA_X")).toBeLessThan(i("ESPECIALIZAÇÃO DO ATENDIMENTO:"));
    expect(i("ESPECIALIZAÇÃO DO ATENDIMENTO:")).toBeLessThan(i("USO DAS FERRAMENTAS:"));
    expect(i("USO DAS FERRAMENTAS:")).toBeLessThan(i("REGRAS ABSOLUTAS"));
    expect(i("REGRAS ABSOLUTAS")).toBeLessThan(i(RECONCILIACAO_FERRAMENTAS));
    expect(i(RECONCILIACAO_FERRAMENTAS)).toBeLessThan(i("CONTEXTO:"));
    expect(out).toContain("Você é a Nati.");
  });

  it("seções vazias são omitidas (sem cabeçalho nem linha em branco extra)", () => {
    const out = composeSystemPrompt({ persona: "P", especializacao: "  ", usoFerramentas: "", regras: "R" }, CTX);
    expect(out).toBe(`P\n\nR\n\nCONTEXTO:\n${CTX}`);
    expect(out).not.toContain("ESPECIALIZAÇÃO");
    expect(out).not.toContain("USO DAS FERRAMENTAS");
  });

  it("reconciliação só aparece com comTools", () => {
    const semTools = composeSystemPrompt({ persona: "P", regras: "R" }, CTX);
    const comTools = composeSystemPrompt({ persona: "P", regras: "R", comTools: true }, CTX);
    expect(semTools).not.toContain(RECONCILIACAO_FERRAMENTAS);
    expect(comTools).toContain(RECONCILIACAO_FERRAMENTAS);
  });

  it("linguagem/canal entra antes das regras", () => {
    const out = composeSystemPrompt(
      { persona: "P", linguagem: "FORMATAÇÃO (WhatsApp): use *asteriscos*.", regras: "REGRAS ABSOLUTAS ..." },
      CTX,
    );
    expect(out.indexOf("FORMATAÇÃO (WhatsApp)")).toBeLessThan(out.indexOf("REGRAS ABSOLUTAS"));
    expect(out.indexOf("P")).toBeLessThan(out.indexOf("FORMATAÇÃO (WhatsApp)"));
  });
});
