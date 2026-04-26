"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import {
  ResetPasswordForm,
  type ResetPasswordSubmit,
} from "@/components/auth/reset-password-form";

function ResetPasswordPageInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const handleSubmit = (data: ResetPasswordSubmit) => {
    // Stub: real submission wired in when NextAuth lands
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.info("[auth-stub] reset password with token", data.token);
    }
  };

  if (!token) {
    return (
      <AuthCard
        title="Reset password"
        subtitle="This reset link is missing or invalid."
      >
        <div className="text-center text-[14px] text-foreground-secondary">
          Please request a new link from the{" "}
          <Link
            href="/forgot-password"
            className="underline underline-offset-2 hover:text-foreground-primary"
          >
            forgot password
          </Link>{" "}
          page.
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset password"
      subtitle="Choose a new password to secure your account."
    >
      <ResetPasswordForm token={token} onSubmit={handleSubmit} />
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <AuthCard title="Reset password">
          <div className="h-24" />
        </AuthCard>
      }
    >
      <ResetPasswordPageInner />
    </React.Suspense>
  );
}
