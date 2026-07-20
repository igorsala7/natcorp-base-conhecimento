"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "loading" | "enroll" | "challenge";

/**
 * Segundo fator (TOTP) obrigatório:
 *  - enroll:    nenhum fator cadastrado → mostra QR + segredo para o app.
 *  - challenge: já existe fator verificado → pede apenas o código.
 * Em ambos, o código é validado via challenge+verify, elevando a sessão a AAL2.
 */
export default function MfaPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-surface-2" />}>
      <MfaForm />
    </Suspense>
  );
}

function MfaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";
  const supabase = useRef(createClient()).current;

  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const init = useCallback(async () => {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") {
      router.replace(next);
      return;
    }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.[0];

    if (verified) {
      setFactorId(verified.id);
      setMode("challenge");
      return;
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
    });
    if (enrollError || !data) {
      setError("Não foi possível iniciar o cadastro do TOTP.");
      setMode("enroll");
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setMode("enroll");
  }, [router, supabase, next]);

  useEffect(() => {
    void init();
  }, [init]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || submitting) return;
    setSubmitting(true);
    setError(null);

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError("Falha ao iniciar a verificação. Tente novamente.");
      setSubmitting(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError("Código inválido ou expirado. Verifique o app e tente de novo.");
      setSubmitting(false);
      return;
    }

    // Sessão elevada a AAL2 — segue para o destino (painel ou definir senha).
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {mode === "challenge" ? "Verificação em duas etapas" : "Ativar 2FA"}
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        {mode === "challenge"
          ? "Digite o código do seu app autenticador."
          : "Escaneie o QR code com seu app autenticador (Google Authenticator, 1Password, Authy…) e digite o código gerado."}
      </p>

      {mode === "loading" && (
        <div className="mt-6 h-40 animate-pulse rounded-md bg-surface-2" />
      )}

      {mode === "enroll" && qr && (
        <div className="mt-6 flex flex-col items-center gap-3">
          {/* qr_code é um SVG data-URI vindo do Supabase. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="QR code para configurar o TOTP"
            className="size-44 rounded-md border border-border bg-white p-2"
          />
          {secret && (
            <p className="text-center text-xs text-text-muted">
              Ou digite a chave manualmente:
              <br />
              <code className="font-mono text-text">{secret}</code>
            </p>
          )}
        </div>
      )}

      {(mode === "enroll" || mode === "challenge") && (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="code" className="text-sm font-medium">
              Código de 6 dígitos
            </label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="text-center font-mono text-lg tracking-[0.4em]"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md bg-brand-pink-50 px-3 py-2 text-sm text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || code.length !== 6}
          >
            {submitting ? "Verificando…" : "Confirmar"}
          </Button>
        </form>
      )}
    </div>
  );
}
