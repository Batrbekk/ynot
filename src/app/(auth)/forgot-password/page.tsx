"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { authFetch } from "@/lib/auth-fetch";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const handleSubmit = async (email: string) => {
    // The API returns 200 even for unknown emails (anti-enumeration).
    await authFetch("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    // Push to /reset-password so the user can paste the code from their inbox.
    router.push(`/reset-password?email=${encodeURIComponent(email)}`);
  };

  return (
    <AuthCard
      title="Forgot password"
      subtitle="Enter the email associated with your account and we'll send you a 6-digit reset code."
      sideImage={{ src: "/cms/auth/sign-in.jpg", alt: "YNOT editorial" }}
    >
      <ForgotPasswordForm onSubmit={handleSubmit} />
    </AuthCard>
  );
}
