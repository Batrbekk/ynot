import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { SiteOverlays } from "@/components/site-overlays";
import { getAllCategories } from "@/lib/data/categories";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "YNOT London",
  description:
    "Urban outerwear, built to endure. Designed to be relied on. Premium women's outerwear from London.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const categories = await getAllCategories();
  const menuCategories = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
  }));

  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-surface-primary text-foreground-primary font-body">
        {children}
        <SiteOverlays categories={menuCategories} />
      </body>
    </html>
  );
}
