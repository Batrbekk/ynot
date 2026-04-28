"use client";

import * as React from "react";
import {
  ProfileForm,
  type ProfileFormSubmit,
} from "@/components/account/profile-form";
import { useSessionUser } from "@/components/account/session-context";
import { authFetch } from "@/lib/auth-fetch";

export default function AccountProfilePage() {
  const user = useSessionUser();
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const firstName = user.name?.split(" ")[0] ?? "";

  const onSubmit = async (data: ProfileFormSubmit) => {
    setError(null);
    // Update name. (Email change + password change need their own forms /
    // verification flows; the existing ProfileForm bundles them but for Phase
    // 3 we only persist the name change.)
    try {
      const res = await authFetch("/api/auth/account/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: data.firstName }),
      });
      if (!res.ok) throw new Error("Could not save your changes.");
      if (data.newPassword) {
        const pwRes = await authFetch("/api/auth/account/password", {
          method: "PATCH",
          body: JSON.stringify({
            currentPassword: data.newPassword,
            newPassword: data.newPassword,
          }),
        });
        if (!pwRes.ok) {
          // Password change requires the current password — surface clearly.
          throw new Error(
            "Password change needs your current password — use the password reset flow.",
          );
        }
      }
      setSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ProfileForm
        defaults={{ firstName, email: user.email }}
        onSubmit={onSubmit}
      />
      {error && (
        <p className="text-[12px] uppercase tracking-[0.2em] text-foreground-warning">
          {error}
        </p>
      )}
      {savedAt && !error && (
        <p className="text-[12px] uppercase tracking-[0.2em] text-success">
          Saved at {savedAt.toLocaleTimeString("en-GB")}
        </p>
      )}
    </div>
  );
}
