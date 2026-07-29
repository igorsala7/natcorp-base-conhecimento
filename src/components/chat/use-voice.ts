"use client";

import { useCallback, useRef, useState } from "react";

export type VoiceState = "idle" | "recording" | "transcribing";

/**
 * Gravação de voz para os chats: grava do microfone (MediaRecorder), envia o
 * áudio ao `endpoint` de transcrição e devolve o TEXTO em `onText` (que o chat
 * usa como se fosse uma mensagem digitada). Degrada com uma mensagem clara se o
 * microfone/permissão falhar ou a transcrição não estiver configurada.
 */
export function useVoiceInput(endpoint: string, onText: (text: string) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Gravação de voz não é suportada neste navegador.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Não consegui acessar o microfone (permissão negada?).");
      return;
    }
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      if (blob.size < 800) {
        setState("idle"); // gravação vazia/curtíssima: ignora
        return;
      }
      setState("transcribing");
      try {
        const fd = new FormData();
        fd.append("file", blob, "audio.webm");
        const res = await fetch(endpoint, { method: "POST", body: fd });
        const data = (await res.json().catch(() => null)) as { text?: string; transcribed?: boolean; error?: string } | null;
        if (res.ok && data?.transcribed && data.text?.trim()) onText(data.text.trim());
        else setError(data?.error || "Não consegui transcrever o áudio.");
      } catch {
        setError("Falha ao transcrever o áudio.");
      }
      setState("idle");
    };
    mrRef.current = mr;
    mr.start();
    setState("recording");
  }, [endpoint, onText]);

  const stop = useCallback(() => {
    if (mrRef.current && mrRef.current.state === "recording") mrRef.current.stop();
  }, []);

  const toggle = useCallback(() => {
    if (state === "recording") stop();
    else if (state === "idle") void start();
  }, [state, start, stop]);

  return { state, error, toggle };
}
