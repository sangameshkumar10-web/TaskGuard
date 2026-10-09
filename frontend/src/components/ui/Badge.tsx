import type { ReactNode } from "react";

type Tone = "accent" | "danger" | "warning" | "success" | "neutral";

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}