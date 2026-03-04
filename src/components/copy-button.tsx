"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-1.5 right-1.5 text-xs px-2 py-1 border border-border rounded bg-background hover:bg-muted transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
    >
      {copied ? "✓" : "copy"}
    </button>
  );
}
