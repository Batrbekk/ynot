import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UI Kit · YNOT London",
};

export default function UIKitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
