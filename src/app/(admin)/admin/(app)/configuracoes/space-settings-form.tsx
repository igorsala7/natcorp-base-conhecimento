"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Globe, Lock, KeyRound, ShieldAlert, Sparkles, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { Surface } from "@/components/ui/surface";
import { eyebrowLabel } from "@/components/ui/field";
import { controlClass } from "@/components/ui/input";
import { updateSpaceSettings, clearSpaceEmbeddings, verifyCustomDomain, type DomainCheck } from "./actions";
import { Select } from "@/components/ui/select";

type Current = {
  id: string;
  name: string;
  slug: string;
  visibility: "public" | "private" | "password";
  custom_domain: string | null;
  access_referrers: string[] | null;
  access_denied_message: string | null;
};

export function SpaceSettingsForm({
  spaces,
  current,
  hasPassword,
  siteUrl,
}: {
  spaces: { id: string; name: string; slug: string }[];
  current: Current;
  hasPassword: boolean;
  siteUrl: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirmar } = useConfirm();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(current.name);
  const [visibility, setVisibility] = useState(current.visibility);
  const [customDomain, setCustomDomain] = useState(current.custom_domain ?? "");
  const [slug, setSlug] = useState(current.slug);
  const [password, setPassword] = useState("");
  const [clearing, setClearing] = useState(false);
  const [dns, setDns] = useState<DomainCheck | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [origens, setOrigens] = useState((current.access_referrers ?? []).join("\n"));
  const [msgBloqueio, setMsgBloqueio] = useState(current.access_denied_message ?? "");

  async function clearEmbeddings() {
    const ok = await confirmar({
      title: "Limpar embeddings",
      description: `Limpar os embeddings de TODO o conteúdo de "${current.name}"? A busca por texto continua funcionando, mas a busca semântica e o assistente ficarão sem vetores até você gerar novamente.`,
      tone: "danger",
      confirmLabel: "Limpar",
    });
    if (!ok) return;
    setClearing(true);
    startTransition(async () => {
      const r = await clearSpaceEmbeddings(current.id);
      setClearing(false);
      if (r.ok) {
        toast.success(`Embeddings limpos: ${r.count} trecho(s). Gere novamente pela árvore de conteúdo.`);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function save() {
    if (visibility === "password" && !hasPassword && !password) {
      toast.warning("Defina uma senha para proteger este espaço.");
      return;
    }
    startTransition(async () => {
      const r = await updateSpaceSettings({
        spaceId: current.id,
        name,
        slug,
        visibility,
        customDomain,
        password,
        accessReferrers: origens
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        accessDeniedMessage: msgBloqueio,
      });
      if (r.ok) {
        toast.success("Configurações salvas.");
        setPassword("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  const VIS = [
    { key: "public", label: "Pública", desc: "Qualquer um acessa pela URL.", icon: Globe },
    { key: "private", label: "Privada", desc: "Só usuários autenticados do espaço.", icon: Lock },
    { key: "password", label: "Com senha", desc: "Exige senha para abrir.", icon: KeyRound },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
          <p className="mt-1 text-sm text-text-muted">Nome, visibilidade e domínio do espaço.</p>
        </div>
        <Select
          value={current.id}
          onChange={(v) => {
            // Mantém `from`: sem ele o botão de voltar perde o destino.
            const params = new URLSearchParams(searchParams.toString());
            params.set("space", v);
            router.push(`/admin/configuracoes?${params.toString()}`);
          }}
          className={`${controlClass} h-9 w-auto px-2`}
          aria-label="Espaço"
        >
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      </div>

      <Surface elevation={1} padding="lg" className="space-y-4 rounded-xl">
        <label className="block text-sm">
          <span className={`mb-1 ${eyebrowLabel}`}>Nome</span>
          <input className={controlClass} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="block text-sm">
          <span className={`mb-1 ${eyebrowLabel}`}>Endereço público</span>
          <div className="flex items-center gap-1">
            <span className="shrink-0 text-sm text-text-muted">/docs/</span>
            <input
              className={controlClass}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="minha-documentacao"
            />
          </div>
          <span className="mt-1 block text-xs leading-relaxed text-text-muted">
            {slug !== current.slug ? (
              <strong className="font-medium text-primary">
                Ao salvar, <code>/docs/{current.slug}</code> passa a redirecionar (301) para o novo
                endereço — os links já compartilhados continuam funcionando.
              </strong>
            ) : (
              <>Trocar o endereço não quebra links antigos: eles passam a redirecionar.</>
            )}
          </span>
        </label>

        <div>
          <span className={`mb-1.5 ${eyebrowLabel}`}>Visibilidade</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {VIS.map((v) => {
              const Icon = v.icon;
              const active = visibility === v.key;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setVisibility(v.key)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    active ? "border-primary bg-brand-purple-50 dark:bg-brand-purple-950/30" : "border-border hover:border-primary/50"
                  }`}
                >
                  <Icon className={`size-4 ${active ? "text-primary" : "text-text-muted"}`} />
                  <div className="mt-1 text-sm font-medium">{v.label}</div>
                  <div className="text-xs text-text-muted">{v.desc}</div>
                </button>
              );
            })}
          </div>
          {visibility === "password" && (
            <div className="mt-3 rounded-lg border border-border bg-bg p-3">
              <label className="block text-sm">
                <span className={`mb-1 ${eyebrowLabel}`}>
                  {hasPassword ? "Nova senha (deixe em branco para manter)" : "Definir senha"}
                </span>
                <input
                  type="password"
                  className={controlClass}
                  placeholder={hasPassword ? "••••••••" : "mínimo 4 caracteres"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <p className="mt-1.5 text-xs text-text-muted">
                O portal pedirá esta senha antes de mostrar a documentação deste espaço.
                {hasPassword && " Uma senha já está definida."}
              </p>
            </div>
          )}
        </div>

        <label className="block text-sm">
          <span className={`mb-1 ${eyebrowLabel}`}>Domínio personalizado (opcional)</span>
          <input
            className={controlClass}
            placeholder="docs.cliente.com"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
          />
          <span className="mt-1 block text-xs text-text-muted">
            Sem domínio, a URL pública é <code>{siteUrl}/docs/{current.slug}</code>. Com domínio
            apontado, o portal desta documentação responde na raiz dele.
          </span>
        </label>

        {customDomain.trim() && (
          <div className="rounded-lg border border-border p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold">
                <Globe className="size-4 text-text-muted" /> Conexão do domínio
              </h2>
              <Button
                size="sm"
                variant="secondary"
                disabled={verificando}
                onClick={() => {
                  setVerificando(true);
                  void verifyCustomDomain(current.id).then((r) => {
                    setDns(r);
                    setVerificando(false);
                  });
                }}
              >
                {verificando ? "Verificando…" : dns ? "Verificar novamente" : "Verificar DNS"}
              </Button>
            </div>
            {dns?.estado === "ok" && (
              <p className="mt-2 flex items-center gap-1.5 text-primary">
                <CheckCircle2 className="size-4" /> Conectado — CNAME aponta para {dns.alvo}.
              </p>
            )}
            {dns?.estado === "apontando-errado" && (
              <p className="mt-2 text-brand-pink-700">
                O CNAME aponta para <code>{dns.alvo}</code>, mas deveria apontar para{" "}
                <code>{dns.esperado}</code>.
              </p>
            )}
            {dns?.estado === "nao-encontrado" && (
              <p className="mt-2 text-text-muted">
                Registro ainda não encontrado. Crie um CNAME de{" "}
                <code>{customDomain.trim()}</code> para <code>{dns.esperado}</code> — a propagação
                pode levar até 48h.
              </p>
            )}
            <p className="mt-2 text-xs text-text-muted">
              No seu provedor DNS: CNAME <code>{customDomain.trim()}</code> →{" "}
              <code>{new URL(siteUrl).host}</code>. O certificado SSL depende da hospedagem deste
              portal (fora do app).
            </p>
          </div>
        )}

        <div className="rounded-lg border border-border p-4 text-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="size-4 text-text-muted" /> Acesso por origem
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Com URLs abaixo, a documentação só abre para quem VEM delas (ex.: o portal do
            colaborador). Parâmetros variáveis não atrapalham: a comparação é pela origem e pelo
            início do caminho. Quem chegar de outro lugar vê a página bloqueada com a mensagem.
          </p>
          <label className="mt-3 block">
            <span className={`mb-1 ${eyebrowLabel}`}>
              URLs permitidas (uma por linha; vazio = sem restrição)
            </span>
            <textarea
              rows={3}
              value={origens}
              onChange={(e) => setOrigens(e.target.value)}
              placeholder={"https://www.natcorp.com.br/apex/f?p=200"}
              className={controlClass}
            />
          </label>
          <label className="mt-3 block">
            <span className={`mb-1 ${eyebrowLabel}`}>Mensagem da página bloqueada</span>
            <input
              value={msgBloqueio}
              onChange={(e) => setMsgBloqueio(e.target.value)}
              maxLength={300}
              placeholder="Acesso restrito apenas através do portal do colaborador."
              className={controlClass}
            />
          </label>
          <p className="mt-2 text-xs text-text-muted">
            Nota técnica: entre sites, o navegador costuma enviar só a ORIGEM (https://host) no
            Referer — o caminho é verificado quando disponível. Após o primeiro acesso válido, o
            leitor fica liberado por 7 dias neste navegador.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={pending}>
            {pending ? "Salvando…" : "Salvar configurações"}
          </Button>
        </div>

        {/* Manutenção do índice semântico */}
        <div className="mt-2 rounded-lg border border-border p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-text-muted" /> Índice semântico (embeddings)
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Remove os vetores de <strong>todo o conteúdo de “{current.name}”</strong>. A busca por
            texto continua funcionando; a busca semântica e o assistente ficam sem vetores até você
            gerar de novo (botão <em>Gerar embeddings</em> na pasta, dentro da árvore de conteúdo).
            Use ao trocar de modelo/provedor de embedding.
          </p>
          <div className="mt-3">
            <Button variant="secondary" onClick={clearEmbeddings} disabled={clearing}>
              <Eraser /> {clearing ? "Limpando…" : "Limpar embeddings"}
            </Button>
          </div>
        </div>
      </Surface>
    </div>
  );
}
