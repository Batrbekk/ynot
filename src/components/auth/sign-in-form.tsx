"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export interface SignInFormSubmit {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface SignInFormProps {
  onSubmit: (data: SignInFormSubmit) => void;
}

export function SignInForm({ onSubmit }: SignInFormProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    onSubmit({ email, password, rememberMe });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <PasswordInput
        label="Password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <div className="flex items-center justify-between">
        <Checkbox
          label="Remember me"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        />
        <Link
          href="/forgot-password"
          className="text-[12px] uppercase tracking-[0.15em] text-foreground-secondary hover:text-foreground-primary"
        >
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" fullWidth>
        Sign in
      </Button>
    </form>
  );
}
