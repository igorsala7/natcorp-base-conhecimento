"use client";

import { useRef, useState, useTransition } from "react";
import { Table2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { importarDicionarioCsv } from "./csv-actions";

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
  const [texto, setTexto] = useState("");
  const [pend, start] = useTransition();

  function importar() {
    start(async () => {
      const r = await importarDicionarioCsv(spaceId, texto);
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
      setTexto("");
    });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setTexto(String(reader.result ?? ""));
    reader.readAsText(f);
  }

  return (
    <Surface elevation={1} padding="lg" className="space-y-4">
      <div className="flex items-center gap-2">
        <Table2 className="size-5 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-text">Tabelas e colunas por CSV</h2>
      </div>

      <p className="text-xs leading-relaxed text-text-muted">
        Uma relação de <strong>tabela</strong> e <strong>coluna</strong> — o mínimo para o assistente saber que{" "}
        <code>COD</code> na tabela <code>CENTRO_DE_CUSTO</code> se chama &ldquo;Código&rdquo;. Colunas de{" "}
        <strong>label</strong>, <strong>descrição</strong> e <strong>tipo</strong> entram se existirem. Os
        cabeçalhos podem estar em português ou como saem do SQL Developer (<code>TABLE_NAME</code>,{" "}
        <code>COLUMN_NAME</code>, <code>COMMENTS</code>).
      </p>

      <textarea
        className={`${controlClass} h-32 font-mono text-2xs`}
        placeholder={"tabela,coluna,label,descricao\nCENTRO_DE_CUSTO,COD,Código,Identificador do centro de custo\nFILIAIS,COD_FILIAL,Filial,"}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <input ref={fileRef} type="file" accept=".csv,.tsv,text/csv" className="hidden" onChange={onFile} />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={importar} loading={pend} loadingLabel="Importando…" disabled={!texto.trim()}>
          <Table2 /> Importar dicionário
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={pend}>
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
