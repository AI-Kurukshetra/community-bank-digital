import { getCardStatusMeta, formatCardExpiry } from "@/lib/banking";
import { cn } from "@/lib/utils";
import type { Card } from "@/types";
import { maskCardNumber } from "@/utils/maskAccount";

function getCardSurface(status: Card["status"]) {
  switch (status) {
    case "frozen":
      return "bg-[linear-gradient(145deg,#1d2554_0%,#4651a5_55%,#7ea4ff_100%)]";
    case "cancelled":
      return "bg-[linear-gradient(145deg,#351837_0%,#73375c_52%,#c36a91_100%)]";
    default:
      return "bg-[linear-gradient(145deg,#151e4a_0%,#384ecc_52%,#6b7cff_100%)]";
  }
}

export function CardDisplay({
  card,
  size
}: {
  card: Card;
  size: "sm" | "lg";
}) {
  const statusMeta = getCardStatusMeta(card.status);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.9rem] p-5 text-white shadow-[0_30px_90px_rgba(34,43,106,0.26)]",
        getCardSurface(card.status),
        size === "sm" ? "min-h-[220px]" : "min-h-[280px] w-full p-7"
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-10 top-4 h-32 w-32 rounded-full bg-white/16 blur-2xl" />
        <div className="absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-[#f57bb1]/24 blur-2xl" />
        <div className="absolute inset-x-8 top-[46%] h-px bg-white/18" />
      </div>

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/68">
              Community Bank
            </p>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.24em] text-white/88">
              {card.card_type.toUpperCase()}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/12 px-3 py-1.5 text-xs font-medium backdrop-blur">
            <span className={cn("h-2 w-2 rounded-full", statusMeta.dotClassName)} />
            <span>{statusMeta.label}</span>
          </div>
        </div>

        <div
          className={cn(
            "relative font-mono tracking-[0.28em] text-white/96",
            size === "sm" ? "mt-12 text-lg" : "mt-20 text-[1.7rem]"
          )}
        >
          {maskCardNumber(card.masked_number)}
        </div>

        <div className="relative mt-auto flex items-end justify-between gap-4 pt-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/60">
              Expires
            </p>
            <p className="mt-1 text-base font-semibold">
              {formatCardExpiry(card.expires_at)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/60">
              Secure debit
            </p>
            <p className="mt-1 text-sm text-white/82">Protected checkout</p>
          </div>
        </div>
      </div>
    </div>
  );
}
