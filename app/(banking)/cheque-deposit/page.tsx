"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Upload
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useNavigationProgress } from "@/hooks/useNavigationProgress";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Account } from "@/types";
import { formatGBP, poundsToPence } from "@/utils/currency";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_AMOUNT_PENCE = 500_000;
const STEPS = ["Select Account", "Upload Image", "Enter Amount", "Review"];

export default function ChequeDepositPage() {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const { startNavigation } = useNavigationProgress();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [reference, setReference] = useState("");

  useEffect(() => {
    async function loadAccounts() {
      if (!user?.id) {
        return;
      }

      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const nextAccounts = (data ?? []) as Account[];
      setAccounts(nextAccounts);
      setSelectedAccountId((current) => current || nextAccounts[0]?.id || "");
    }

    void loadAccounts();
  }, [supabase, user?.id]);

  function getAmountPence() {
    const pounds = Number(amount);

    if (!Number.isFinite(pounds) || pounds <= 0) {
      return null;
    }

    return poundsToPence(pounds);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];

    if (!selected) {
      return;
    }

    if (!["image/jpeg", "image/png"].includes(selected.type)) {
      setMessage("Only JPEG and PNG images are accepted.");
      setMessageType("error");
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setMessage("File size must be under 10MB.");
      setMessageType("error");
      return;
    }

    setFile(selected);
    setMessage("");
    const reader = new FileReader();
    reader.onload = (loadEvent) => setPreview(loadEvent.target?.result as string);
    reader.readAsDataURL(selected);
  }

  async function handleSubmit() {
    if (!file || !selectedAccountId || submitting) {
      return;
    }

    const amountPence = getAmountPence();

    if (!amountPence || amountPence > MAX_AMOUNT_PENCE) {
      setMessage("Enter a valid amount up to GBP 5,000.");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("account_id", selectedAccountId);
      formData.append("amount_pence", String(amountPence));

      const response = await fetch("/api/v1/cheque", {
        body: formData,
        method: "POST"
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        reference?: string;
      };

      if (!response.ok) {
        setMessage(payload.error || "Submission failed.");
        setMessageType("error");
        return;
      }

      setReference(payload.reference || "");
      setMessage(`Reference: ${payload.reference}. Funds available 1-2 working days.`);
      setMessageType("success");
      setStep(4);
    } catch {
      setMessage("Submission failed. Please try again.");
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const amountPence = getAmountPence() ?? 0;

  return (
    <div className="space-y-6">
      <section className="banking-panel p-6">
        <div>
          <p className="banking-chip">Deposit</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Cheque Deposit
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Photograph your cheque and submit for processing.
          </p>
        </div>

        {step < 4 ? (
          <div className="mt-6 flex items-center gap-2">
            {STEPS.map((label, index) => (
              <div className="flex items-center gap-2" key={label}>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                    index <= step
                      ? "bg-[#3047ff] text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`hidden text-sm font-medium sm:inline ${
                    index <= step ? "text-slate-950" : "text-slate-400"
                  }`}
                >
                  {label}
                </span>
                {index < STEPS.length - 1 ? (
                  <div className="mx-1 h-px w-6 bg-slate-200" />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {step === 4 ? (
        <Card className="banking-panel border-white/50 bg-white/70">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <p className="text-xl font-semibold text-slate-950">Cheque submitted</p>
            <p className="text-sm text-slate-500">
              Reference: <span className="font-mono font-semibold">{reference}</span>
            </p>
            <p className="text-sm text-slate-500">Funds available 1-2 working days.</p>
            <Button
              className="mt-2 rounded-xl"
              onClick={() => {
                startNavigation();
                router.push("/dashboard");
              }}
              variant="outline"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="banking-panel border-white/50 bg-white/70">
          <CardContent className="p-6">
            {step === 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-950">Select account</h3>
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  onChange={(event) => setSelectedAccountId(event.target.value)}
                  value={selectedAccountId}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.type.charAt(0).toUpperCase() + account.type.slice(1)} - {formatGBP(account.balance_pence)}
                    </option>
                  ))}
                </select>
                <div className="flex justify-end">
                  <Button
                    className="rounded-xl bg-[#3047ff] hover:bg-[#2538cc]"
                    disabled={!selectedAccountId}
                    onClick={() => setStep(1)}
                    type="button"
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-950">Upload cheque image</h3>
                <div
                  className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center transition hover:border-[#3047ff]/40"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {preview ? (
                    <div className="relative h-48 w-full max-w-md overflow-hidden rounded-xl">
                      <Image
                        alt="Cheque preview"
                        className="object-contain"
                        fill
                        sizes="(max-width: 768px) 100vw, 448px"
                        src={preview}
                        unoptimized
                      />
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-slate-400" />
                      <p className="text-sm text-slate-500">Click to upload or drag and drop</p>
                      <p className="text-xs text-slate-400">JPEG or PNG, max 10MB</p>
                    </>
                  )}
                </div>
                <input
                  accept="image/jpeg,image/png"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  type="file"
                />
                {message && messageType === "error" ? (
                  <p className="text-sm text-red-500">{message}</p>
                ) : null}
                <div className="flex justify-between">
                  <Button className="rounded-xl" onClick={() => setStep(0)} type="button" variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    className="rounded-xl bg-[#3047ff] hover:bg-[#2538cc]"
                    disabled={!file}
                    onClick={() => {
                      setMessage("");
                      setStep(2);
                    }}
                    type="button"
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-950">Enter cheque amount</h3>
                <div>
                  <label className="text-sm font-medium text-slate-700">Amount (GBP)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    max="5000"
                    min="0.01"
                    onChange={(event) => setAmount(event.target.value)}
                    step="0.01"
                    type="number"
                    value={amount}
                  />
                  <p className="mt-1 text-xs text-slate-400">Maximum GBP 5,000 per cheque</p>
                </div>
                <div className="flex justify-between">
                  <Button className="rounded-xl" onClick={() => setStep(1)} type="button" variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    className="rounded-xl bg-[#3047ff] hover:bg-[#2538cc]"
                    disabled={!amount || amountPence <= 0 || amountPence > MAX_AMOUNT_PENCE}
                    onClick={() => setStep(3)}
                    type="button"
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-950">Review and submit</h3>
                <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Account</span>
                    <span className="font-medium text-slate-950">
                      {selectedAccount
                        ? `${selectedAccount.type.charAt(0).toUpperCase() + selectedAccount.type.slice(1)}`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">File</span>
                    <span className="font-medium text-slate-950">{file?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Amount</span>
                    <span className="font-medium text-slate-950">{formatGBP(amountPence)}</span>
                  </div>
                </div>
                {message ? (
                  <p className={`text-sm ${messageType === "success" ? "text-emerald-600" : "text-red-500"}`}>
                    {message}
                  </p>
                ) : null}
                <div className="flex justify-between">
                  <Button className="rounded-xl" onClick={() => setStep(2)} type="button" variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    className="rounded-xl bg-[#3047ff] hover:bg-[#2538cc]"
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                    type="button"
                  >
                    {submitting ? (
                      "Submitting..."
                    ) : (
                      <>
                        <Camera className="mr-2 h-4 w-4" />
                        Submit Cheque
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
