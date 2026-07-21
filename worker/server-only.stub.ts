/**
 * Stub de `server-only` para o worker.
 *
 * O pacote real lança ao ser importado fora do bundler do Next. Ele existe para
 * impedir que um módulo de servidor vá parar no bundle do CLIENTE — e o worker
 * é um processo de servidor puro, rodando sob `tsx`, onde essa checagem não se
 * aplica e só atrapalha.
 *
 * A garantia do lado do Next fica INTACTA: só o worker usa este mapeamento,
 * via `worker/tsconfig.json`.
 */
export {};
