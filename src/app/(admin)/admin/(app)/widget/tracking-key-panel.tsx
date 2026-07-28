"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Input, controlClass } from "@/components/ui/input";
import { eyebrowLabel } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import {
  getTrackingKey,
  generateTrackingKey,
  deleteTrackingKey,
  previewTrackingToken,
} from "./tracking-actions";

type Space = { id: string; name: string; slug: string };

function CopyBtn({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          setOk(false);
        }
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:border-primary hover:text-primary"
    >
      {ok ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {ok ? "Copiado" : label}
    </button>
  );
}

const CAMPOS = ["p_usuario", "p_empresa", "p_matricula", "p_perfil", "p_portal", "p_base"] as const;

export function TrackingKeyPanel({ spaces, siteUrl }: { spaces: Space[]; siteUrl: string }) {
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const [key, setKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [teste, setTeste] = useState<Record<string, string>>({ p_usuario: "joao.silva", p_empresa: "ACME" });
  const [tokenTeste, setTokenTeste] = useState("");

  const space = spaces.find((s) => s.id === spaceId);

  useEffect(() => {
    if (!spaceId) return;
    let cancelado = false;
    const carregar = async () => {
      setLoading(true);
      setKey(null);
      setTokenTeste("");
      try {
        const r = await getTrackingKey(spaceId);
        if (!cancelado) setKey(r.key);
      } catch {
        if (!cancelado) setKey(null);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    void carregar();
    return () => {
      cancelado = true;
    };
  }, [spaceId]);

  async function gerar(rotacionar: boolean) {
    if (rotacionar) {
      const ok = await confirmar({
        title: "Rotacionar a chave?",
        description:
          "Gera uma chave nova. Os tokens já emitidos com a chave antiga deixam de valer — atualize o segredo no seu backend.",
        confirmLabel: "Rotacionar",
        tone: "danger",
      });
      if (!ok) return;
    }
    setBusy(true);
    const r = await generateTrackingKey(spaceId);
    setBusy(false);
    if (r.ok) {
      setKey(r.key);
      toast.success(rotacionar ? "Chave rotacionada." : "Chave gerada.");
    } else toast.error(r.error);
  }

  async function remover() {
    const ok = await confirmar({
      title: "Remover a chave de rastreio?",
      description: "Sem chave, este espaço para de registrar a identidade (os tokens são ignorados).",
      confirmLabel: "Remover",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    const r = await deleteTrackingKey(spaceId);
    setBusy(false);
    if (r.ok) {
      setKey(null);
      setTokenTeste("");
      toast.success("Chave removida.");
    } else toast.error(r.error ?? "Falhou.");
  }

  async function gerarTokenTeste() {
    const r = await previewTrackingToken(spaceId, teste);
    if (r.ok) setTokenTeste(r.token);
    else toast.error(r.error);
  }

  const exemploNode = `const crypto = require("crypto");
// A CHAVE gerada acima (guarde no seu backend, ex.: variável de ambiente):
const KEY = Buffer.from(process.env.KB_TRACKING_KEY, "base64");

function kbToken(params) {
  const payload = Buffer.from(JSON.stringify(params), "utf8");
  const mac = crypto.createHmac("sha256", KEY).update(payload).digest();
  const u = (b) => b.toString("base64url");
  return "kbt1h." + u(payload) + "." + u(mac);
}

// Gere por usuário logado e ponha em data-token / ?kbt= :
const token = kbToken({
  p_usuario: "joao.silva", p_empresa: "ACME", p_matricula: "00123",
  p_perfil: "gestor", p_portal: "cliente-a", p_base: "prod",
  exp: Math.floor(Date.now() / 1000) + 3600,   // opcional: expira em 1h
});`;

  const exemploPhp = `<?php
$key = base64_decode(getenv('KB_TRACKING_KEY'));
function kb_token($key, $params) {
  $u = fn($b) => rtrim(strtr(base64_encode($b), '+/', '-_'), '=');
  $payload = json_encode($params, JSON_UNESCAPED_UNICODE);
  $mac = hash_hmac('sha256', $payload, $key, true);
  return 'kbt1h.' . $u($payload) . '.' . $u($mac);
}
$token = kb_token($key, ['p_usuario'=>'joao.silva','p_empresa'=>'ACME',
  'exp'=>time()+3600]);`;

  const docSlug = space?.slug ?? "SUA-DOC";
  const apexGrant = `GRANT EXECUTE ON DBMS_CRYPTO TO SEU_SCHEMA;`;
  const apexFull = `declare
  c_key  constant varchar2(64)  := 'COLE_A_CHAVE_BASE64_DO_PAINEL';
  c_site constant varchar2(200) := '${siteUrl}';
  l_key   raw(32);  l_json varchar2(2000);  l_pay raw(2000);
  l_mac   raw(32);  l_token varchar2(4000);

  -- base64url (base64 padrão sem padding, com - e _)
  function b64url(p raw) return varchar2 is
    v varchar2(8000);
  begin
    v := utl_raw.cast_to_varchar2(utl_encode.base64_encode(p));
    v := replace(replace(v, chr(13)), chr(10));
    return replace(replace(rtrim(v,'='), '+','-'), '/','_');
  end;
begin
  -- 1) JSON com os dados do usuário logado (apex_json escapa aspas/acentos)
  l_json := '{"p_usuario":'  ||apex_json.stringify(:P_USUARIO)
         || ',"p_empresa":'  ||apex_json.stringify(:P_EMPRESA_USER)
         || ',"p_matricula":'||apex_json.stringify(:P_MATRICULA_USER)
         || ',"p_perfil":'   ||apex_json.stringify(:P_PERFIL)
         || ',"p_portal":'   ||apex_json.stringify(:P_PAINEL)
         || ',"p_base":'     ||apex_json.stringify(:P_BASE) ||'}';

  -- 2) Assina (HMAC-SHA256) -> token
  l_key   := utl_encode.base64_decode(utl_raw.cast_to_raw(c_key));
  l_pay   := utl_i18n.string_to_raw(l_json, 'AL32UTF8');   -- bytes UTF-8
  l_mac   := dbms_crypto.mac(l_pay, dbms_crypto.hmac_sh256, l_key);
  l_token := 'kbt1h.'||b64url(l_pay)||'.'||b64url(l_mac);

  -- 3a) EMBED DO WIDGET (região "PL/SQL Dynamic Content"):
  htp.p('<script src="'||c_site||'/widget.js" data-key="pk_live_SUA_CHAVE" '
     ||'data-token="'||l_token||'" async></script>');

  -- 3b) LINK para a DOCUMENTAÇÃO (rastreia o acesso do usuário):
  htp.p('<a href="'||c_site||'/docs/${docSlug}?kbt='||l_token
     ||'" target="_blank">Abrir documentação</a>');
end;`;
  const apexLinkItem = `-- Reuse o mesmo l_token em quantos links quiser. Ex.: guardar a URL num item:
:P_URL_DOC := c_site || '/docs/${docSlug}?kbt=' || l_token;`;

  const urlComToken = tokenTeste
    ? `${siteUrl}/docs/${docSlug}?kbt=${tokenTeste}`
    : "";

  return (
    <Surface elevation={1} padding="lg" className="mt-6 space-y-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Rastreio seguro</h2>
          <p className="mt-0.5 text-sm text-text-muted">
            Os parâmetros <code>p_*</code> (usuário, empresa, matrícula…) não viajam mais em texto na
            URL. O seu backend os <b>cifra</b> com a chave abaixo e passa um <b>token</b> opaco — assim
            ninguém altera a identidade pelo console. Vale para o <b>widget</b> e para os <b>links da
            documentação</b> deste espaço.
          </p>
        </div>
      </div>

      {/* Espaço */}
      <label className="block">
        <span className={eyebrowLabel}>Documentação (espaço)</span>
        <select
          value={spaceId}
          onChange={(e) => setSpaceId(e.target.value)}
          className={`${controlClass} mt-1 max-w-md`}
        >
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {/* Chave */}
      <div>
        <span className={eyebrowLabel}>Chave de rastreio (segredo do backend)</span>
        {loading ? (
          <p className="mt-1 text-sm text-text-muted">Carregando…</p>
        ) : key ? (
          <div className="mt-1 space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-surface-2 px-2 py-1.5 font-mono text-xs">
                {key}
              </code>
              <CopyBtn text={key} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => void gerar(true)} disabled={busy}>
                <RefreshCw className="size-4" /> Rotacionar
              </Button>
              <button
                type="button"
                onClick={() => void remover()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-brand-pink-700 transition-colors hover:bg-brand-pink-50 dark:hover:bg-brand-pink-950/40"
              >
                <Trash2 className="size-4" /> Remover
              </button>
            </div>
            <p className="text-xs text-text-muted">
              Guarde a chave no seu backend (ex.: variável de ambiente). Ela é um <b>segredo</b> — não a
              exponha no navegador.
            </p>
          </div>
        ) : (
          <div className="mt-1">
            <Button onClick={() => void gerar(false)} disabled={busy}>
              <KeyRound className="size-4" /> Gerar chave de rastreio
            </Button>
            <p className="mt-1 text-xs text-text-muted">
              Enquanto não houver chave, o rastreio deste espaço fica <b>sem identidade</b> (os tokens
              são ignorados).
            </p>
          </div>
        )}
      </div>

      {key && (
        <>
          <p className="text-xs text-text-muted">
            O token é <b>assinado (HMAC-SHA256)</b>:{" "}
            <code>kbt1h.&lt;base64url(json)&gt;.&lt;base64url(hmac)&gt;</code> — o HMAC é calculado sobre
            os bytes UTF-8 do JSON dos <code>p_*</code>, com a chave acima. À prova de adulteração;{" "}
            <code>exp</code> (unix, segundos) é opcional. O formato opaco <code>kbt1.</code>{" "}
            (AES-256-GCM) também é aceito.
          </p>

          {/* Oracle APEX — passo a passo (aberto por padrão) */}
          <details open className="rounded-lg border border-border">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
              Como usar no Oracle APEX
            </summary>
            <div className="space-y-3 border-t border-border p-3">
              <ol className="ml-4 list-decimal space-y-1 text-xs text-text-muted">
                <li>
                  Copie a <b>chave</b> acima e cole em <code>c_key</code> (guarde-a com segurança — é um
                  segredo do seu banco).
                </li>
                <li>
                  Conceda uma vez (o schema precisa do <code>DBMS_CRYPTO</code>):
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 overflow-x-auto rounded bg-surface-2 px-2 py-1 text-xs">
                      {apexGrant}
                    </code>
                    <CopyBtn text={apexGrant} />
                  </div>
                </li>
                <li>
                  Gere o <code>l_token</code> e use nos <b>dois</b> lugares: o <b>widget</b> (
                  <code>data-token</code>) e os <b>links da documentação</b> (<code>?kbt=</code>). O
                  mesmo token serve para ambos.
                </li>
              </ol>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">
                    Bloco PL/SQL — gera o token, embute o widget e monta o link
                  </span>
                  <CopyBtn text={apexFull} />
                </div>
                <pre className="overflow-x-auto rounded bg-surface-2 p-3 text-xs">{apexFull}</pre>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">
                    Rastreio nas páginas da documentação — a URL com o token
                  </span>
                  <CopyBtn text={apexLinkItem} />
                </div>
                <pre className="overflow-x-auto rounded bg-surface-2 p-3 text-xs">{apexLinkItem}</pre>
                <p className="mt-1 text-xs text-text-muted">
                  Basta o leitor <b>chegar uma vez</b> com <code>?kbt=</code> (por link, botão ou SSO):
                  o portal guarda o token e as páginas seguintes seguem atribuídas ao mesmo usuário na
                  visita.
                </p>
              </div>
            </div>
          </details>

          {/* Outros back-ends */}
          <details className="rounded-lg border border-border">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
              Outros back-ends (Node.js, PHP)
            </summary>
            <div className="space-y-3 border-t border-border p-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">Node.js</span>
                  <CopyBtn text={exemploNode} />
                </div>
                <pre className="overflow-x-auto rounded bg-surface-2 p-3 text-xs">{exemploNode}</pre>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">PHP</span>
                  <CopyBtn text={exemploPhp} />
                </div>
                <pre className="overflow-x-auto rounded bg-surface-2 p-3 text-xs">{exemploPhp}</pre>
              </div>
            </div>
          </details>

          {/* Testar */}
          <details className="rounded-lg border border-border">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
              Testar — gerar um token de exemplo
            </summary>
            <div className="space-y-3 border-t border-border p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CAMPOS.map((c) => (
                  <label key={c} className="block">
                    <span className="mb-0.5 block text-xs text-text-muted">{c}</span>
                    <Input
                      value={teste[c] ?? ""}
                      onChange={(e) => setTeste((t) => ({ ...t, [c]: e.target.value }))}
                      placeholder="—"
                    />
                  </label>
                ))}
              </div>
              <Button size="sm" onClick={() => void gerarTokenTeste()}>
                Gerar token de teste
              </Button>
              {tokenTeste && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 overflow-x-auto rounded bg-surface-2 px-2 py-1.5 font-mono text-xs">
                      {tokenTeste}
                    </code>
                    <CopyBtn text={tokenTeste} />
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 overflow-x-auto rounded bg-surface-2 px-2 py-1.5 text-xs">
                      {urlComToken}
                    </code>
                    <CopyBtn text={urlComToken} label="Copiar URL" />
                  </div>
                </div>
              )}
            </div>
          </details>
        </>
      )}
    </Surface>
  );
}
