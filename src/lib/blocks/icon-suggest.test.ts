import { describe, it, expect } from "vitest";
import { iconePorContexto } from "./icon-suggest";
import { ICONS } from "./icons";

describe("iconePorContexto", () => {
  it("sem sinal nenhum → null", () => {
    expect(iconePorContexto("", [])).toBeNull();
    // Título sem nenhuma palavra-chave conhecida também não força um ícone.
    expect(iconePorContexto("Xyzzy Qwerty", [])).toBeNull();
  });

  it("casa pelo próprio título do diretório", () => {
    expect(iconePorContexto("Configurações do sistema")).toBe("settings");
    expect(iconePorContexto("Banco de Dados")).toBe("database");
    expect(iconePorContexto("Segurança e acesso")).toBe("shield");
  });

  it("sempre devolve uma CHAVE que existe no catálogo ICONS", () => {
    const key = iconePorContexto("Calendário de eventos", ["Agenda da semana"]);
    expect(key).not.toBeNull();
    expect(key && key in ICONS).toBe(true);
  });

  it("o título do diretório pesa mais que os filhos", () => {
    // Título fala de calendário; um único filho fala de código não vira 'code'.
    const key = iconePorContexto("Calendário e agenda", ["Rotina de código"]);
    expect(key).toBe("calendar");
  });

  it("usa os títulos dos filhos quando o título do diretório é genérico", () => {
    // "Geral" não casa nada; os filhos falam de usuários/equipe.
    const key = iconePorContexto("Geral", ["Cadastro de usuários", "Equipe e permissões"]);
    expect(key).toBe("users");
  });
});
