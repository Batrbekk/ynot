import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Accordion } from "../accordion";

describe("Accordion", () => {
  it("expands and collapses on click", async () => {
    render(
      <Accordion
        items={[
          { value: "a", title: "Description", content: <p>desc body</p> },
          { value: "b", title: "Materials", content: <p>mat body</p> },
        ]}
      />,
    );
    expect(screen.queryByText("desc body")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Description" }));
    expect(screen.getByText("desc body")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Description" }));
    // motion's AnimatePresence keeps the element in the DOM during exit
    // animation; wait for it to fully unmount.
    await waitFor(() => expect(screen.queryByText("desc body")).toBeNull());
  });
});
