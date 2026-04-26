import { describe, it, expect, beforeEach } from "vitest";
import { useReturnsStubStore } from "../returns-stub-store";

beforeEach(() => {
  useReturnsStubStore.setState({ orderId: null, selectedItems: [], reason: "" });
});

describe("returns stub store", () => {
  it("starts empty", () => {
    expect(useReturnsStubStore.getState().orderId).toBeNull();
    expect(useReturnsStubStore.getState().selectedItems).toEqual([]);
  });

  it("setOrder stores id and resets selection", () => {
    useReturnsStubStore.setState({ selectedItems: ["x"] });
    useReturnsStubStore.getState().setOrder("YNT-2847");
    expect(useReturnsStubStore.getState().orderId).toBe("YNT-2847");
    expect(useReturnsStubStore.getState().selectedItems).toEqual([]);
  });

  it("toggleItem adds and removes", () => {
    useReturnsStubStore.getState().toggleItem("a");
    useReturnsStubStore.getState().toggleItem("b");
    expect(useReturnsStubStore.getState().selectedItems).toEqual(["a", "b"]);
    useReturnsStubStore.getState().toggleItem("a");
    expect(useReturnsStubStore.getState().selectedItems).toEqual(["b"]);
  });

  it("setReason updates the reason", () => {
    useReturnsStubStore.getState().setReason("doesn't fit");
    expect(useReturnsStubStore.getState().reason).toBe("doesn't fit");
  });

  it("reset clears everything", () => {
    useReturnsStubStore.getState().setOrder("X");
    useReturnsStubStore.getState().toggleItem("a");
    useReturnsStubStore.getState().setReason("x");
    useReturnsStubStore.getState().reset();
    expect(useReturnsStubStore.getState().orderId).toBeNull();
    expect(useReturnsStubStore.getState().selectedItems).toEqual([]);
    expect(useReturnsStubStore.getState().reason).toBe("");
  });
});
