import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { cookies } from "next/headers";
import { AFTER_AUTH_PATH } from "@/auth/paths";
import { THEME_COOKIE, parseThemeCookie } from "@/theme/theme";
import { ThemeControl } from "@/theme/theme-control";

// The application shell. Everything signed-in renders inside <main>.
export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const theme = parseThemeCookie((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-9 shrink-0 items-center gap-3 border-b border-line px-3 text-xs">
        <span className="font-mono font-medium">cartograph</span>
        <span className="h-4 w-px bg-line" aria-hidden />
        {/* Switching and inviting both live here; personal accounts don't exist in this app. */}
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl={AFTER_AUTH_PATH}
          afterCreateOrganizationUrl={AFTER_AUTH_PATH}
        />
        <div className="ml-auto flex items-center gap-3">
          <ThemeControl initial={theme} />
          <UserButton />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
