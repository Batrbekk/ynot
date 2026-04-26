import * as React from "react";

export interface Stat {
  value: string;
  label: string;
}

export function StatsBlock({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-12 md:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <p className="font-heading text-[64px] leading-none text-foreground-primary md:text-[80px]">
            {s.value}
          </p>
          <p className="mt-4 text-[12px] uppercase tracking-[0.25em] text-foreground-secondary">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}
