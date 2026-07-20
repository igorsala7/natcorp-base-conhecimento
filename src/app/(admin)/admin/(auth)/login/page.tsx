"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Surface } from "@/components/ui/surface";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    signIn,
    undefined,
  );

  return (
    <Surface elevation={1} padding="lg">
      <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
      <p className="mt-1 text-sm text-text-muted">Acesse o painel administrativo.</p>

      <form action={formAction} className="mt-6 space-y-4">
        <Field label="E-mail" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="voce@natcorp.com.br"
          />
        </Field>

        {/* O erro fica no último campo: é onde o foco está quando falha. */}
        <Field label="Senha" htmlFor="password" required error={state?.error ?? null}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <SubmitButton />
      </form>
    </Surface>
  );
}
