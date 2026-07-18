/**
 * Parseia a SUPABASE_DB_URL em um objeto de conexão do `pg`. Fazer o parse
 * manual evita o problema de senha com caracteres especiais na URL (que
 * quebrava o `supabase db push`) — o host do Supabase começa em "@db.".
 */
export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: { rejectUnauthorized: boolean };
};

export function parseDbConfig(url = process.env.SUPABASE_DB_URL): DbConfig {
  if (!url) throw new Error("SUPABASE_DB_URL não definido.");
  const scheme = "postgresql://";
  const withoutScheme = url.startsWith(scheme)
    ? url.slice(scheme.length)
    : url.replace(/^postgres:\/\//, "");

  const marker = "@db.";
  const idx = withoutScheme.indexOf(marker);
  if (idx === -1) throw new Error("Host esperado (@db.<ref>.supabase.co) não encontrado.");

  const userinfo = withoutScheme.slice(0, idx); // user:password
  const rest = withoutScheme.slice(idx + 1); // db....:5432/postgres
  const ci = userinfo.indexOf(":");
  const user = userinfo.slice(0, ci);
  const password = userinfo.slice(ci + 1);

  const slash = rest.indexOf("/");
  const hostPort = rest.slice(0, slash);
  const database = rest.slice(slash + 1) || "postgres";
  const parts = hostPort.split(":");
  const host = parts[0] ?? "";
  const portStr = parts[1];

  return {
    host,
    port: portStr ? Number(portStr) : 5432,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
  };
}
