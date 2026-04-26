"use client";

import * as React from "react";
import type { SavedAddress } from "@/lib/data/addresses";
import { Button } from "@/components/ui/button";

export interface AddressCardProps {
  saved: SavedAddress;
  onEdit: (saved: SavedAddress) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export function AddressCard({ saved, onEdit, onDelete, onSetDefault }: AddressCardProps) {
  const a = saved.address;
  return (
    <article className="border border-border-light p-5 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-primary">
          {saved.label}
        </h3>
        {saved.isDefault && (
          <span className="text-[11px] uppercase tracking-[0.15em] text-accent-warm">
            Default
          </span>
        )}
      </header>
      <p className="text-[13px] leading-relaxed text-foreground-primary">
        {a.firstName} {a.lastName}<br />
        {a.line1}<br />
        {a.line2 && (<>{a.line2}<br /></>)}
        {a.city}, {a.postcode}<br />
        {a.country}
      </p>
      <div className="flex flex-wrap gap-3 mt-auto">
        <Button variant="outline" size="sm" onClick={() => onEdit(saved)}>Edit</Button>
        {!saved.isDefault && (
          <Button variant="ghost" size="sm" onClick={() => onSetDefault(saved.id)}>Set default</Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onDelete(saved.id)}>Delete</Button>
      </div>
    </article>
  );
}
