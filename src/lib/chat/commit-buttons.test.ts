import { describe, it, expect } from "vitest";

/**
 * Réplica de `RX_COMMIT`/`RX_DESTRUTIVA` de `public/widget.js` — o widget é um IIFE de
 * navegador sem build. Mesma disciplina de `popup-lov-match.test.ts`: **ao mudar lá,
 * mude aqui**.
 *
 * O que está em jogo: um FALSO NEGATIVO grava ou apaga dado sem o usuário conferir.
 * Um falso positivo só mostra uma modal a mais. Por isso a lista pende para incluir —
 * mas "Novo" e "Aplicar" sozinhos ficam de fora: navegam ou filtram, e o resumo
 * mostraria a tela ANTIGA.
 */
const RX_COMMIT = new RegExp("\\b(" +
  "criar|cria|create|cadastrar|cadastra|incluir|inclui|adicionar|adiciona|inserir|insere|" +
  "salvar|salva|save|gravar|grava|guardar|" +
  "apply\\s*changes|aplicar\\s*(altera|mudan)|submeter|submete|submit|enviar|envia|" +
  "excluir|exclui|apagar|apaga|deletar|deleta|delete|remover|remove|" +
  "finalizar|finaliza|efetivar|efetiva|confirmar|confirma|processar|processa" +
")\\b", "i");
const RX_DESTRUTIVA = /\b(excluir|exclui|apagar|apaga|deletar|deleta|delete|remover|remove)\b/i;

describe("RX_COMMIT — botões que exigem confirmação com resumo", () => {
  const gravam = [
    "Criar", "Create", "Salvar", "Save", "Gravar", "Apply Changes", "Aplicar Alterações",
    "Cadastrar", "Submeter", "Confirmar", "Finalizar", "Salvar Alterações", "Criar e Continuar",
    "Excluir", "Deletar", "Delete", "Apagar", "Remover",
  ];
  for (const l of gravam) {
    it(`pede confirmação: "${l}"`, () => expect(RX_COMMIT.test(l), l).toBe(true));
  }

  const navegam = [
    "Cancelar", "Voltar", "Fechar", "Pesquisar", "Buscar", "Filtrar", "Editar",
    "Ver detalhes", "Exportar", "Imprimir", "Ações", "Próximo", "Anterior", "Limpar",
    // Estes dois são a razão de a lista não ser mais larga:
    "Novo", "Nova", "Aplicar",
  ];
  for (const l of navegam) {
    it(`NÃO interrompe: "${l}"`, () => expect(RX_COMMIT.test(l), l).toBe(false));
  }
});

describe("RX_DESTRUTIVA — muda o tom da modal", () => {
  it("exclusão é tratada como irreversível", () => {
    for (const l of ["Excluir", "Apagar", "Deletar", "Delete", "Remover"]) {
      expect(RX_DESTRUTIVA.test(l), l).toBe(true);
    }
  });

  it("gravação comum não usa o tom de exclusão", () => {
    for (const l of ["Criar", "Salvar", "Apply Changes"]) {
      expect(RX_DESTRUTIVA.test(l), l).toBe(false);
    }
  });
});
