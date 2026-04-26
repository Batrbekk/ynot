import * as React from "react";

export interface ValueCallout {
  title: string;
  body: string;
}

export function ValueCallouts({ items }: { items: ValueCallout[] }) {
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-16 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.title} className="flex flex-col gap-3 text-center md:text-left">
          <h3 className="font-heading text-[20px] text-foreground-primary">{it.title}</h3>
          <p className="text-[14px] leading-relaxed text-foreground-secondary">{it.body}</p>
        </div>
      ))}
    </div>
  );
}
