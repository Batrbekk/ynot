"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm, type RegisterFormSubmit } from "@/components/auth/register-form";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { useAuthStubStore } from "@/lib/stores/auth-stub-store";

function RegisterPageInner() {
  const router = useRouter();
  const toast = useToast();
  const signIn = useAuthStubStore((s) => s.signIn);

  const handleSubmit = (data: RegisterFormSubmit) => {
    signIn({ email: data.email, firstName: data.firstName });
    toast.show("Account created");
    router.push("/");
  };

  return (
    <AuthCard
      title="Create account"
      subtitle="Join YNOT London for early access and members-only releases."
      sideImage={{ src: "/cms/auth/register.jpg", alt: "YNOT editorial" }}
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="underline underline-offset-2 hover:text-foreground-primary"
          >
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm onSubmit={handleSubmit} />
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <ToastProvider>
      <RegisterPageInner />
    </ToastProvider>
  );
}
