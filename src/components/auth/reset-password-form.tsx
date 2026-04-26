"use client";

import * as React from "react";
import Link from "next/link";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";

export interface ResetPasswordSubmit {
  token: string;
  password: string;
}

export interface ResetPasswordFormProps {
  token: string;
  onSubmit: (data: ResetPasswordSubmit) => void;
}

export function ResetPasswordForm({ token, onSubmit }: ResetPasswordFormProps) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirm) return;
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    onSubmit({ token, password });
    setDone(true);
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
      <Button type="submit" size="lg" fullWidth>
        Save
      </Button>
    </form>
  );
}
