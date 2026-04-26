"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface ForgotPasswordFormProps {
  onSubmit: (email: string) => void;
}

export function ForgotPasswordForm({ onSubmit }: ForgotPasswordFormProps) {
  const [email, setEmail] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    onSubmit(email);
    setSubmitted(true);
  };

  const handleResend = () => {
    onSubmit(email);
  };

  if (submitted) {
    return (
      <div className="text-center">
        <h2 className="font-heading text-[20px] mb-4">Check your email</h2>
        <p className="text-[14px] text-foreground-secondary mb-6">
          If an account exists for <strong>{email}</strong>, you&rsquo;ll receive a
          password reset link shortly.
        </p>
        <p className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary">
          Didn&rsquo;t receive the email?{" "}
          <button
            type="button"
            onClick={handleResend}
            className="underline hover:text-foreground-primary"
          >
            Resend
          </button>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Input
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="email@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Button type="submit" size="lg" fullWidth>
        Send reset link
      </Button>
      <Link
        href="/sign-in"
        className="text-center text-[12px] uppercase tracking-[0.15em] text-foreground-secondary hover:text-foreground-primary"
      >
        Back to sign in
      </Link>
    </form>
  );
}
