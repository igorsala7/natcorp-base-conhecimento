import { abrirSessaoGestao, paramsDaSessao, registrarAcessoSuporte } from "@/lib/gestao/sessao";
import {
  listarParaAdmin,
  listarCategorias,
  vocabularioDaBase,
  PORTAIS,
} from "@/lib/prompts/sugeridos";
import { ShellGestao, RecusaGestao, Bloco } from "@/components/gestao/shell";
import { PromptsSugeridos } from "@/components/gestao/prompts-form";

/**
 * Prompts prontos — o que o usuário encontra clicando, em vez de escrever.
 *
 * ── Por que os dois catálogos moram na MESMA tela ─────────────────────
 * O que o usuário final vê no widget é a soma do catálogo da Natcorp com o do
 * cliente, misturados numa lista só. Separar isso em duas telas faria a
 * pergunta mais frequente ("por que ele está vendo este prompt?") exigir abrir
 * duas páginas e juntar de cabeça. Aqui as duas abas mostram exatamente as duas
 * metades, e a de cima diz de quem é.
 *
 * O cliente VÊ o catálogo da Natcorp e não edita — saber o que já vem pronto é
 * o que evita cadastrar de novo o mesmo prompt. Editar exige modo suporte.
 */
export default async function GestaoPromptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sessao = await abrirSessaoGestao(sp);
  if (!sessao.ok) return <RecusaGestao mensagem={sessao.mensagem} />;
  await registrarAcessoSuporte(sessao, "prompts");

  const base = sessao.identidade.baseCode;
  const [doCliente, daNatcorp, categoriasBase, categoriasGlobais, vocab] = await Promise.all([
    listarParaAdmin(base),
    listarParaAdmin(null),
    listarCategorias(base),
    listarCategorias(null),
    vocabularioDaBase(base),
  ]);

  return (
    <ShellGestao
      sessao={sessao}
      atual="prompts"
      titulo="Prompts prontos"
      descricao="Perguntas já escritas que aparecem no assistente para quem tem dificuldade de formular o que quer. Quem vê cada uma é você que decide, por portal, perfil e usuário."
    >
      <Bloco
        titulo="Catálogo"
        descricao="O usuário vê estes prompts no assistente, junto com os que ele mesmo salvou. Sem restrição, o prompt vale para todo mundo da base."
      >
        <PromptsSugeridos
          sessao={paramsDaSessao(sessao)}
          modo={sessao.modo}
          baseNome={sessao.identidade.baseNome}
          doCliente={doCliente}
          daNatcorp={daNatcorp}
          categoriasBase={categoriasBase}
          categoriasGlobais={categoriasGlobais}
          portais={PORTAIS}
          perfis={vocab.perfis}
        />
      </Bloco>
    </ShellGestao>
  );
}
