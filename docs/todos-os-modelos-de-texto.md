# Os 23 modelos de texto, medidos — 20/08/2026

Todos os modelos de geração de texto dos três provedores, nos catálogos
conferidos em 19/08. Fora: `claude-mythos-5` (acesso limitado) e
`gemini-2.5-pro` (encerrado para contas novas). Embeddings e `whisper-1` não
geram texto e não entram.

Dois eixos independentes, e **um modelo pode ser bom num e reprovado no outro**:

- **Ferramentas** — 37 turnos reais anotados: escolheu a ferramenta certa, e
  soube quando perguntar (`eval/cenarios.jsonl`).
- **Verificável** — 10 casos de resposta conferível sem juiz: contas cujo
  resultado o script conhece, e citações que existem (`eval/qualidade-texto.md`).

## O critério eliminatório

Dois dos dez casos não medem habilidade, medem honestidade: pedir uma coluna que
o relatório **não tem**, e uma alíquota que o contexto **não traz**. Fabricar ali
não é imprecisão — é inventar número para folha de pagamento.

**11 dos 23 responderam de memória com o contexto explicitamente não cobrindo:**

`claude-opus-4-7` · `claude-sonnet-4-5` · `gpt-5.6-sol` · `gpt-5.6-terra` ·
`gpt-5.5` · `gpt-4o` · `gpt-4o-mini` · `gpt-3.5-turbo` · `gemini-3.5-flash-lite` ·
`gemini-3.1-flash-lite` · `gemini-2.5-flash`

E **4 inventaram um total para uma coluna inexistente:** `claude-opus-4-6` ·
`gpt-5.6-sol` · `gpt-4o` · `gpt-3.5-turbo`.

## Os cinco que passam em tudo

| modelo | ferramenta | pergunta | perguntou demais | verificável | s/caso |
|---|---|---|---|---|---|
| `claude-fable-5` | **24/37** | 28/37 | **0** | **10/10** | 12,5 |
| `gemini-3.6-flash` | 21/37 | **29/37** | **0** | **10/10** | 5,0 |
| `claude-sonnet-5` | 21/37 | 28/37 | **0** | **10/10** | 5,5 |
| `gpt-5.6-luna` | 21/37 | 26/37 | 2 | **10/10** | **2,1** |
| `claude-sonnet-4-6` | 16/37 | **29/37** | 1 | **10/10** | 4,9 |

## O que o preço não previu

**Aritmética não acompanha o topo.** A soma de 40 valores derrubou 13 dos 23 —
incluindo **toda a linha Opus**. O `claude-opus-5` fica em 4/6 na análise de
relatório; o `gpt-5.6-luna`, 25× mais barato, faz 6/6.

> Isso pesa menos do que parece em produção: `agregar_valores` calcula o
> agregado exato sobre 100% dos registros no SERVIDOR. A conta à mão só aparece
> quando o modelo não chama a ferramenta — o que o eixo de ferramentas mede.

**Modelo maior não escolhe ferramenta melhor.** `claude-sonnet-4-6` faz 16/37, o
pior da linha Anthropic atual, enquanto o `haiku-4-5` faz 23/37 por um quinto do
preço. E o `gpt-4o-mini` lidera o eixo com **27/37** — verificado que não é tiro
de espingarda (0,88 ferramenta por turno, no meio do pelotão) — mas está
eliminado por fabricar sem contexto.

**Os antigos estão fora de cogitação.** `gpt-4o` 5/10 e `gpt-3.5-turbo` 4/10,
ambos 2/6 na análise de relatório e ambos fabricando nos dois casos.

**Um caso isolado de excesso:** o `gpt-5.2` perguntou demais em **10 dos 37**
turnos — cinco vezes mais que qualquer outro. Interrompe o usuário a ponto de
inviabilizar o uso.

## Recomendação por finalidade, só qualidade

| finalidade | melhor medido | em uso | trocar? |
|---|---|---|---|
| `chat_ferramentas` | `claude-fable-5` (24/37) | `claude-haiku-4-5` (23/37) | **não** — 1 caso |
| `chat` | 12 modelos em 4/4 | `gemini-3.6-flash` | **não** — já no topo |
| `report_analysis` | 7 modelos em 6/6 | `gemini-3.5-flash` (5/6) | **sim** → `gemini-3.6-flash` |
| `query_rewrite` | empate triplo em 88% | `gemini-3.5-flash-lite` | **não** — zero discordâncias |

Uma troca. O resto da configuração já está no topo do que foi medido.

## Limites destes números

37 e 10 casos não resolvem diferenças de 1 a 3 casos — `fable-5` sobre `haiku`
(24×23) é empate técnico. O que É categórico, porque é comportamento e não
margem: os 11 que fabricam sem contexto, o `gpt-5.2` interrompendo em 27% dos
turnos, e a queda dos modelos 4o/3.5.

Nada aqui mede fluência, tom ou formatação — mede acerto conferível.
