"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { verifySpacePassword } from "@/app/(portal)/actions";

export function PasswordGate({
  spaceSlug,
  spaceName,
}: {
  spaceSlug: string;
  spaceName: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await verifySpacePassword(spaceSlug, password);
      if (r.ok) router.refresh();
      else setError(r.error ?? "Não foi possível validar.");
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-text">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40">
          <Lock className="size-5" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">{spaceName}</h1>
        <p className="mt-1 text-sm text-text-muted">
          Esta documentação é protegida. Informe a senha para acessar.
        </p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          className="mt-4 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        {error && <p className="mt-2 text-sm text-brand-pink-700">{error}</p>}
        <button
          type="submit"
          disabled={pending || !password}
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
        >
          {pending ? "Verificando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
