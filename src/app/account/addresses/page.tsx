"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AddressCard } from "@/components/account/address-card";
import { AddressFormModal } from "@/components/account/address-form-modal";
import { useAddressesStore } from "@/lib/stores/addresses-store";
import type { SavedAddress } from "@/lib/schemas/saved-address";
import type { Address } from "@/lib/schemas";

const SEED: SavedAddress[] = [
  {
    id: "addr_001",
    label: "Home",
    isDefault: true,
    address: {
      firstName: "Jane",
      lastName: "Doe",
      line1: "42 King's Road",
      line2: null,
      city: "London",
      postcode: "SW3 4ND",
      country: "GB",
      phone: "+44 7700 900123",
    },
  },
  {
    id: "addr_002",
    label: "Work",
    isDefault: false,
    address: {
      firstName: "Jane",
      lastName: "Doe",
      line1: "15 Portobello Road",
      line2: null,
      city: "London",
      postcode: "W11 3DA",
      country: "GB",
      phone: "+44 7700 900123",
    },
  },
];

export default function AccountAddressesPage() {
  const addresses = useAddressesStore((s) => s.addresses);
  const hydrate = useAddressesStore((s) => s.hydrate);
  const addAddress = useAddressesStore((s) => s.addAddress);
  const updateAddress = useAddressesStore((s) => s.updateAddress);
  const deleteAddress = useAddressesStore((s) => s.deleteAddress);
  const setDefault = useAddressesStore((s) => s.setDefault);

  const [editing, setEditing] = React.useState<SavedAddress | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    hydrate(SEED);
  }, [hydrate]);

  const onSubmit = (data: { label: string; address: Address }) => {
    if (editing) {
      updateAddress(editing.id, data);
    } else {
      addAddress(data);
    }
    setEditing(null);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Add address
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {addresses.map((a) => (
          <AddressCard
            key={a.id}
            saved={a}
            onEdit={(s) => {
              setEditing(s);
              setOpen(true);
            }}
            onDelete={deleteAddress}
            onSetDefault={setDefault}
          />
        ))}
      </div>

      <AddressFormModal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        onSubmit={onSubmit}
        initial={editing ?? undefined}
      />
    </div>
  );
}
