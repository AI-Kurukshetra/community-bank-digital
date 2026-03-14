import { AlertTriangle } from "lucide-react";

export function FraudAlertBanner({ count }: { count: number }) {
  if (count < 1) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-red-600 px-4 py-3 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">Security alert</p>
          <p className="text-sm leading-6 text-white/95">
            Security alert: suspicious activity detected. Please review your
            transactions or contact us.
          </p>
        </div>
      </div>
    </div>
  );
}
