"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setPassword, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Salvando…" : "Definir senha e continuar"}
    </Button>
  );
}

/**
 * Primeiro acesso: o usuário chega aqui pelo link do convite (rota
 * /auth/confirm já estabeleceu a sessão). Define a senha e segue para o TOTP.
 */
export default function DefinirSenhaPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    setPassword,
    undefined,
  );

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">Definir senha</h1>
      <p className="mt-1 text-sm text-text-muted">
        Escolha uma senha para o seu primeiro acesso.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Nova senha
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          <p className="text-xs text-text-muted">
            Mínimo 10 caracteres, com maiúscula, minúscula e número.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm" className="text-sm font-medium">
            Confirmar senha
          </label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>

        {state?.error && (
          <p
            role="alert"
            className="rounded-md bg-brand-pink-50 px-3 py-2 text-sm text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300"
          >
            {state.error}
          </p>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}
