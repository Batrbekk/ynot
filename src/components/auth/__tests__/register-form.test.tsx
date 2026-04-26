import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "../register-form";

describe("RegisterForm", () => {
  it("submits when all required fields + T&C checked", async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/first name/i), "Jane");
    await userEvent.type(screen.getByLabelText(/last name/i), "Doe");
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "hunter22");
    await userEvent.click(screen.getByLabelText(/terms & conditions/i));
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const args = onSubmit.mock.calls[0][0];
    expect(args.firstName).toBe("Jane");
    expect(args.email).toBe("jane@example.com");
    expect(args.acceptedTerms).toBe(true);
    expect(args.subscribeNewsletter).toBe(false);
  });

  it("does not submit when T&C not checked", async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/first name/i), "Jane");
    await userEvent.type(screen.getByLabelText(/last name/i), "Doe");
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "hunter22");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
