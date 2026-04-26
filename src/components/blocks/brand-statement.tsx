import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";

export interface BrandStatementProps {
  primary: string;
  secondary: string;
}

export function BrandStatement({ primary, secondary }: BrandStatementProps) {
  return (
    <Section background="cream" padding="lg">
      <div className="mx-auto w-full max-w-[800px] text-center px-6">
        <Display level="md" as="p" className="text-foreground-on-cream">
          {primary}
        </Display>
        <p className="mt-6 text-[12px] uppercase tracking-[0.3em] text-foreground-on-cream">
          {secondary}
        </p>
      </div>
    </Section>
  );
}
