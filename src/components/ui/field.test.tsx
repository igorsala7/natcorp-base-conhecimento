import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Field } from "./field";
import { Input } from "./input";

/**
 * O DEFEITO QUE ESTE TESTE TRAVA.
 *
 * O `Field` sempre soube montar o `aria` correto: exportava `fieldAria()`, com
 * documentação, para o call site espalhar no controle. Em 214 usos de `<Field>`
 * no produto, ela foi chamada ZERO vezes.
 *
 * Nada quebrava visualmente, então nada denunciava. Só que três coisas estavam
 * erradas ao mesmo tempo, todas invisíveis para quem enxerga e usa mouse:
 *
 *  1. o `hint` existia na tela e não na árvore de acessibilidade — leitor de
 *     tela anunciava o rótulo e nunca a explicação;
 *  2. o controle nunca recebia `aria-invalid`, então voltar ao campo pelo
 *     teclado não dizia que ele estava errado;
 *  3. o estilo `aria-[invalid=true]:border-danger` do `Input` nunca disparava,
 *     porque nada setava o atributo que ele observa — era código morto.
 *
 * A correção foi inverter a responsabilidade: o `Field` clona o filho e injeta.
 * Estes testes existem porque a próxima pessoa que mexer aqui não vai ver nada
 * quebrar se voltar a delegar ao call site — que é exatamente como o defeito
 * durou tanto tempo.
 */
describe("Field — aria injetado no controle", () => {
  it("liga o hint ao controle por aria-describedby", () => {
    const html = renderToString(
      <Field label="Nome" htmlFor="f-nome" hint="Aparece no portal público.">
        <Input id="f-nome" />
      </Field>,
    );
    expect(html).toContain('id="f-nome-hint"');
    expect(html).toContain('aria-describedby="f-nome-hint"');
  });

  it("marca o controle como inválido e aponta para a mensagem de erro", () => {
    const html = renderToString(
      <Field label="Slug" htmlFor="f-slug" error="Já existe uma documentação com este endereço.">
        <Input id="f-slug" />
      </Field>,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="f-slug-erro"');
    // `role="alert"` anuncia o erro UMA vez, quando aparece. O `describedby` é
    // o que o devolve a quem voltar ao campo depois — os dois são necessários.
    expect(html).toContain('role="alert"');
  });

  it("com erro, descreve o erro e NÃO o hint (senão o campo anuncia duas coisas)", () => {
    const html = renderToString(
      <Field label="Slug" htmlFor="f-s" hint="Só letras e hífens." error="Endereço em uso.">
        <Input id="f-s" />
      </Field>,
    );
    expect(html).toContain('aria-describedby="f-s-erro"');
    expect(html).not.toContain("f-s-hint");
  });

  it("não inventa aria quando não há hint nem erro", () => {
    const html = renderToString(
      <Field label="Nome" htmlFor="f-n">
        <Input id="f-n" />
      </Field>,
    );
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("aria-invalid");
  });

  it("o que o call site escreveu VENCE a injeção", () => {
    // O objetivo é remover a obrigação de lembrar, não tirar o controle de
    // quem tem um caso especial (ex.: um campo descrito por um texto que vive
    // fora do Field).
    const html = renderToString(
      <Field label="Nome" htmlFor="f-x" hint="Ignorado.">
        <Input id="f-x" aria-describedby="outro-texto" />
      </Field>,
    );
    expect(html).toContain('aria-describedby="outro-texto"');
  });

  it("sem htmlFor não há id de destino, então não injeta", () => {
    // Nesse modo o próprio <label> envolve o controle (associação implícita) e
    // o hint não tem id — apontar para um id inexistente seria pior que nada.
    const html = renderToString(
      <Field label="Nome" hint="Sem id estável.">
        <Input />
      </Field>,
    );
    expect(html).not.toContain("aria-describedby");
  });
});
