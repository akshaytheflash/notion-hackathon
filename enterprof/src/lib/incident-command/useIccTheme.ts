import { useCallback, useEffect, useState } from "react";

export type IccTheme = "dark" | "light";

const STORAGE_KEY = "icc-theme";

function getInitialTheme(): IccTheme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

export function useIccTheme() {
  const [theme, setTheme] = useState<IccTheme>(getInitialTheme);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme };
}
