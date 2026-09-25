import { abrirSessaoGestao, paramsDaSessao, registrarAcessoSuporte } from "@/lib/gestao/sessao";
import { createAdminClient } from "@/lib/supabase/admin";
import { ShellGestao, RecusaGestao, Bloco, FaixaResumo } from "@/components/gestao/shell";
import { ConteudoPainel, type ItemDeConteudo } from "@/components/gestao/conteudo-painel";
import { pocoUniversal } from "@/lib/documentacoes/universais";
import { lerVocabulario } from "@/lib/documentacoes/vocabulario";
import { regraSemCliente } from "@/lib/documentacoes/dimensoes-ui";
import type { Regra } from "@/lib/elegibilidade";

/**
 * CONTEÚDO — sobre o que o assistente responde nesta empresa, e para quem.
 *
 * ── Por que a aba se chama "Conteúdo" ─────────────────────────────────
 * Ela nasce com as documentações e vai receber os ARQUIVOS da própria empresa
 * (PDF, Word, mídia — o projeto 2). Uma aba chamada "Documentações" teria de ser
 * renomeada quando isso chegar, e renomear aba é churn que o usuário percebe:
 * ele já aprendeu onde clicar.
 *
 * ── Tudo lido pelo cliente ADMIN, e o motivo é estrutural ─────────────
 * Esta área não tem sessão do Supabase: a identidade é o token assinado que o
 * APEX entrega. A RLS das duas tabelas exige `ai.configure`, permissão de admin
 * técnico que o cliente não tem e não deve ter — lendo pela sessão, a tela
 * simplesmente viria vazia. Quem autoriza é `abrirSessaoGestao`, na linha de
 * cima, e é por isso que ela vem ANTES de qualquer leitura.
 *
 * ── A OFERTA é filtrada por base ANTES de chegar à tela ───────────────
 * Uma documentação universal pode ter regra restringindo por cliente. Se ela não
 * vale para esta base, não é oferta desta base e não entra na lista — e a frase
 * que a tela mostra sai SEM a dimensão de cliente, porque o operador de um
 * cliente não pode ler o código de outro numa tela nossa.
 */
export default async function GestaoConteudoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sessao = await abrirSessaoGestao(sp);
  if (!sessao.ok) return <RecusaGestao mensagem={sessao.mensagem} />;
  await registrarAcessoSuporte(sessao, "conteudo");

  const { baseCode, baseId, baseNome } = sessao.identidade;
  const db = createAdminClient();

  const [poco, { data: ajustesRows }, vocab] = await Promise.all([
    pocoUniversal(),
    // Uma linha por documentação ajustada nesta base: tabela de configuração,
    // sem teto de paginação a estourar.
    db.from("ai_base_documentacoes").select("space_id, enabled, regra").eq("base_id", baseId),
    lerVocabulario(baseCode),
  ]);

  const ajustes = new Map(
    (ajustesRows ?? []).map((a) => [a.space_id, { enabled: a.enabled, regra: (a.regra ?? {}) as Regra }] as const),
  );

  const daNossaBase = (regra: Regra) => {
    const lista = (regra.base ?? []).filter((b) => b && b.trim());
    if (lista.length === 0) return true;
    return lista.some((b) => b.trim().toLowerCase() === baseCode.trim().toLowerCase());
  };

  const itens: ItemDeConteudo[] = poco
    .filter((d) => daNossaBase(d.regra))
    .map((d) => ({
      spaceId: d.spaceId,
      nome: d.nome,
      // A dimensão de cliente sai da regra MOSTRADA: ela é verdadeira por
      // construção (o filtro acima garante que esta base passa) e, com dois
      // clientes na lista, imprimiria o código do outro na tela deste.
      regraNatcorp: regraSemCliente(d.regra),
      ajuste: ajustes.get(d.spaceId) ?? null,
    }));

  /*
    Sobra de configuração: a empresa ajustou uma documentação que a Natcorp
    depois tirou da oferta (ou restringiu a outros clientes). A linha continua no
    banco e não tem mais efeito nenhum.

    Vai para a tela SEM NOME, de propósito, e como um bloco só com um botão de
    limpar: nomear exigiria ler `spaces`, e no caso em que a documentação foi
    restringida a outro cliente o nome dela não é para ser lido aqui. Esconder a
    sobra inteira seria pior — quem ocultou uma documentação e não a vê mais na
    lista não teria como desfazer.
  */
  const oferecidos = new Set(itens.map((i) => i.spaceId));
  const orfas = [...ajustes.keys()].filter((id) => !oferecidos.has(id));

  const ocultas = itens.filter((i) => i.ajuste && !i.ajuste.enabled).length;
  const ajustadas = itens.filter((i) => i.ajuste?.enabled).length;
  const alcancaveis = itens.length - ocultas;

  return (
    <ShellGestao
      sessao={sessao}
      atual="conteudo"
      titulo="Conteúdo"
      descricao="Sobre o que o assistente responde para os seus usuários, e quem alcança cada assunto."
    >
      {itens.length === 0 ? (
        <FaixaResumo
          frase={
            <>
              A Natcorp ainda não disponibilizou documentação para a{" "}
              <strong>{baseNome}</strong>. Enquanto isso, o assistente continua respondendo com o
              que foi definido na instalação dele.
            </>
          }
        />
      ) : (
        <FaixaResumo
          numero={String(alcancaveis)}
          unidade={alcancaveis === 1 ? "assunto" : "assuntos"}
          tom={ocultas > 0 ? "atencao" : "neutro"}
          frase={
            ocultas > 0 ? (
              <>
                Seus usuários alcançam {alcancaveis} de {itens.length} documentações.{" "}
                {ocultas === 1 ? "Uma está oculta" : `${ocultas} estão ocultas`} por escolha sua — o
                assistente não responde sobre {ocultas === 1 ? "esse assunto" : "esses assuntos"}.
              </>
            ) : (
              <>Seus usuários alcançam todas as documentações disponíveis para a {baseNome}.</>
            )
          }
          apoio={[
            { rotulo: "Como a Natcorp definiu", valor: String(itens.length - ocultas - ajustadas) },
            { rotulo: "Ajustadas por você", valor: String(ajustadas) },
            { rotulo: "Ocultas", valor: String(ocultas) },
          ]}
        />
      )}

      <Bloco
        titulo="Documentações"
        descricao="O que a Natcorp disponibiliza para a sua empresa. Você pode esconder uma documentação dos seus usuários ou escolher quem dentro da empresa alcança cada uma."
      >
        <ConteudoPainel
          sessao={paramsDaSessao(sessao)}
          modo={sessao.modo}
          baseCode={baseCode}
          baseNome={baseNome}
          itens={itens}
          orfas={orfas}
          presencas={{ porDimensao: vocab.porDimensao, conversas: vocab.conversas }}
        />
      </Bloco>
    </ShellGestao>
  );
}
