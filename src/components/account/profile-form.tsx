"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";

export interface ProfileFormSubmit {
  firstName: string;
  email: string;
  newPassword: string;
}

export interface ProfileFormProps {
  defaults: { firstName: string; email: string };
  onSubmit: (data: ProfileFormSubmit) => void;
}

export function ProfileForm({ defaults, onSubmit }: ProfileFormProps) {
  const [firstName, setFirstName] = React.useState(defaults.firstName);
  const [email, setEmail] = React.useState(defaults.email);
  const [newPassword, setNewPassword] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !email) return;
    onSubmit({ firstName, email, newPassword });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-[480px]">
      <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <PasswordInput label="New password (leave blank to keep current)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      <Button type="submit" size="lg">Save changes</Button>
    </form>
  );
}
