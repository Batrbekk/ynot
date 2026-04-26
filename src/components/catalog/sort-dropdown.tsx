"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

const OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export function SortDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("sort") ?? "newest";

  const onChange = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "newest") next.delete("sort");
    else next.set("sort", value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="w-[220px]">
      <Select
        label="Sort"
        value={current}
        onChange={onChange}
        options={OPTIONS}
      />
    </div>
  );
}
