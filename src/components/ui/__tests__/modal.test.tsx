import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "../modal";

describe("Modal", () => {
  it("shows when open and dismisses on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Confirm">
        <p>Are you sure?</p>
      </Modal>,
    );
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
