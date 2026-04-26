"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export interface RegisterFormSubmit {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
  subscribeNewsletter: boolean;
}

export interface RegisterFormProps {
  onSubmit: (data: RegisterFormSubmit) => void;
}

export function RegisterForm({ onSubmit }: RegisterFormProps) {
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [subscribeNewsletter, setSubscribeNewsletter] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password || !acceptedTerms) return;
    onSubmit({
      firstName,
      lastName,
      email,
      password,
      acceptedTerms,
      subscribeNewsletter,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Input
          label="First name"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <Input
          label="Last name"
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
      </div>
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
        autoComplete="new-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Checkbox
        label="I agree to the Terms & Conditions and Privacy Policy"
        checked={acceptedTerms}
        onChange={(e) => setAcceptedTerms(e.target.checked)}
      />
      <Checkbox
        label="Subscribe to our newsletter for exclusive offers"
        checked={subscribeNewsletter}
        onChange={(e) => setSubscribeNewsletter(e.target.checked)}
      />
      <Button type="submit" size="lg" fullWidth>
        Create account
      </Button>
    </form>
  );
}
