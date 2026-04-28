"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface VerifyEmailFormProps {
  email: string;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
}

export function VerifyEmailForm({ email, onSubmit, onResend }: VerifyEmailFormProps) {
  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resendOk, setResendOk] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code.");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError(null);
    setResendOk(false);
    try {
      await onResend();
      setResendOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-[14px] text-foreground-secondary">
        We sent a 6-digit code to <strong>{email}</strong>. Enter it below to verify your account.
      </p>
      <Input
        autoFocus
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-label="Verification code"
      />
      {error && <p className="text-[13px] text-foreground-warning">{error}</p>}
      {resendOk && !error && (
        <p className="text-[13px] text-foreground-secondary">A new code has been sent.</p>
      )}
      <Button type="submit" size="lg" disabled={submitting || code.length !== 6}>
        {submitting ? "Verifying…" : "Verify email"}
      </Button>
      <button
        type="button"
        onClick={resend}
        className="mt-2 text-[13px] text-foreground-secondary underline underline-offset-4 hover:text-foreground-primary self-center"
      >
        Resend code
      </button>
    </form>
  );
}
