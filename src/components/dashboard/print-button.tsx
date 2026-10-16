"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      variant="ghost"
      className="hidden rounded-md font-semibold sm:inline-flex print:hidden"
      onClick={() => window.print()}
    >
      <Printer className="mr-2 h-4.5 w-4.5" /> Print
    </Button>
  );
}
