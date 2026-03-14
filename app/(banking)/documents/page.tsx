"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Document, DocumentType } from "@/types";
import { formatDate } from "@/utils/dates";

const tabs: Array<{ label: string; value: DocumentType }> = [
  { label: "Tax", value: "tax" },
  { label: "Loan Papers", value: "loan" },
  { label: "Letters", value: "letter" },
  { label: "Other", value: "other" }
];

export default function DocumentsPage() {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const [activeTab, setActiveTab] = useState<DocumentType>("tax");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocuments() {
      if (!user?.id) {
        return;
      }

      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setDocuments((data ?? []) as Document[]);
      setLoading(false);
    }

    void loadDocuments();
  }, [supabase, user?.id]);

  async function handleDownload(documentId: string) {
    setDownloadingId(documentId);

    try {
      const response = await fetch(`/api/v1/documents/${documentId}/download`);
      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
      };

      if (response.ok && payload.url) {
        window.open(payload.url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setDownloadingId(null);
    }
  }

  const filteredDocuments = useMemo(
    () => documents.filter((document) => document.type === activeTab),
    [activeTab, documents]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3047ff] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="banking-panel p-6">
        <div>
          <p className="banking-chip">Records</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Documents
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Tax certificates, loan papers, and secure correspondence.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                activeTab === tab.value
                  ? "bg-[#3047ff] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {filteredDocuments.length === 0 ? (
        <Card className="banking-panel border-white/50 bg-white/70">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#3047ff]">
              <FolderOpen className="h-7 w-7" />
            </div>
            <p className="text-lg font-semibold text-slate-950">No documents available</p>
            <p className="text-sm text-slate-500">Documents for this category will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((document) => (
            <div
              className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/65 bg-white/65 px-5 py-4"
              key={document.id}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#3047ff]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-950">{document.filename}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {formatDate(document.created_at)}
                  </p>
                </div>
              </div>

              <Button
                className="rounded-xl"
                disabled={downloadingId === document.id}
                onClick={() => void handleDownload(document.id)}
                size="sm"
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                {downloadingId === document.id ? "Loading..." : "Download"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
