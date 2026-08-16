/**
 * O QUE ESTE PAPEL VAI PODER FAZER, EM PORTUGUÊS.
 *
 * O diálogo de convite pedia e-mail e papel, e a única descrição era "A pessoa
 * recebe um e-mail para definir a senha e entrar." Quem convidava escolhia
 * "Editor" num select e não tinha como saber que isso concede criar, editar E
 * excluir artigos — nem que NÃO concede publicar.
 *
 * O guia de papéis existe (`roles-guide.tsx`), mas fica no rodapé da página de
 * usuários: longe do momento da decisão, que é dentro do diálogo. Informação que
 * exige sair da tela para ser consultada não é consultada.
 *
 * Duas escolhas de forma:
 *
 *  · VERBOS, não chaves. "Publicar e tirar do ar" diz o que acontece;
 *    `content.publish` só diz o nome interno. A chave continua aparecendo na
 *    tela de recusa, onde ela é o que a pessoa cita ao pedir acesso.
 *  · O que o papel NÃO faz aparece junto quando é surpreendente. A ausência de
 *    publicação no Editor é a fonte de erro mais provável do modelo — quem
 *    contrata "editor" espera que ele publique.
 *
 * Puro e sem IO: derivado do `level`, que é a mesma coluna que a RLS usa.
 */

export type ResumoDoPapel = {
  /** O que a pessoa passa a poder fazer, em ordem de impacto. */
  pode: string[];
  /** O que ela NÃO pode, quando isso costuma surpreender. */
  naoPode?: string[];
  /** Aviso quando o papel alcança configuração ou dinheiro. */
  atencao?: string;
};

export function oQueOPapelFaz(level: number): ResumoDoPapel {
  if (level >= 100)
    return {
      pode: [
        "tudo o que o Admin técnico faz",
        "gerenciar faturamento e transferir a propriedade",
        "remover outros administradores",
        "gravar segredos de provedores de IA",
      ],
      atencao: "Controle total da instalação. Só conceda a quem responde por ela.",
    };

  if (level >= 80)
    return {
      pode: [
        "tudo o que o Gestor de conteúdo faz",
        "criar e excluir documentações, domínios e temas",
        "gerenciar chaves de widget e de API",
        "configurar integrações e provedores de IA",
        "gerenciar usuários e ler a auditoria",
      ],
      naoPode: ["mexer em faturamento"],
      atencao: "Alcança a configuração do sistema inteiro, não só o conteúdo.",
    };

  if (level >= 60)
    return {
      pode: [
        "criar, editar e excluir artigos",
        "publicar e tirar do ar",
        "reorganizar a árvore, mover e copiar",
        "importar documentos e restaurar da lixeira",
        "aprovar ou rejeitar revisões",
        "convidar Editores e Leitores",
      ],
      naoPode: ["acessar configuração técnica, chaves ou integrações"],
    };

  if (level >= 40)
    return {
      pode: ["criar, editar e excluir artigos", "comentar em revisões"],
      // A surpresa mais cara do modelo: quem contrata "editor" espera publicação.
      naoPode: ["publicar — o que ela escreve vai para revisão"],
    };

  if (level >= 20)
    return {
      pode: ["ler rascunhos", "comentar", "aprovar ou rejeitar publicações"],
      naoPode: ["editar o conteúdo"],
    };

  return {
    pode: ["ler o conteúdo, inclusive o que é privado da documentação"],
    naoPode: ["criar, editar ou publicar"],
  };
}
