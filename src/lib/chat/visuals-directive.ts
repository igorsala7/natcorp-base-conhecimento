/**
 * Instruções de GRÁFICO e ARQUIVO para o modelo.
 *
 * Substitui o `visualsDirective` monolítico (~63 linhas / ~1.400 tokens de prosa em
 * CAIXA ALTA, sem um único exemplo de chamada). Duas mudanças de fundo:
 *
 *  1. Divide em `visualsCore()` — sempre injetado, só o que NÃO se deduz do schema —
 *     e `visualsExtras()`, que entra quando há intenção visual declarada. Como as
 *     ferramentas passaram a ficar sempre ligadas, o texto curto é o que paga a conta.
 *  2. Troca parágrafos por EXEMPLOS de chamada. Quando tudo está em maiúscula, nada é
 *     ênfase; e o erro mais comum (aninhar `tabela`/`grafico` no lugar errado) se
 *     corrige mostrando a forma certa, não descrevendo-a.
 *
 * Puro: sem server-only, sem SDK — testável direto.
 */

/**
 * O essencial. Vai junto das ferramentas, em todo turno que as tenha.
 * `comGrafico: false` onde o cliente não desenha gráfico (chat do admin) — citar uma
 * ferramenta que não existe é o mesmo tipo de buraco que este arquivo veio fechar.
 */
export function visualsCore(opts: { comGrafico?: boolean } = {}): string {
  const comGrafico = opts.comGrafico !== false;
  return (
    (comGrafico ? "GRÁFICOS E ARQUIVOS (ferramentas `montar_grafico` e `gerar_relatorio`):\n" : "ARQUIVOS (ferramenta `gerar_relatorio`):\n") +
    (comGrafico
      ? "- Gráfico → `montar_grafico`. Nunca mande o usuário usar o menu \"Ações\" › \"Gráfico\" da tela. " +
        "Se ele disse o tipo, passe `tipo`; se não disse, OMITA `tipo` (o sistema mostra os tipos como botões). " +
        "Não descreva o gráfico em texto — a ferramenta o desenha.\n"
      : "") +
    "- Arquivo (PDF/Excel/CSV/Word/PowerPoint) → `gerar_relatorio` com o `formato` pedido. Vários formatos de " +
    "uma vez? Use `formatos: [...]` numa ÚNICA chamada. O arquivo vira um LINK DE DOWNLOAD no chat.\n" +
    "- Com muitos registros, NÃO redigite os pontos nem as linhas: passe `dados_de` com o id do dataset — o " +
    "servidor usa 100% das linhas. Redigite só quando são poucos e você já os tem no contexto.\n" +
    "- QUAL dataset (regra CRÍTICA): se o usuário quer um RECORTE que você filtrou (\"desses\", \"dos 10 que você " +
    "achou\"), use o `resultado_em` do `consultar_registros` obtido NESTE MESMO turno — NUNCA a tabela inteira da " +
    "tela (\"telaN\"), senão vêm 100% dos registros e a resposta fica errada. Se o filtro foi num turno anterior, " +
    "REFAÇA o `consultar_registros` agora.\n" +
    "- Só existe arquivo se você CHAMAR a ferramenta nesta mesma resposta. Nunca diga que gerou, anexou ou que o " +
    "download vai começar sem ter chamado. Se a ferramenta devolver `erro`, ela diz o que corrigir: corrija e " +
    "chame de novo, ou conte ao usuário o que faltou — jamais finja sucesso.\n" +
    "Exemplos de chamada:\n" +
    (comGrafico
      ? '  gráfico de um dataset: {"tipo":"colunas","titulo":"Salário médio por cargo","dados_de":"tela1","categoria":"Cargo","valor":"Salário","agregacao":"media"}\n' +
        '  gráfico pequeno: {"tipo":"pizza","titulo":"Situação","categorias":["Ativo","Férias"],"series":[{"nome":"Colaboradores","valores":[128,14]}]}\n'
      : "") +
    '  Excel com tabela + gráfico: {"titulo":"Colaboradores","formato":"xlsx","blocos":[{"tipo":"texto","texto":"## Resumo\\n420 ativos."},{"tipo":"tabela","tabela":{"dados_de":"tela1"}},{"tipo":"grafico","grafico":{"tipo":"colunas","titulo":"Por cargo","dados_de":"tela1","categoria":"Cargo","agregacao":"contar"}}]}'
  );
}

