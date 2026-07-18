"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Alterna entre tema claro e escuro. Evita mismatch de hidratação. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Padrão recomendado pelo next-themes: só sabemos o tema real após montar no
  // cliente. O setState aqui é intencional e roda uma única vez.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Só sabemos o tema real após montar. Antes disso, tudo (ícone E aria-label)
  // precisa bater com o que o servidor renderizou — senão dá hydration mismatch.
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={
        !mounted
          ? "Alternar tema"
          : isDark
            ? "Ativar tema claro"
            : "Ativar tema escuro"
      }
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
