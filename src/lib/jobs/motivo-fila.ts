import "server-only";

/**
 * Por que a fila não aceitou o job.
 *
 * A mensagem antiga era um CHUTE — "o worker precisa estar rodando" — e mandava
 * ligar algo que costuma já estar no ar. O enfileiramento não fala com o worker:
 * ele escreve no Postgres. Se falha, o problema é conexão, não processo.
 *
 * Custou horas de procura no lugar errado (14/08/2026, geração de ontologia com
 * o Docker no ar). O `catch` engolia o erro real e devolvia o palpite.
 */
export function motivoFila(e: unknown): string {
  const m = String((e as { message?: unknown })?.message ?? e ?? "");
  if (/SUPABASE_DB_URL|DATABASE_URL|conex[aã]o.*n[aã]o configurada|connection string/i.test(m)) {
    return "A aplicação não tem a URL do banco (SUPABASE_DB_URL). Confira as variáveis de ambiente do contêiner.";
  }
  // A causa real de 14/08/2026: senha com `#` e `@` numa URL não codificada. O
  // `#` inicia o fragmento da URI, então o endereço termina ali e o parser
  // recusa a string inteira — antes de qualquer tentativa de conexão.
  if (/Invalid URL|ERR_INVALID_URL|invalid connection string/i.test(m)) {
    return (
      "A URL do banco (SUPABASE_DB_URL) é inválida. Se a senha tiver @ # ! ou /, " +
      "codifique-os: @ = %40, # = %23, ! = %21. O # não codificado corta o endereço no meio."
    );
  }
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|timeout|ETIMEDOUT/i.test(m)) {
    return "A aplicação não conseguiu alcançar o banco. Verifique rede e a URL do contêiner.";
  }
  if (/password|authentication|SASL|role .* does not exist/i.test(m)) {
    return "O banco recusou a credencial da fila. Confira usuário e senha em SUPABASE_DB_URL.";
  }
  if (/permission denied|must be owner|schema "pgboss"/i.test(m)) {
    return "Sem permissão no schema `pgboss`. O usuário do banco precisa poder criá-lo/escrever nele.";
  }
  return `Falha ao enfileirar: ${m.slice(0, 200)}`;
}
