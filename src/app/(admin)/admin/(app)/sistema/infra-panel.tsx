"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveInfra } from "./infra-actions";

export type InfraData = {
  redis_rest_url: string | null;
  redis_token_present: boolean;
  max_concurrency_per_base: number | null;
  daily_token_cap_per_base: number | null;
  lease_ttl_seconds: number | null;
  cb_failures: number | null;
  cb_window_ms: number | null;
  cb_cooldown_ms: number | null;
};

const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.floor(n) : null;
};

function Campo({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-text-muted">{hint}</span>}
    </label>
  );
}

export function InfraPanel({ infra, temChaveMestra }: { infra: InfraData; temChaveMestra: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const [url, setUrl] = useState(infra.redis_rest_url ?? "");
  const [token, setToken] = useState("");
  const [limparToken, setLimparToken] = useState(false);
  const [conc, setConc] = useState(infra.max_concurrency_per_base?.toString() ?? "");
  const [cap, setCap] = useState(infra.daily_token_cap_per_base?.toString() ?? "");
  const [ttl, setTtl] = useState(infra.lease_ttl_seconds?.toString() ?? "");
  const [cbF, setCbF] = useState(infra.cb_failures?.toString() ?? "");
  const [cbW, setCbW] = useState(infra.cb_window_ms?.toString() ?? "");
  const [cbC, setCbC] = useState(infra.cb_cooldown_ms?.toString() ?? "");

  const redisAtivo = !!(infra.redis_rest_url && infra.redis_token_present);

  function salvar() {
    start(async () => {
      const r = await saveInfra({
        redis_rest_url: url.trim() || null,
        redis_token: limparToken ? "__clear__" : token,
        max_concurrency_per_base: numOrNull(conc),
        daily_token_cap_per_base: numOrNull(cap),
        lease_ttl_seconds: numOrNull(ttl),
        cb_failures: numOrNull(cbF),
        cb_window_ms: numOrNull(cbW),
        cb_cooldown_ms: numOrNull(cbC),
      });
      if (!r.ok) return toast.error(r.error);
      toast.success("Configuração de infra salva.");
      setToken("");
      setLimparToken(false);
      router.refresh();
    });
  }

  return (
    <section className="mt-8 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-text">Infra / Escala</h2>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${redisAtivo ? "bg-primary/10 text-primary" : "bg-surface-2 text-text-muted"}`}>
          cache: {redisAtivo ? "Redis" : "memória"}
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
        Config de cache distribuído e limites de escala — vale como <b>default de todas as bases</b> (o ajuste por base fica em
        Chaves de API → Limites por base). Em branco = usa o padrão do código. Substitui o que antes era fixo no <code>.env</code>.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo label="Redis REST URL (Upstash)" hint="Vazio = cache em memória por instância.">
          <input className={controlClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://SEU-BANCO.upstash.io" />
        </Campo>
        <Campo
          label="Redis REST TOKEN"
          hint={
            !temChaveMestra
              ? "Defina APP_ENCRYPTION_KEY para guardar o token cifrado."
              : infra.redis_token_present
                ? "Token configurado. Preencha só para trocar."
                : "Cole o REST TOKEN do Upstash."
          }
        >
          <input
            className={controlClass}
            type="password"
            value={token}
            disabled={limparToken || !temChaveMestra}
            onChange={(e) => setToken(e.target.value)}
            placeholder={infra.redis_token_present ? "•••••••• (configurado)" : ""}
          />
        </Campo>
      </div>
      {infra.redis_token_present && (
        <label className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-muted">
          <input type="checkbox" checked={limparToken} onChange={(e) => setLimparToken(e.target.checked)} className="size-3.5 accent-[var(--color-primary)]" />
          Remover o token (voltar ao cache em memória)
        </label>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Campo label="Concorrência de IA por base" hint="Default (padrão 20).">
          <input className={controlClass} type="number" min={1} value={conc} onChange={(e) => setConc(e.target.value)} placeholder="20" />
        </Campo>
        <Campo label="Cota diária de tokens por base" hint="Vazio = sem cota.">
          <input className={controlClass} type="number" min={0} value={cap} onChange={(e) => setCap(e.target.value)} placeholder="sem cota" />
        </Campo>
        <Campo label="TTL do slot (segundos)" hint="Padrão 120.">
          <input className={controlClass} type="number" min={1} value={ttl} onChange={(e) => setTtl(e.target.value)} placeholder="120" />
        </Campo>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Campo label="Disjuntor: falhas p/ abrir" hint="Padrão 5.">
          <input className={controlClass} type="number" min={1} value={cbF} onChange={(e) => setCbF(e.target.value)} placeholder="5" />
        </Campo>
        <Campo label="Disjuntor: janela (ms)" hint="Padrão 30000.">
          <input className={controlClass} type="number" min={1000} value={cbW} onChange={(e) => setCbW(e.target.value)} placeholder="30000" />
        </Campo>
        <Campo label="Disjuntor: cooldown (ms)" hint="Padrão 20000.">
          <input className={controlClass} type="number" min={1000} value={cbC} onChange={(e) => setCbC(e.target.value)} placeholder="20000" />
        </Campo>
      </div>

      <div className="mt-5">
        <Button size="sm" onClick={salvar} disabled={pending}>
          Salvar infra
        </Button>
      </div>
    </section>
  );
}
