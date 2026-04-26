import * as React from "react";

export interface CareSection {
  title: string;
  body: string;
}

export interface CareTabContentProps {
  intro: string;
  sections: CareSection[];
}

export function CareTabContent({ intro, sections }: CareTabContentProps) {
  return (
    <div className="flex flex-col gap-10">
      <p className="text-[15px] leading-relaxed text-foreground-primary max-w-[720px]">
        {intro}
      </p>
      <div className="grid gap-10 md:grid-cols-3">
        {sections.map((s) => (
          <section key={s.title} className="flex flex-col gap-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary">
              {s.title}
            </h3>
            <p className="text-[14px] leading-relaxed text-foreground-primary">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
