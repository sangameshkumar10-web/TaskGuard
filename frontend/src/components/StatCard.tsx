import type { ReactNode } from "react";

type Tone = "accent" | "danger" | "success" | "neutral";

interface StatCardProps {
  label: string;
  value: number;
  tone?: Tone;
  icon?: ReactNode;
}

export function StatCard({ label, value, tone = "neutral", icon }: StatCardProps) {
  return (
    <div className={`stat stat--${tone}`}>
      <div className="stat__top">
        {icon ? <span className="stat__icon">{icon}</span> : null}
        <span className="stat__value">{value}</span>
      </div>
      <span className="stat__label">{label}</span>
    </div>
  );
}