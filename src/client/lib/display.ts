/**
 * Puts the display settings on the page: the theme as `data-theme` on <html>
 * (following the device when set to "system"), high contrast as a class, and
 * the browser's theme colour to match. public/theme.js does the same once
 * before the first paint; this keeps it up to date afterwards.
 */
import type { Settings, Theme } from "../../core/save";

/** The page background in each theme, for the browser chrome. */
const THEME_COLOURS = { dark: "#0d0f12", light: "#e1e6ec" } as const;

const lightQuery = (): MediaQueryList => window.matchMedia("(prefers-color-scheme: light)");

/** The theme actually shown for a setting. */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return lightQuery().matches ? "light" : "dark";
}

function apply(settings: Settings): void {
  const root = document.documentElement;
  const theme = resolveTheme(settings.theme);
  root.dataset["theme"] = theme;
  root.classList.toggle("high-contrast", settings.highContrast);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOURS[theme]);
}

/**
 * Applies `settings` now and whenever the device switches between light and
 * dark. Returns a function that stops following the device.
 */
export function showSettings(settings: Settings): () => void {
  apply(settings);
  if (settings.theme !== "system") return () => undefined;
  const query = lightQuery();
  const onchange = (): void => {
    apply(settings);
  };
  query.addEventListener("change", onchange);
  return () => {
    query.removeEventListener("change", onchange);
  };
}
