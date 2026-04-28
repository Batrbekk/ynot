"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import {
  ResetPasswordForm,
  type ResetPasswordSubmit,
} from "@/components/auth/reset-password-form";
import { authFetch } from "@/lib/auth-fetch";

function ResetPasswordPageInner() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const handleSubmit = async (data: ResetPasswordSubmit) => {
    const res = await authFetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        email,
        code: data.code,
        newPassword: data.password,
      }),
    });
    if (res.status === 401) {
      throw new Error("That code is incorrect or expired.");
    }
    if (!res.ok) {
      throw new Error("We could not reset your password right now.");
    }
  };

  if (!email) {
    return (
      <AuthCard
        title="Reset password"
        subtitle="Open this page from the forgot-password flow."
      >
        <div className="text-center text-[14px] text-foreground-secondary">
          Start over from the{" "}
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
      title="Set a new password"
      subtitle={`Enter the 6-digit code we sent to ${email} and choose a new password.`}
      sideImage={{ src: "/cms/auth/sign-in.jpg", alt: "YNOT editorial" }}
    >
      <ResetPasswordForm onSubmit={handleSubmit} />
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
