import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInForm } from "../sign-in-form";

describe("SignInForm", () => {
  it("calls onSubmit with email + password + remember when filled and submitted", async () => {
    const onSubmit = vi.fn();
    render(<SignInForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "hunter2");
    await userEvent.click(screen.getByLabelText(/remember me/i));
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const args = onSubmit.mock.calls[0][0];
    expect(args.email).toBe("jane@example.com");
    expect(args.password).toBe("hunter2");
    expect(args.rememberMe).toBe(true);
  });

  it("does not submit when email is empty", async () => {
    const onSubmit = vi.fn();
    render(<SignInForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
