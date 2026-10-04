import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { AFTER_AUTH_PATH, SIGN_IN_PATH, SIGN_UP_PATH } from "@/auth/paths";
import { THEME_COOKIE, parseThemeCookie } from "@/theme/theme";
import "./globals.css";

// Plex for its drafting-table character and because the mono and sans share
// metrics, so a file path sits level with the label beside it.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Cartograph",
  description: "A dependency map of a GitHub repository, drawn from its parsed code.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read on the server so a forced theme is in the first byte, not applied after hydration.
  const theme = parseThemeCookie((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={theme === "system" ? undefined : theme}
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ClerkProvider
          appearance={{ cssLayerName: "clerk" }}
          signInUrl={SIGN_IN_PATH}
          signUpUrl={SIGN_UP_PATH}
          signInFallbackRedirectUrl={AFTER_AUTH_PATH}
          signUpFallbackRedirectUrl={AFTER_AUTH_PATH}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
