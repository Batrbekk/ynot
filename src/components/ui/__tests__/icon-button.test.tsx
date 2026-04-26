import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "../icon-button";

describe("IconButton", () => {
  it("renders with accessible name and fires onClick", async () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Open menu" onClick={onClick}>
        <span aria-hidden>≡</span>
      </IconButton>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(onClick).toHaveBeenCalled();
  });
});