/** Detalhes que só valem quando o usuário JÁ demonstrou querer gráfico/arquivo. */
export function visualsExtras(): string {
  return (
    "DETALHES DE GRÁFICO/ARQUIVO:\n" +
    "- Escolha do tipo: série ao longo do tempo → linha (ou área); poucas categorias → colunas; muitas categorias " +
    "ou rótulos longos → barras; partes de um todo em % → pizza/rosca.\n" +
    "- `mediana` quando ajudar a comparar valores e `tendencia` quando houver progressão/série temporal — só em " +
    "colunas/barras/linha/área, nunca em pizza/rosca, e só quando agregam algo.\n" +
    "- Escolha do formato: lista de dados → xlsx (ou csv); texto/passo a passo → pdf ou docx; apresentação → pptx. " +
    "Se o usuário não disse e não está claro, PERGUNTE.\n" +
    "- O FORMATO decide a densidade. pptx = APRESENTAR: uma ideia por slide, 2 a 4 números, o detalhe vai em `nota` " +
    "(notas do apresentador). pdf/docx = LER: capa, seções, análise e a tabela inteira. xlsx/csv = TRABALHAR: dado " +
    "puro, sem enfeite. A mesma pergunta em pptx e em xlsx não produz o mesmo arquivo.\n" +
    "- Monte como MATERIAL, não como despejo: `secao` abre o assunto, `destaques` traz os números que importam, " +
    "`cards` explica os porquês, `texto` faz a leitura, `tabela`/`grafico` mostram a evidência.\n" +
    "- `nota` em todo bloco de dado, com o que aquilo MOSTRA — não o que ele repete. \"A Matriz concentra um terço do " +
    "quadro, o que puxa qualquer média para cima\" é nota; \"a tabela traz as filiais\" não é.\n" +
    "- Nos blocos `texto` você pode usar markdown (`##`, **negrito**, listas) — o gerador converte de verdade. Dê a " +
    "eles um `titulo` próprio: sem isso, no PPT todos os slides de texto repetem o título do relatório.\n" +
    "- Pediram arquivo COM gráfico? O bloco `grafico` é obrigatório na chamada.\n" +
    "- Página SEM tabela/dataset: monte o arquivo com o CONTEÚDO DA TELA que você recebeu (campos e valores), " +
    "digitando `colunas`/`linhas` — aqui não existe `dados_de`. Não se recuse por \"não ter tabela\".\n" +
    "- O conteúdo pode vir das ferramentas OU da DOCUMENTAÇÃO (um passo a passo montado dos artigos). Documentação " +
    "parcial não é motivo para recusar: compile o que existe e diga o que ficou de fora.\n" +
    "- REGRA ABSOLUTA: gerar Excel/CSV/PDF/Word/PowerPoint É a sua ferramenta. É proibido dizer que está \"fora da " +
    "sua capacidade\" ou mandar o usuário exportar pelo menu do sistema. Se você ofereceu um arquivo e ele aceitou " +
    "(mesmo com um \"sim\" curto), chame `gerar_relatorio` AGORA."
  );
}

/**
 * Como usar os ids de dataset. Ficava preso ao bloco de visualização — ou seja,
 * sumia justamente no turno de dados puro, que é onde o modelo mais precisa dele.
 */
export function datasetsDirective(): string {
  return (
    "IDS DE DADOS: quando uma ferramenta retorna uma LISTA, ela vem com `_dataset` (+ `_total`, `_colunas`). Use " +
    "esse id em `dados_de`/`resultado_em` nas ferramentas de consulta, gráfico e relatório — o servidor enxerga " +
    "100% das linhas, enquanto a amostra no texto é parcial. Nunca conte nem some pela amostra. Os ids valem " +
    "NESTE turno: se precisar de um que veio antes, chame a ferramenta de dados de novo agora. Se um id não for " +
    "aceito, a ferramenta lista os válidos — escolha um deles, nunca invente. Ignore `_dataset`/`_total`/" +
    "`_colunas` ao escrever a resposta (são metadados internos)."
  );
}
