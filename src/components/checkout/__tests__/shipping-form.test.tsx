import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShippingForm } from "../shipping-form";

describe("ShippingForm", () => {
  it("submits collected address + method when all fields valid", async () => {
    const onSubmit = vi.fn();
    render(<ShippingForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/first name/i), "Jane");
    await userEvent.type(screen.getByLabelText(/last name/i), "Doe");
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.type(screen.getByLabelText(/phone/i), "7700900123");
    await userEvent.type(screen.getByLabelText(/street address/i), "42 King's Road");
    await userEvent.type(screen.getByLabelText(/city/i), "London");
    await userEvent.type(screen.getByLabelText(/postcode/i), "SW3 4ND");
    // country defaults to GB; carrier defaults to royal-mail

    await userEvent.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const args = onSubmit.mock.calls[0][0];
    expect(args.address.firstName).toBe("Jane");
    expect(args.address.line1).toBe("42 King's Road");
    expect(args.method).toBe("royal-mail");
  });

  it("does not submit when required fields are missing", async () => {
    const onSubmit = vi.fn();
    render(<ShippingForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /continue to payment/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
