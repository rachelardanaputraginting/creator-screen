"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

const THEME_KEY = "creator-screen-theme";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export default function ThemeToggle(): React.JSX.Element {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      const isDark = stored !== "light";
      setDark(isDark);
      applyTheme(isDark);
    } catch {
      applyTheme(true);
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      /* noop */
    }
  };

  return (
    <Button size="sm" variant="ghost" onClick={toggle} aria-label="Toggle theme">
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
