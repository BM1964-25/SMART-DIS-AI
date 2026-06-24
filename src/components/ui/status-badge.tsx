import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const toneClassName = {
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700"
};

type StatusBadgeProps = {
  children: ReactNode;
  tone?: keyof typeof toneClassName;
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium",
        toneClassName[tone]
      )}
    >
      {children}
    </span>
  );
}
