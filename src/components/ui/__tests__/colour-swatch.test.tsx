import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColourSwatch } from "../colour-swatch";

describe("ColourSwatch", () => {
  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<ColourSwatch name="Chocolate Brown" hex="#3D3428" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: /chocolate brown/i }));
    expect(onClick).toHaveBeenCalled();
  });
});
