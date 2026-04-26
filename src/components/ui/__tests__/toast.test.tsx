import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "../toast";

function Trigger() {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show("Saved!")}>
      Save
    </button>
  );
}

describe("Toast", () => {
  it("shows a toast when show() is called", async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved!")).toBeInTheDocument();
  });
});
