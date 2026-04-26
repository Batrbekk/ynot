import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuantityStepper } from "../quantity-stepper";

describe("QuantityStepper", () => {
  it("renders value and increments / decrements", async () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={2} onChange={onChange} min={1} max={5} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /increase/i }));
    expect(onChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole("button", { name: /decrease/i }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("disables decrease at min", () => {
    render(<QuantityStepper value={1} onChange={() => {}} min={1} max={5} />);
    expect(screen.getByRole("button", { name: /decrease/i })).toBeDisabled();
  });

  it("disables increase at max", () => {
    render(<QuantityStepper value={5} onChange={() => {}} min={1} max={5} />);
    expect(screen.getByRole("button", { name: /increase/i })).toBeDisabled();
  });
});
