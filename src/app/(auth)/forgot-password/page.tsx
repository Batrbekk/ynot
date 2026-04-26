"use client";

import * as React from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  const handleSubmit = (email: string) => {
    // Stub: real submission wired in when NextAuth lands
    if (typeof window !== "undefined") {
      console.info("[auth-stub] password reset requested for", email);
    }
  };

  return (
    <AuthCard
      title="Forgot password"
      subtitle="Enter the email associated with your account and we'll send you a reset link."
    >
      <ForgotPasswordForm onSubmit={handleSubmit} />
    </AuthCard>
  );
}
