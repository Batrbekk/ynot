"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";

export interface ResetPasswordSubmit {
  code: string;
  password: string;
}

export interface ResetPasswordFormProps {
  onSubmit: (data: ResetPasswordSubmit) => Promise<void>;
}

export function ResetPasswordForm({ onSubmit }: ResetPasswordFormProps) {
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6 || !password || !confirm) return;
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ code, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="text-center">
        <h2 className="font-heading text-[20px] mb-4">Password updated</h2>
        <p className="text-[14px] text-foreground-secondary mb-6">
          Your password has been changed. You can now sign in with your new password.
        </p>
        <Link href="/sign-in">
          <Button size="lg" fullWidth>
            Sign in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Input
        label="6-digit code"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        required
      />
      <PasswordInput
        label="New password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <PasswordInput
        label="Confirm new password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={error ?? undefined}
        required
      />
      <Button type="submit" size="lg" fullWidth disabled={submitting}>
        {submitting ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
