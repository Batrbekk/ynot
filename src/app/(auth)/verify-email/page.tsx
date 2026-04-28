"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { authFetch } from "@/lib/auth-fetch";

function VerifyEmailPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const toast = useToast();

  const onSubmit = async (code: string) => {
    const res = await authFetch("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        body.error === "INVALID_CODE"
          ? "That code is incorrect. Try again."
          : "We could not verify the code right now.",
      );
    }
    toast.show("Email verified — please sign in.");
    router.push("/sign-in");
  };

  const onResend = async () => {
    const res = await authFetch("/api/auth/verify-email/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (body.error === "RATE_LIMIT") throw new Error("Please wait before requesting another code.");
      throw new Error("Could not resend the code.");
    }
  };

  if (!email) {
    return (
      <AuthCard
        title="Verify email"
        subtitle="Open this page from the email link or after registering."
        sideImage={{ src: "/cms/auth/sign-in.jpg", alt: "YNOT editorial" }}
      >
        <p className="text-[14px] text-foreground-secondary">No email provided.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verify email"
      subtitle="Enter the code we just sent."
      sideImage={{ src: "/cms/auth/sign-in.jpg", alt: "YNOT editorial" }}
    >
      <VerifyEmailForm email={email} onSubmit={onSubmit} onResend={onResend} />
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <ToastProvider>
      <React.Suspense fallback={null}>
        <VerifyEmailPageInner />
      </React.Suspense>
    </ToastProvider>
  );
}
