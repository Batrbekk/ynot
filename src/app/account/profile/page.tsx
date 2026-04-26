"use client";

import * as React from "react";
import {
  ProfileForm,
  type ProfileFormSubmit,
} from "@/components/account/profile-form";
import { useAuthStubStore } from "@/lib/stores/auth-stub-store";

export default function AccountProfilePage() {
  const user = useAuthStubStore((s) => s.user);
  const signIn = useAuthStubStore((s) => s.signIn);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  if (!user) return null;

  const onSubmit = (data: ProfileFormSubmit) => {
    // Stub: real backend persists later. For now, refresh in-memory user.
    signIn({ email: data.email, firstName: data.firstName });
    setSavedAt(new Date());
  };

  return (
    <div className="flex flex-col gap-6">
      <ProfileForm
        defaults={{ firstName: user.firstName, email: user.email }}
        onSubmit={onSubmit}
      />
      {savedAt && (
        <p className="text-[12px] uppercase tracking-[0.2em] text-success">
          Saved at {savedAt.toLocaleTimeString("en-GB")}
        </p>
      )}
    </div>
  );
}
