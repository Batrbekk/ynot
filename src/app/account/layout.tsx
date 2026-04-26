"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { AccountLayout } from "@/components/account/account-layout";
import { useAuthStubStore } from "@/lib/stores/auth-stub-store";

export default function AccountLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStubStore((s) => s.isAuthenticated());

  React.useEffect(() => {
    if (!isAuthenticated) {
      const next = encodeURIComponent(pathname);
      router.replace(`/sign-in?next=${next}`);
    }
  }, [isAuthenticated, pathname, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <Section padding="md">
          <Container size="wide">
            <AccountLayout>{children}</AccountLayout>
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget
        phone="+44 7000 000000"
        message="Hi YNOT, I have a question about my account."
      />
    </>
  );
}
