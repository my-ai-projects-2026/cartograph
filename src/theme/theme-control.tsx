"use client";

import { useState } from "react";
import { THEME_COOKIE, type ThemeChoice } from "./theme";

const CHOICES: ThemeChoice[] = ["system", "light", "dark"];
const ONE_YEAR = 60 * 60 * 24 * 365;

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") {
    delete root.dataset.theme;
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } else {
    root.dataset.theme = choice;
    document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  }
}

export function ThemeControl({ initial }: { initial: ThemeChoice }) {
  const [choice, setChoice] = useState(initial);

  return (
    <div role="radiogroup" aria-label="Theme" className="flex gap-px rounded-[3px] border border-line p-px text-[11px]">
      {CHOICES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={choice === option}
          onClick={() => {
            applyTheme(option);
            setChoice(option);
          }}
          className={
            choice === option
              ? "rounded-[2px] bg-raised px-1.5 py-px text-fg"
              : "rounded-[2px] px-1.5 py-px text-muted hover:text-fg"
          }
        >
          {option}
        </button>
      ))}
    </div>
  );
}
