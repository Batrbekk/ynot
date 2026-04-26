import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordForm } from "../forgot-password-form";

describe("ForgotPasswordForm", () => {
  it("calls onSubmit with email and switches to sent-state", async () => {
    const onSubmit = vi.fn();
    render(<ForgotPasswordForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(onSubmit).toHaveBeenCalledWith("jane@example.com");
    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
  });

  it("Resend link in sent-state re-fires onSubmit", async () => {
    const onSubmit = vi.fn();
    render(<ForgotPasswordForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await userEvent.click(screen.getByRole("button", { name: /resend/i }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
