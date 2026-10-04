import type { ReactNode } from "react";
import { Wordmark } from "./wordmark";

// Sign-in and sign-up share one frame: what the app is, then Clerk's form.
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-1.5">
        <Wordmark />
        <p className="text-xs text-muted">
          A dependency map of a public GitHub repository, drawn from its parsed imports.
        </p>
      </div>
      {children}
    </div>
  );
}
