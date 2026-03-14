"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

export function StatementsDownloadButton({
  statementId
}: {
  statementId: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/v1/statements/${statementId}/download`
      );
      const data = await response.json();

      if (response.ok && data.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      className="rounded-xl"
      disabled={loading}
      onClick={() => void handleDownload()}
      size="sm"
      variant="outline"
    >
      <Download className="mr-2 h-4 w-4" />
      {loading ? "Loading..." : "Download"}
    </Button>
  );
}
