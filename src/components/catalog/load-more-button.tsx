"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface LoadMoreButtonProps {
  visible: number;
  total: number;
  step?: number;
}

export function LoadMoreButton({
  visible,
  total,
  step = 8,
}: LoadMoreButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (visible >= total) return null;

  const next = () => {
    const ns = new URLSearchParams(params);
    ns.set("limit", String(visible + step));
    router.push(`${pathname}?${ns.toString()}`);
  };

  return (
    <div className="mt-10 flex justify-center">
      <Button variant="outline" onClick={next}>
        Load more
      </Button>
    </div>
  );
}
