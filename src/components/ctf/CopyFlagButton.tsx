"use client";

import { useState } from "react";

// Copies a collected flag. Used by the solve banner and the profile trophies.
export function CopyFlagButton({
  flag,
  label,
  copiedLabel,
}: {
  flag: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(flag);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: the flag stays selectable on screen
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      className="shrink-0 rounded-md border border-pop/40 px-2.5 py-1.5 font-mono text-xs text-pop transition hover:bg-pop/15"
    >
      <span aria-hidden>{copied ? "✓" : "⧉"}</span>
    </button>
  );
}
