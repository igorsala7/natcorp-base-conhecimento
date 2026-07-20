"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setPassword, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Surface } from "@/components/ui/surface";

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
    <Surface elevation={1} padding="lg">
      <h1 className="text-xl font-semibold tracking-tight">Definir senha</h1>
      <p className="mt-1 text-sm text-text-muted">
        Escolha uma senha para o seu primeiro acesso.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <Field
          label="Nova senha"
          htmlFor="password"
          required
          hint="Mínimo 10 caracteres, com maiúscula, minúscula e número."
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        <Field
          label="Confirmar senha"
          htmlFor="confirm"
          required
          error={state?.error ?? null}
        >
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        <SubmitButton />
      </form>
    </Surface>
  );
}
