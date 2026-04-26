"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm, type SignInFormSubmit } from "@/components/auth/sign-in-form";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { useAuthStubStore } from "@/lib/stores/auth-stub-store";

function SignInPageInner() {
  const router = useRouter();
  const toast = useToast();
  const signIn = useAuthStubStore((s) => s.signIn);

  const handleSubmit = (data: SignInFormSubmit) => {
    const firstName = data.email.split("@")[0] ?? "Friend";
    signIn({ email: data.email, firstName });
    toast.show("Welcome back");
    router.push("/");
  };

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back to YNOT London."
      sideImage={{ src: "/cms/auth/sign-in.jpg", alt: "YNOT editorial" }}
      footer={
        <>
          New to YNOT?{" "}
          <Link
            href="/register"
            className="underline underline-offset-2 hover:text-foreground-primary"
          >
            Create an account
          </Link>
        </>
      }
    >
      <SignInForm onSubmit={handleSubmit} />
    </AuthCard>
  );
}

export default function SignInPage() {
  return (
    <ToastProvider>
      <SignInPageInner />
    </ToastProvider>
  );
}
