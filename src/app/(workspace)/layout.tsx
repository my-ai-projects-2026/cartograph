import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { cookies } from "next/headers";
import { AFTER_AUTH_PATH } from "@/auth/paths";
import { THEME_COOKIE, parseThemeCookie } from "@/theme/theme";
import { ThemeControl } from "@/theme/theme-control";
import { Wordmark } from "@/ui/wordmark";

// Clerk's switcher trigger is sized for marketing pages; this keeps it to the header's height.
const switcherAppearance = {
  elements: {
    organizationSwitcherTrigger: "h-6 px-1.5 py-0 text-xs rounded-[3px] hover:bg-raised",
  },
};

// The application shell. Everything signed-in renders inside <main>.
export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const theme = parseThemeCookie((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 text-xs">
        <Wordmark />
        <span className="h-4 w-px bg-line" aria-hidden />
        {/* Switching and inviting both live here; personal accounts don't exist in this app. */}
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl={AFTER_AUTH_PATH}
          afterCreateOrganizationUrl={AFTER_AUTH_PATH}
          appearance={switcherAppearance}
        />
        <div className="ml-auto flex items-center gap-3">
          <ThemeControl initial={theme} />
          <UserButton appearance={{ elements: { avatarBox: "size-6" } }} />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
