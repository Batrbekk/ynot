import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentForm } from "../payment-form";

describe("PaymentForm", () => {
  it("calls onPay when card fields are filled", async () => {
    const onPay = vi.fn();
    render(<PaymentForm totalLabel="£500" onPay={onPay} />);
    await userEvent.type(screen.getByLabelText(/card number/i), "4242424242424242");
    await userEvent.type(screen.getByLabelText(/expiry date/i), "12 / 30");
    await userEvent.type(screen.getByLabelText(/cvc/i), "123");
    await userEvent.type(screen.getByLabelText(/name on card/i), "Jane Doe");
    await userEvent.click(screen.getByRole("button", { name: /pay £500/i }));
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it("does not call onPay when card number is empty", async () => {
    const onPay = vi.fn();
    render(<PaymentForm totalLabel="£500" onPay={onPay} />);
    await userEvent.click(screen.getByRole("button", { name: /pay £500/i }));
    expect(onPay).not.toHaveBeenCalled();
  });
});
