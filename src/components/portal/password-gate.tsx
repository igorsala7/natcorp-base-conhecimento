"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-1"
      >
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40">
          <Lock className="size-5" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">{spaceName}</h1>
        <p className="mt-1 text-sm text-text-muted">
          Esta documentação é protegida. Informe a senha para acessar.
        </p>
        <div className="mt-4">
          <Field label="Senha" htmlFor="senha-espaco" error={error}>
            <Input
              id="senha-espaco"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
            />
          </Field>
        </div>
        <Button type="submit" className="mt-4 w-full" disabled={pending || !password}>
          {pending ? "Verificando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
