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
  const user = userinfo.slice(0, ci);
  const password = userinfo.slice(ci + 1);

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
