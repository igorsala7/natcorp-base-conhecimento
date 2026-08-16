/**
 * Parseia a SUPABASE_DB_URL em um objeto de conexão do `pg`.
 *
 * O parse é manual de propósito: a senha deste projeto tem `@` e `#`, e é isso
 * que quebrava o `supabase db push` e o parser de URL embutido. Separar no
 * ÚLTIMO `@` resolve — a senha pode conter `@`, o host não.
 *
 * A versão anterior procurava a string literal `"@db."` e lançava se não
 * achasse. Isso quebra com o connection pooler do Supabase
 * (`@aws-0-….pooler.supabase.com`) e com qualquer Postgres local — os dois
 * cenários mais prováveis de produção e de desenvolvimento offline.
 */
export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: { rejectUnauthorized: boolean };
};

/**
 * Desfaz o percent-encoding do usuário e da senha.
 *
 * Este parse é manual, e por isso precisava fazer à mão o que o parser de URI
 * faz de graça. Sem isto, uma senha escrita como `Davout123%21%40%23` — que é
 * a grafia CORRETA de `Davout123!@#` numa URI — chegava ao Postgres com os
 * sinais de porcentagem literais, e o banco recusava a credencial.
 *
 * O defeito era especialmente escorregadio porque só aparecia AQUI: quem
 * testasse a mesma URL com `new pg.Client({ connectionString })` veria funcionar,
 * porque o `pg` decodifica. Mesmo endereço, mesma senha, resultados opostos
 * conforme o caminho — e a mensagem ("o banco recusou a credencial") apontava
 * para a senha estar errada, que era o único lugar onde ela não estava.
 *
 * `try/catch` porque `decodeURIComponent` LANÇA em sequência malformada (`%zz`,
 * ou um `%` solto numa senha que não foi codificada). Nesses casos o valor cru
 * é o certo — era exatamente assim que este projeto vinha operando.
 */
function decodificar(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Host local não tem TLS; exigir SSL aí só produz erro de conexão. */
function ehLocal(host: string): boolean {
  return (
    host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]"
  );
}

export function parseDbConfig(url = process.env.SUPABASE_DB_URL): DbConfig {
  if (!url) throw new Error("SUPABASE_DB_URL não definido.");

  const semScheme = url.replace(/^postgres(ql)?:\/\//, "");

  // Último `@`: tudo antes é user:senha (a senha pode ter `@`), depois é o host.
  const at = semScheme.lastIndexOf("@");
  if (at === -1) {
    throw new Error("SUPABASE_DB_URL sem credenciais (esperado user:senha@host).");
  }

  const userinfo = semScheme.slice(0, at);
  const resto = semScheme.slice(at + 1);

  const ci = userinfo.indexOf(":");
  if (ci === -1) throw new Error("SUPABASE_DB_URL sem senha (esperado user:senha@host).");
  const user = decodificar(userinfo.slice(0, ci));
  const password = decodificar(userinfo.slice(ci + 1));

  // Corta querystring (?sslmode=…) antes de separar host e banco.
  const semQuery = semQueryDe(resto);
  const barra = semQuery.indexOf("/");
  const hostPort = barra === -1 ? semQuery : semQuery.slice(0, barra);
  const database = (barra === -1 ? "" : semQuery.slice(barra + 1)) || "postgres";

  // IPv6 vem entre colchetes e tem `:` dentro do host — separar pelo último,
  // e só se ele vier depois do `]`.
  const doisPontos = hostPort.lastIndexOf(":");
  const temPorta = doisPontos > hostPort.lastIndexOf("]");
  const host = temPorta ? hostPort.slice(0, doisPontos) : hostPort;
  const portStr = temPorta ? hostPort.slice(doisPontos + 1) : "";

  if (!host) throw new Error("SUPABASE_DB_URL sem host.");

  return {
    host,
    port: portStr ? Number(portStr) : 5432,
    user,
    password,
    database,
    ...(ehLocal(host) ? {} : { ssl: { rejectUnauthorized: false } }),
  };
}

function semQueryDe(s: string): string {
  const q = s.indexOf("?");
  return q === -1 ? s : s.slice(0, q);
}
