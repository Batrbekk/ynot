import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Drawer } from "../drawer";

describe("Drawer", () => {
  it("renders content when open and not when closed", () => {
    const { rerender } = render(
      <Drawer open={false} onClose={() => {}} side="right" title="Cart">
        <p>Items here</p>
      </Drawer>,
    );
    expect(screen.queryByText("Items here")).toBeNull();

    rerender(
      <Drawer open onClose={() => {}} side="right" title="Cart">
        <p>Items here</p>
      </Drawer>,
    );
    expect(screen.getByText("Items here")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} side="right" title="Cart">
        <p>x</p>
      </Drawer>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop clicked", async () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} side="right" title="Cart">
        <p>x</p>
      </Drawer>,
    );
    await userEvent.click(screen.getByTestId("drawer-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape pressed", async () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} side="right" title="Cart">
        <p>x</p>
      </Drawer>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
