import { abrirSessaoGestao, paramsDaSessao, registrarAcessoSuporte } from "@/lib/gestao/sessao";
import { ShellGestao, RecusaGestao, Bloco, FaixaResumo } from "@/components/gestao/shell";
import { ComunicacaoPainel, type CampanhaNaTela } from "@/components/gestao/comunicacao-painel";
import { campanhasDaBase } from "@/lib/campanhas/dados";
import { estadoDaCampanha } from "@/lib/campanhas/campanha";
import { lerVocabulario } from "@/lib/documentacoes/vocabulario";

/**
 * COMUNICAÇÃO — os avisos que aparecem no chatbot, e quem visualizou cada um.
 *
 * ── Por que a aba fica ao lado de Conteúdo ────────────────────────────────
 * As duas respondem à mesma pergunta do operador de RH: "o que o assistente diz
 * para a minha gente?". Conteúdo é o que ele responde quando perguntam;
 * Comunicação é o que ele diz sem ninguém perguntar. Conversas, a aba seguinte,
 * continua sendo a de OLHAR o que aconteceu.
 *
 * ── Tudo lido pelo cliente ADMIN, e o motivo é estrutural ─────────────────
 * Esta área não tem sessão do Supabase: a identidade é o token assinado que o
 * APEX entrega. A RLS de `ai_campanhas` exige `ai.configure`, permissão de admin
 * técnico que o cliente não tem e não deve ter — lendo pela sessão, a tela viria
 * vazia. Quem autoriza é `abrirSessaoGestao`, na primeira linha, e é por isso que
 * ela vem ANTES de qualquer leitura. O `base_id` de toda consulta sai DELA.
 *
 * ── O ESTADO DE CADA AVISO É CALCULADO, NUNCA LIDO ────────────────────────
 * Não existe coluna de status: o agendamento é um predicado avaliado no instante
 * da pergunta (ver o cabeçalho da migration de campanhas). `estadoDaCampanha` é a
 * mesma conta que `alertas_para` faz em SQL, escrita uma vez em TypeScript para a
 * tela poder dizer "aparecendo agora" sem inventar um segundo mecanismo.
 *
 * ── E O QUE ESTA TELA NÃO MOSTRA, DE PROPÓSITO ────────────────────────────
 * Nenhum percentual, nenhuma taxa de leitura, nenhum "lidos × não lidos". Não há
 * cadastro de usuários em tabela nenhuma deste banco, então qualquer denominador
 * sairia de "quem já usou o chatbot" e mediria adoção do chatbot parecendo medir
 * alcance do aviso. A tela mostra quem visualizou, e diz em uma frase por que não
 * existe o outro lado.
 *
 * Quem guarda isso a cada PR é a sentinela de `src/lib/campanhas/campanha.test.ts`
 * (dentro de `npm test`, que a CI roda), olhando o fonte do painel. A assertiva D
 * da migration de campanhas guarda o lado do BANCO e só dispara quando ALGUÉM
 * aplica aquele arquivo: a CI não aplica migration. Esta página é o lado de cima
 * da mesma decisão.
 */
export default async function GestaoComunicacaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sessao = await abrirSessaoGestao(sp);
  if (!sessao.ok) return <RecusaGestao mensagem={sessao.mensagem} />;
  await registrarAcessoSuporte(sessao, "comunicacao");

  const { baseCode, baseId, baseNome } = sessao.identidade;

  const [leitura, vocab] = await Promise.all([
    campanhasDaBase(baseId),
    /*
      O MESMO diagnóstico de presença da aba Conteúdo ("esta empresa nunca enviou
      valor para filial"), pela MESMA função. Restringir um aviso por uma dimensão
      que o painel do cliente nunca envia produz um aviso que não alcança ninguém,
      e é o tipo de erro que não dá erro.
    */
    lerVocabulario(baseCode),
  ]);

  const campanhas: CampanhaNaTela[] = leitura.campanhas;
  const agora = new Date();
  const conta = (alvo: string) =>
    campanhas.filter((c) => estadoDaCampanha(c, agora) === alvo).length;
  const ativas = conta("ativa");
  const agendadas = conta("agendada");
  const paradas = conta("desligada");

  return (
    <ShellGestao
      sessao={sessao}
      atual="comunicacao"
      titulo="Comunicação"
      descricao="Avisos que aparecem no assistente para as pessoas que você escolher, na hora que você marcar."
    >
      {leitura.falhou ? (
        /* Defeito NOSSO não pode aparecer como "você não tem avisos": a pessoa
           criaria de novo o que já existe. A faixa diz o que é, e o painel
           oferece a única ação que resolve. */
        <FaixaResumo
          tom="ruim"
          frase={
            <>
              Não foi possível ler os seus avisos agora. O que aparece abaixo pode estar incompleto,
              e nenhum aviso deixou de funcionar por causa disto: quem já estava publicado continua
              aparecendo no assistente.
            </>
          }
        />
      ) : campanhas.length === 0 ? (
        <FaixaResumo
          frase={
            <>
              A <strong>{baseNome}</strong> ainda não tem nenhum aviso configurado. Um aviso aparece
              como primeira mensagem no assistente, para quem você escolher, e você vê quem
              visualizou.
            </>
          }
        />
      ) : (
        <FaixaResumo
          numero={String(ativas)}
          unidade={ativas === 1 ? "aviso aparecendo" : "avisos aparecendo"}
          tom={ativas === 0 ? "neutro" : "bom"}
          frase={
            ativas === 0 ? (
              <>
                Nenhum aviso está aparecendo no assistente agora.{" "}
                {agendadas > 0
                  ? agendadas === 1
                    ? "Há um agendado para começar."
                    : `Há ${agendadas} agendados para começar.`
                  : "Os que existem já encerraram ou estão parados."}
              </>
            ) : (
              <>
                {ativas === 1 ? "Um aviso aparece" : `${ativas} avisos aparecem`} para quem se
                encaixar no alcance que você definiu: no computador ele pode aparecer sozinho, e no
                celular quando a pessoa abrir o assistente.
              </>
            )
          }
          apoio={[
            { rotulo: "Aparecendo agora", valor: String(ativas) },
            { rotulo: "Agendados", valor: String(agendadas) },
            { rotulo: "Parados por você", valor: String(paradas) },
          ]}
        />
      )}

      <Bloco
        titulo="Avisos no assistente"
        descricao="Cada aviso aparece como primeira mensagem para quem estiver dentro do alcance que você definir. No computador o assistente pode abrir sozinho e levar o aviso até a pessoa; no celular ele aparece quando alguém abrir o chat. Você escolhe quando o aviso começa, quando para, e se reaparece a cada abertura."
      >
        <ComunicacaoPainel
          sessao={paramsDaSessao(sessao)}
          modo={sessao.modo}
          baseCode={baseCode}
          baseNome={baseNome}
          campanhas={campanhas}
          falhaDeLeitura={leitura.falhou}
          presencas={{ porDimensao: vocab.porDimensao, conversas: vocab.conversas }}
        />
      </Bloco>
    </ShellGestao>
  );
}
