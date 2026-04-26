import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetPasswordForm } from "../reset-password-form";

describe("ResetPasswordForm", () => {
  it("calls onSubmit when both passwords match", async () => {
    const onSubmit = vi.fn();
    render(<ResetPasswordForm token="abc" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/^new password$/i), "newpass1");
    await userEvent.type(screen.getByLabelText(/confirm/i), "newpass1");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSubmit).toHaveBeenCalledWith({ token: "abc", password: "newpass1" });
    expect(screen.getByText(/password updated/i)).toBeInTheDocument();
  });

  it("shows mismatch error when passwords differ", async () => {
    const onSubmit = vi.fn();
    render(<ResetPasswordForm token="abc" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/^new password$/i), "newpass1");
    await userEvent.type(screen.getByLabelText(/confirm/i), "different");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });
});
