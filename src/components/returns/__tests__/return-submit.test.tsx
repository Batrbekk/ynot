import * as React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ReturnSubmit } from "../return-submit";

const fetchMock = vi.fn();

beforeEach(() => {
  pushMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReturnSubmit", () => {
  const baseProps = {
    orderId: "ord_cuid_1",
    orderNumber: "YN-2026-00042",
    items: [{ orderItemId: "oi_1", quantity: 1 }],
    reason: "Doesn't fit",
    reasonCategory: "DOES_NOT_FIT" as const,
  };

  it("posts to /api/returns and redirects to the success page on 201", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ returnId: "ret_1", returnNumber: "RTN-2026-00042" }),
    });
    render(<ReturnSubmit {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: /submit return/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/returns");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      orderId: "ord_cuid_1",
      items: [{ orderItemId: "oi_1", quantity: 1 }],
      reason: "Doesn't fit",
      reasonCategory: "DOES_NOT_FIT",
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/initiate-return/success?id=RTN-2026-00042",
      );
    });
  });

  it("renders an inline error and does not redirect on non-2xx", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "CONFLICT", message: "Outside the window" }),
    });
    render(<ReturnSubmit {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: /submit return/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Outside the window/);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("renders a generic error when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    render(<ReturnSubmit {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: /submit return/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/network down/);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("disables the submit button when there are no items", () => {
    render(<ReturnSubmit {...baseProps} items={[]} />);
    expect(screen.getByRole("button", { name: /submit return/i })).toBeDisabled();
  });
});
