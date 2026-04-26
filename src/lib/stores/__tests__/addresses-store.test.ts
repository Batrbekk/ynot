import { describe, it, expect, beforeEach } from "vitest";
import { useAddressesStore } from "../addresses-store";
import type { Address } from "@/lib/schemas";

const baseAddress: Address = {
  firstName: "Jane",
  lastName: "Doe",
  line1: "42 King's Road",
  line2: null,
  city: "London",
  postcode: "SW3 4ND",
  country: "GB",
  phone: "+44 7700 900123",
};

beforeEach(() => {
  useAddressesStore.setState({ addresses: [] });
});

describe("addresses store", () => {
  it("starts empty until hydrate is called", () => {
    expect(useAddressesStore.getState().addresses).toEqual([]);
  });

  it("hydrate seeds the store but does not overwrite if already populated", () => {
    useAddressesStore.getState().hydrate([{ id: "x", label: "x", isDefault: true, address: baseAddress }]);
    expect(useAddressesStore.getState().addresses.length).toBe(1);
    useAddressesStore.getState().hydrate([{ id: "y", label: "y", isDefault: false, address: baseAddress }]);
    // Already populated -> hydrate is a no-op
    expect(useAddressesStore.getState().addresses[0].id).toBe("x");
  });

  it("addAddress appends with a generated id", () => {
    useAddressesStore.getState().addAddress({ label: "Mum", address: baseAddress });
    const list = useAddressesStore.getState().addresses;
    expect(list.length).toBe(1);
    expect(list[0].id).toMatch(/^addr_/);
    expect(list[0].label).toBe("Mum");
  });

  it("updateAddress mutates by id", () => {
    useAddressesStore.getState().addAddress({ label: "Home", address: baseAddress });
    const id = useAddressesStore.getState().addresses[0].id;
    useAddressesStore.getState().updateAddress(id, { label: "Home (renamed)" });
    expect(useAddressesStore.getState().addresses[0].label).toBe("Home (renamed)");
  });

  it("deleteAddress removes by id", () => {
    useAddressesStore.getState().addAddress({ label: "x", address: baseAddress });
    const id = useAddressesStore.getState().addresses[0].id;
    useAddressesStore.getState().deleteAddress(id);
    expect(useAddressesStore.getState().addresses.length).toBe(0);
  });

  it("setDefault flips the default flag exclusively", () => {
    useAddressesStore.getState().addAddress({ label: "A", address: baseAddress, isDefault: true });
    useAddressesStore.getState().addAddress({ label: "B", address: baseAddress });
    const idB = useAddressesStore.getState().addresses[1].id;
    useAddressesStore.getState().setDefault(idB);
    const list = useAddressesStore.getState().addresses;
    expect(list.find((a) => a.id === idB)?.isDefault).toBe(true);
    expect(list.filter((a) => a.isDefault).length).toBe(1);
  });
});
