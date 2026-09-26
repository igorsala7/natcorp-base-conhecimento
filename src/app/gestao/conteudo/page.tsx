import { abrirSessaoGestao, paramsDaSessao, registrarAcessoSuporte } from "@/lib/gestao/sessao";
import { createAdminClient } from "@/lib/supabase/admin";
import { ShellGestao, RecusaGestao, Bloco, FaixaResumo } from "@/components/gestao/shell";
import { ConteudoPainel, type ItemDeConteudo } from "@/components/gestao/conteudo-painel";
import { ArquivosPainel, type ArquivoNaTela } from "@/components/gestao/arquivos-painel";
import { pocoUniversal, regraAlcancaBase } from "@/lib/documentacoes/universais";
import { arquivosDaBase } from "@/lib/documentacoes/arquivos-da-base";
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

  const [poco, { data: ajustesRows }, vocab, leituraDeArquivos] = await Promise.all([
    pocoUniversal(),
    // Uma linha por documentação ajustada nesta base: tabela de configuração,
    // sem teto de paginação a estourar.
    db.from("ai_base_documentacoes").select("space_id, enabled, regra").eq("base_id", baseId),
    lerVocabulario(baseCode),
    /*
      Os arquivos DESTA empresa. Sempre da base da SESSÃO: `arquivosDaBase`
      filtra por `base_id` e pagina por consulta, e é a mesma leitura que a
      action de listagem usa. Lido no servidor, junto com o resto, para a
      seção nascer preenchida — uma busca no cliente ao montar mostraria um
      vazio que não é vazio.

      E ela devolve `falhou` junto: lista vazia e leitura quebrada davam o
      mesmo valor, e a tela apresentava o nosso defeito como convite para
      anexar. O sinalizador atravessa até a tela por isso.
    */
    arquivosDaBase(baseId),
  ]);

  const ajustes = new Map(
    (ajustesRows ?? []).map((a) => [a.space_id, { enabled: a.enabled, regra: (a.regra ?? {}) as Regra }] as const),
  );

  const daNossaBase = (regra: Regra) => regraAlcancaBase(regra, baseCode);

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
    Sobra de configuração: uma linha de `ai_base_documentacoes` que aponta para
    uma documentação que não está mais na lista que a empresa alcança. DUAS
    causas bem diferentes, e a tela precisa dizer qual é cada uma — é o que o
    leitor usa para decidir se a ação dele é "pedir para a Natcorp liberar" ou
    "não há nada a fazer":

      · RESTRINGIDA A OUTROS: a documentação continua no poço (`enabled = true`
        em `documentacoes_universais`), só que a regra da Natcorp agora exclui
        esta base pela dimensão `base`. A Natcorp NÃO parou de oferecer — só não
        oferece mais para esta empresa;
      · NÃO OFERECIDA: a documentação saiu do poço de vez (`enabled = false`, ou
        a linha nem existe mais).

    Vai para a tela SEM NOME, de propósito, nos dois casos: nomear exigiria ler
    `spaces`, e no caso "restringida a outros" o nome dela não é para ser lido
    aqui. Esconder a sobra inteira seria pior — quem ocultou uma documentação e
    não a vê mais na lista não teria como desfazer.
  */
  const oferecidos = new Set(itens.map((i) => i.spaceId));
  const pocoPorId = new Map(poco.map((d) => [d.spaceId, d] as const));
  const orfas = [...ajustes.keys()].filter((id) => !oferecidos.has(id));
  const orfasRestringidasAOutros = orfas.filter((id) => pocoPorId.has(id));
  const orfasNaoOferecidas = orfas.filter((id) => !pocoPorId.has(id));

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
          orfas={{ restringidasAOutros: orfasRestringidasAOutros, naoOferecidas: orfasNaoOferecidas }}
          presencas={{ porDimensao: vocab.porDimensao, conversas: vocab.conversas }}
        />
      </Bloco>

      {/*
        OS ARQUIVOS DA EMPRESA, logo abaixo das documentações e na MESMA aba.
        As duas seções respondem à mesma pergunta — "sobre o que o assistente
        responde aqui, e para quem" —, e separá-las em abas obrigaria o leitor a
        procurar em dois lugares o que ele pensa como uma coisa só.

        O `storagePath` de cada arquivo NÃO atravessa para o cliente: a tela não
        precisa dele, e quem baixa passa por `/api/v1/arquivo/[id]`, que confere
        dono, liberação e alcance antes de assinar. Mandar o caminho junto seria
        publicar a localização de um arquivo que a regra pode fechar.
      */}
      <Bloco
        titulo="Arquivos da sua empresa"
        descricao="Documentos, manuais e mídias que são só da sua empresa. Você escolhe, arquivo por arquivo, se o assistente responde com o conteúdo dele, se ele fica disponível para download no chat, e quem alcança cada um."
      >
        <ArquivosPainel
          sessao={paramsDaSessao(sessao)}
          modo={sessao.modo}
          baseCode={baseCode}
          baseNome={baseNome}
          falhaDeLeitura={leituraDeArquivos.falhou}
          arquivos={leituraDeArquivos.arquivos.map(
            (a): ArquivoNaTela => ({
              id: a.id,
              nome: a.nome,
              tamanhoBytes: a.tamanhoBytes,
              mime: a.mime,
              status: a.status,
              naBaseDeConhecimento: a.naBaseDeConhecimento,
              downloadLiberado: a.downloadLiberado,
              regra: a.regra,
              criadoEm: a.criadoEm,
              erro: a.erro,
            }),
          )}
          presencas={{ porDimensao: vocab.porDimensao, conversas: vocab.conversas }}
        />
      </Bloco>
    </ShellGestao>
  );
}
