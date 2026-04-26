import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "../checkbox";

describe("Checkbox", () => {
  it("renders with label and toggles on click", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Accept terms" onChange={onChange} />);
    const cb = screen.getByRole("checkbox", { name: "Accept terms" });
    expect(cb).not.toBeChecked();
    await userEvent.click(cb);
    expect(onChange).toHaveBeenCalled();
  });
  it("respects disabled", async () => {
    render(<Checkbox label="x" disabled />);
    expect(screen.getByRole("checkbox", { name: "x" })).toBeDisabled();
  });
});
