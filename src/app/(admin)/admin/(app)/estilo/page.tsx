import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/auth/permissions";
import { EstiloView } from "./estilo-view";

/**
 * A BANCADA DO SISTEMA DE DESIGN.
 *
 * Todo primitivo, em todos os estados, numa página só. Serve a três donos ao
 * mesmo tempo, e é por isso que compensa:
 *
 *  · quem decide — revisa o sistema inteiro sem caçar a tela onde cada estado
 *    aparece (um `Skeleton` só existe durante 400ms de carregamento, e um
 *    `ErroDaRota` só quando algo quebra: ninguém consegue julgar o que não vê);
 *  · o Playwright — um alvo estável para snapshot em claro e escuro, que é o
 *    que torna seguro mexer em token com o produto sem cobertura visual;
 *  · quem for escrever o próximo componente — a resposta a "já existe algo pra
 *    isso?" fica a um clique, e é isso que impede o sétimo estilo de botão.
 *
 * Escolhida em vez do Storybook porque entrega quase todo esse valor dentro da
 * própria stack, com os providers reais montados (tema, toast, confirm) — um
 * Storybook precisaria remontá-los e passaria a mentir sobre o produto conforme
 * divergissem.
 *
 * Fica atrás de `ai.configure` (nível 80): é ferramenta de quem constrói.
 */
export default async function EstiloPage() {
  if (!(await hasPermission("ai.configure"))) notFound();
  return <EstiloView />;
}
