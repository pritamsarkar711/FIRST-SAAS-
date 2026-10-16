"use client";

import { useState } from "react";
import { Copy, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Copies a plain-text summary of the audit report for pasting into notes, emails or tickets. */
export function CopySummaryButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be unavailable (http, permissions). Fall back to a hidden textarea.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <Button variant="outline" onClick={copy} className="rounded-md font-semibold print:hidden">
      {copied ? <CircleCheck className="mr-2 h-4.5 w-4.5 text-ok" /> : <Copy className="mr-2 h-4.5 w-4.5" />}
      {copied ? "Copied" : "Copy summary"}
    </Button>
  );
}
