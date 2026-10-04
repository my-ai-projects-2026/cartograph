// The cookie only ever holds a forced choice. No cookie means follow the system,
// so the server can render <html data-theme> correctly on the first byte.
export const THEME_COOKIE = "theme";

export type ThemeChoice = "system" | "light" | "dark";

export function parseThemeCookie(value: string | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}
