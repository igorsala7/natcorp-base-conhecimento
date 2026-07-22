"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KbUploadButton } from "@/components/admin/kb-upload-button";

/** Upload + resultado inline (client) para a página do chatbot. */
export function KbUploadRow({ spaceId }: { spaceId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <KbUploadButton
        spaceId={spaceId}
        onDone={(resumo) => {
          setMsg(resumo);
          router.refresh();
        }}
      />
      {msg && (
        <span role="status" className="max-w-56 truncate text-xs text-text-muted" title={msg}>
          {msg}
        </span>
      )}
    </span>
  );
}
