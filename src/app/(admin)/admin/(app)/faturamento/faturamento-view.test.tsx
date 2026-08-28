import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

/**
 * O recorte da tela vive na URL (`useAbaAtual`), e fora do router do Next o
 * `useSearchParams` devolve null. O componente sob prova é a TABELA e os
 * números, não a navegação por abas — que tem teste próprio em `tabs`.
 */
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/faturamento",
  useRouter: () => ({ replace: () => {}, push: () => {} }),
}));

import { FaturamentoView } from "./faturamento-view";
import type { LinhaFaturamento } from "@/lib/billing/pricing";

/**
 * A tela renderiza, e mostra o custo unitário certo.
 *
 * Por que existe: `/admin/faturamento` exige sessão, então subir o servidor só
 * prova que a rota redireciona para o login — o componente nem chega a rodar.
 * Este teste é o que de fato exercita a renderização, e ainda fixa os números.
 *
 * As linhas são REAIS, de `faturamento_detalhe` sobre os 14 dias encerrados em
 * 28/08/2026 — a mesma regra dos testes de `pricing`: dado inventado testaria a
 * aritmética, não o acordo com o banco.
 */

const linha = (over: Partial<LinhaFaturamento>): LinhaFaturamento => ({
  cliente: "natcorp",
  origem: "widget",
  kind: "user",
  provider: "google",
  model: "gemini-3.6-flash",
  purpose: "chat",
  chamadas: 1,
  entrada_total: 0,
  entrada_nova: 0,
  cache_read: 0,
  cache_write: 0,
  saida: 0,
  tokens_brutos: 0,
  tokens_ponderados: 0,
  cache_read_mult: 0.1,
  cache_write_mult: 1.0,
  preco_confirmado: true,
  custo_usd: null,
  ...over,
});

/** natcorp: 38,6 Mtok · US$ 34,48 · US$/M 0,8929 (medido em 28/08). */
const NATCORP = linha({
  cliente: "natcorp",
  tokens_brutos: 38_614_000,
  tokens_ponderados: 30_000_000,
  entrada_total: 30_000_000,
  saida: 8_614_000,
  custo_usd: 34.48,
});
/** leadec: o cliente mais barato do período, US$/M 0,7481. */
const LEADEC = linha({
  cliente: "leadec",
  tokens_brutos: 4_050_000,
  tokens_ponderados: 3_500_000,
  custo_usd: 3.03,
});

const render = (linhas: LinhaFaturamento[], over?: Partial<Parameters<typeof FaturamentoView>[0]>) =>
  renderToString(
    <FaturamentoView
      cobravel={linhas}
      naoCobravel={[]}
      base="bruto"
      usdPorMtok={5}
      cobrarOverhead
      periodo={{ de: "2026-08-14", ate: "2026-08-28" }}
      {...over}
    />,
  );

describe("FaturamentoView — custo por milhão", () => {
  it("renderiza sem quebrar e mostra o rótulo do custo unitário", () => {
    const html = render([NATCORP, LEADEC]);
    expect(html).toContain("Custo por milhão pago");
  });

  it("mostra o custo por milhão de CADA cliente, não só o total", () => {
    // Foi o pedido: a média sozinha esconde que um cliente custa 38% mais que
    // outro. Os dois valores precisam aparecer lado a lado.
    const html = render([NATCORP, LEADEC]);
    expect(html).toContain("0,8929");
    expect(html).toContain("0,7481");
  });

  it("quatro casas decimais — duas apagariam a diferença entre modelos", () => {
    // O embedding sai por US$ 0,150/M e o lite por US$ 0,342/M: arredondar para
    // centavos tornaria a coluna inútil justamente para comparar.
    const html = render([linha({ tokens_brutos: 1_000_000, custo_usd: 0.15 })]);
    expect(html).toContain("0,1500");
  });

  it("sem preço confirmado mostra travessão, nunca zero", () => {
    // Custo desconhecido exibido como 0,0000 leria como "de graça".
    const html = render([
      linha({ tokens_brutos: 1_000_000, custo_usd: null, preco_confirmado: false }),
    ]);
    expect(html).not.toContain("0,0000");
    expect(html).toContain("sem preço cadastrado");
  });

  it("a legenda do US$/M é TEXTO na página, não atributo title", () => {
    // A catraca de UI recusa `title` como tooltip: não existe em toque nem em
    // leitor de tela. A explicação da coluna nova tem de estar no corpo.
    const html = render([NATCORP]);
    expect(html).toContain("é o que você paga por milhão de tokens");
    expect(html).not.toContain('title="Custo dividido');
  });

  it("período vazio não quebra a tela", () => {
    expect(() => render([])).not.toThrow();
  });
});
