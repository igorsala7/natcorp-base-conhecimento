"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useFocoPreso } from "@/components/ui/use-foco-preso";

type Ampliada = { src: string; alt: string; caption: string };

/**
 * Lightbox das imagens do artigo (portal público): clicar em qualquer imagem de
 * conteúdo abre uma sobreposição em tela cheia para ver melhor. Só as imagens
 * dentro de `.leitura figure` viram alvo — avatares (em `<p>`) e ícones ficam de
 * fora. Fecha no Esc, no clique no fundo ou no botão. Reanexa a cada navegação
 * (`usePathname`), já que o conteúdo desta página É o próprio caminho.
 */
export function ImageLightbox() {
  const pathname = usePathname();
  const [ampliada, setAmpliada] = useState<Ampliada | null>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  const abrir = useCallback((img: HTMLImageElement) => {
    const fig = img.closest("figure");
    const caption = fig?.querySelector("figcaption")?.textContent?.trim() ?? "";
    setAmpliada({ src: img.currentSrc || img.src, alt: img.alt, caption });
  }, []);

  // Torna cada imagem de conteúdo clicável e focável pelo teclado. Mira o
  // wrapper do renderizador de leitura (`.prose-portal figure img`) — o MESMO no
  // portal e na prévia —, o que deixa de fora as imagens do editor inline.
  useEffect(() => {
    const imgs = Array.from(
      document.querySelectorAll<HTMLImageElement>(".prose-portal figure img"),
    );
    const limpezas = imgs.map((img) => {
      if (img.closest("a")) return () => {}; // imagem-link: deixa o link agir
      img.classList.add("cursor-zoom-in");
      img.setAttribute("role", "button");
      img.setAttribute("tabindex", "0");
      img.setAttribute("aria-label", `Ampliar imagem${img.alt ? `: ${img.alt}` : ""}`);
      const onClick = () => abrir(img);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrir(img);
        }
      };
      img.addEventListener("click", onClick);
      img.addEventListener("keydown", onKey);
      return () => {
        img.removeEventListener("click", onClick);
        img.removeEventListener("keydown", onKey);
      };
    });
    return () => limpezas.forEach((f) => f());
  }, [pathname, abrir]);

  /**
   * Trava o scroll, fecha no Esc, entra com o foco no botão de fechar E o
   * devolve à imagem ao sair — mais o ciclo do Tab, que era o que faltava.
   *
   * Este arquivo tinha a própria versão de metade disso (scroll, Esc, foco de
   * entrada) escrita à mão, sem a armadilha: Tab saía do lightbox e percorria
   * o artigo por baixo do fundo escuro. Duas implementações de foco modal
   * convivendo é exatamente o que `useFocoPreso` foi extraído para evitar —
   * ele já tem teste, e agora também filtra o que está escondido por CSS.
   */
  useFocoPreso(!!ampliada, painelRef, () => setAmpliada(null));

  if (!ampliada) return null;

  return createPortal(
    <div
      ref={painelRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-8 motion-safe:animate-in motion-safe:fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={ampliada.alt || "Imagem ampliada"}
      onClick={() => setAmpliada(null)}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => setAmpliada(null)}
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <X className="size-5" />
      </button>
      <figure className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ampliada.src}
          alt={ampliada.alt}
          className="mx-auto max-h-[85vh] max-w-full rounded-lg object-contain"
        />
        {ampliada.caption ? (
          <figcaption className="mt-3 text-center text-sm text-white/70">
            {ampliada.caption}
          </figcaption>
        ) : null}
      </figure>
    </div>,
    document.body,
  );
}
