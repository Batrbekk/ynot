import Link from "next/link";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Display, Eyebrow } from "@/components/ui/typography";

export default function Home() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />

      <main className="flex-1">
        <Container size="narrow" className="py-24 md:py-32">
          <Eyebrow>Work in progress</Eyebrow>
          <Display level="lg" as="h1" className="mt-4">
            YNOT London — frontend rebuild
          </Display>
          <p className="mt-6 max-w-prose text-[15px] leading-relaxed text-foreground-secondary">
            Design tokens, fonts and the first set of UI primitives are wired
            up. Continue to the UI kit page to review every component before we
            assemble the homepage and product flows.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/ui-kit">
              <Button>Open UI kit</Button>
            </Link>
            <Button variant="outline">Pencil design reference</Button>
          </div>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
