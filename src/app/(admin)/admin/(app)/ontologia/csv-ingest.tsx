"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp, Table2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { importarDicionarioCsv } from "./csv-actions";
import { useEntradaGrande, resumoDaEntrada } from "./use-entrada-grande";

/**
 * DICIONÁRIO POR CSV — a porta de entrada sem PL/SQL.
 *
 * As outras duas ingestões desta página pedem um JSON gerado por package no
 * banco do cliente, o que exige DBA a cada base. Esta aceita o que qualquer
 * pessoa exporta: uma relação de tabelas e colunas.
 *
 * O texto na tela diz o que o arquivo precisa ter e o que é opcional, porque a
 * primeira tentativa costuma falhar por cabeçalho — e um erro de cabeçalho que
 * não diz qual cabeçalho faltou obriga a pessoa a adivinhar.
 */
export function CsvIngest({ spaceId }: { spaceId: string }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  // Arquivo grande vai pelo Storage; pequeno, no corpo. Ver o hook.
  const ent = useEntradaGrande(spaceId, "csvdic");
  const [pend, start] = useTransition();

  function importar() {
    start(async () => {
      const r = await importarDicionarioCsv(spaceId, ent.entrada());
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      // O relatório diz o que ficou de fora, não só o que entrou: quem exporta
      // demais precisa saber que colunas não foram aproveitadas, e quem tem
      // linhas incompletas precisa saber quantas caíram.
      const extras = [
        r.descartadas > 0 ? `${r.descartadas} linha(s) sem tabela ou coluna foram ignoradas` : "",
        r.ignoradas.length > 0 ? `colunas não usadas: ${r.ignoradas.slice(0, 5).join(", ")}` : "",
      ].filter(Boolean);
      toast.success(`${r.gravadas} coluna(s) no dicionário.${extras.length ? " " + extras.join(" · ") : ""}`);
      ent.setTexto("");
      ent.limparArquivo();
    });
  }


  return (
    <Surface elevation={1} padding="lg" className="space-y-4">
      <div className="flex items-center gap-2">
        <Table2 className="size-5 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-text">Tabelas e colunas (CSV ou JSON)</h2>
      </div>

      <p className="text-xs leading-relaxed text-text-muted">
        Uma relação de <strong>tabela</strong> e <strong>coluna</strong> — o mínimo para o assistente saber que{" "}
        <code>COD</code> na tabela <code>CENTRO_DE_CUSTO</code> se chama &ldquo;Código&rdquo;. Colunas de{" "}
        <strong>label</strong>, <strong>descrição</strong> e <strong>tipo</strong> entram se existirem. Os
        cabeçalhos podem estar em português ou como saem do SQL Developer (<code>TABLE_NAME</code>,{" "}
        <code>COLUMN_NAME</code>, <code>COMMENTS</code>). Aceita CSV e também um JSON com a mesma relação — o formato é detectado pelo conteúdo.
      </p>

      <textarea
        className={`${controlClass} h-32 font-mono text-2xs`}
        placeholder={"tabela,coluna,label,descricao\nCENTRO_DE_CUSTO,COD,Código,Identificador do centro de custo\nFILIAIS,COD_FILIAL,Filial,"}
        value={ent.texto}
        onChange={(e) => ent.setTexto(e.target.value)}
      />
      <input ref={fileRef} type="file" accept=".csv,.tsv,.json,text/csv,application/json" className="hidden" onChange={(e) => void ent.aoEscolherArquivo(e)} />

      {(() => {
        const r = resumoDaEntrada(ent);
        if (!r) return null;
        return (
          <p className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-2xs">
            {r.arquivo && <FileUp className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
            {r.arquivo && <span className="min-w-0 flex-1 truncate font-medium text-text">{r.arquivo}</span>}
            <span className="tabular-nums text-text-muted">{r.tamanho}</span>
            {r.arquivo && (
              <Button variant="ghost" size="sm" className="h-auto p-0 text-2xs" onClick={ent.limparArquivo}>
                Remover
              </Button>
            )}
          </p>
        );
      })()}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={importar} loading={pend} loadingLabel="Importando…" disabled={ent.subindo || !ent.temAlgo}>
          <Table2 /> Importar dicionário
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={pend} loading={ent.subindo} loadingLabel="Enviando…">
          <Upload /> Escolher arquivo
        </Button>
        {/* Dito antes de acontecer: reimportar SUBSTITUI. É o comportamento
            certo — coluna removida do sistema precisa sumir daqui —, mas quem
            espera acúmulo perderia dados sem entender por quê. */}
        <span className="text-2xs text-text-muted">
          Reimportar substitui o que veio de CSV antes. O que veio do APEX e do banco não é tocado.
        </span>
      </div>
    </Surface>
  );
}
