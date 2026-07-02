"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="relative rounded-full border-border bg-bg-surface text-text-secondary shadow-md transition-colors hover:text-accent"
      aria-label="Cambiar tema"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun
        className="absolute size-4 scale-100 rotate-0 opacity-100 transition-all dark:scale-0 dark:rotate-90 dark:opacity-0"
        aria-hidden="true"
      />
      <Moon
        className="absolute size-4 scale-0 -rotate-90 opacity-0 transition-all dark:scale-100 dark:rotate-0 dark:opacity-100"
        aria-hidden="true"
      />
    </Button>
  );
}
