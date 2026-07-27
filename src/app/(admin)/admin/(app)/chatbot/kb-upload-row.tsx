"use client";

import { useRouter } from "next/navigation";
import { KbUploadButton } from "@/components/admin/kb-upload-button";
import { useToast } from "@/components/ui/toast";

/** Upload da base do chatbot; o resultado vira alerta no topo (client). */
export function KbUploadRow({ spaceId }: { spaceId: string }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <KbUploadButton
      spaceId={spaceId}
      onDone={(resumo) => {
        toast.success(resumo);
        router.refresh();
      }}
    />
  );
}
