"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { RoleWithPerms } from "./page";

/**
 * Guia de referência: o que cada papel É, o que FAZ e quais permissões possui.
 * As permissões vêm do banco (`role_permissions`) — fonte da verdade; os
 * resumos em linguagem simples são texto de UI (espelham a Parte 5.7 do PROJECT).
 */
const RESUMO: Record<string, string> = {
  owner:
    "Dono da plataforma. Faz tudo — o único que gerencia faturamento, exclui espaços e transfere a propriedade. Deve existir sempre ao menos um; o sistema bloqueia a remoção do último.",
  admin_tech:
    "Configura o sistema: espaços, domínios, temas, chaves de widget e API, provedores de IA, reindexação e log de auditoria. Gerencia usuários até o nível 80. Não mexe em faturamento.",
  content_mgr:
    "Domínio total sobre a documentação: cria, edita, publica, reorganiza a árvore, move entre espaços, importa, gerencia overlays de cliente e restaura versões. Não acessa configuração técnica nem chaves.",
  editor:
    "Cria, edita e exclui conteúdo — mas publicar depende de aprovação (envia para revisão). Não reorganiza a árvore fora do seu escopo, não gerencia usuários e não configura nada.",
  reviewer:
    "Lê rascunhos, comenta e aprova ou rejeita a publicação. Não edita o conteúdo.",
  reader:
    "Somente leitura, inclusive do conteúdo privado do espaço a que pertence. É o papel dos usuários finais de espaços restritos.",
};

/** Tom do selo de nível por faixa hierárquica. */
function tomDoNivel(level: number): BadgeTone {
  if (level >= 100) return "primary";
  if (level >= 80) return "info";
  if (level >= 60) return "warning";
  return "neutral";
}

function RoleCard({ role }: { role: RoleWithPerms }) {
  const [aberto, setAberto] = useState(false);
  const total = role.permissions.length;
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-4 shadow-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tracking-tight">{role.name}</span>
        <Badge tone={tomDoNivel(role.level)}>nível {role.level}</Badge>
      </div>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">
        {RESUMO[role.key] ?? role.description ?? ""}
      </p>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="mt-3 flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline"
        aria-expanded={aberto}
      >
        {aberto ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {role.key === "owner"
          ? `Todas as permissões (${total})`
          : `${total} ${total === 1 ? "permissão" : "permissões"}`}
      </button>
      {aberto && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {role.permissions.map((p) => (
            <li
              key={p.key}
              title={p.key}
              className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-text-muted"
            >
              {p.description ?? p.key}
            </li>
          ))}
          {total === 0 && <li className="text-xs text-text-muted">Nenhuma permissão.</li>}
        </ul>
      )}
    </div>
  );
}

export function RolesGuide({ roles }: { roles: RoleWithPerms[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-left shadow-1 hover:bg-surface-2"
      >
        <ShieldCheck className="size-4 text-primary" />
        <span className="text-sm font-semibold">Entenda os papéis e permissões</span>
        <span className="text-xs text-text-muted">
          O que cada perfil é, faz e pode fazer
        </span>
        {aberto ? (
          <ChevronDown className="ml-auto size-4 text-text-muted" />
        ) : (
          <ChevronRight className="ml-auto size-4 text-text-muted" />
        )}
      </button>
      {aberto && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {roles.map((r) => (
              <RoleCard key={r.id} role={r} />
            ))}
          </div>
          <p className="mt-3 text-xs text-text-muted">
            Cada papel <strong>contém</strong> as permissões do papel abaixo. Ninguém pode conceder
            um papel de nível igual ou superior ao seu, e o servidor recusa a ação mesmo que a
            interface seja contornada.
          </p>
        </>
      )}
    </section>
  );
}
