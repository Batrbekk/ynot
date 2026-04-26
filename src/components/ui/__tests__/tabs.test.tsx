import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "../tabs";

describe("Tabs", () => {
  it("renders the active tab content and switches on click", async () => {
    render(
      <Tabs
        defaultValue="a"
        items={[
          { value: "a", label: "First", content: <p>panel A</p> },
          { value: "b", label: "Second", content: <p>panel B</p> },
        ]}
      />,
    );
    expect(screen.getByText("panel A")).toBeInTheDocument();
    expect(screen.queryByText("panel B")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Second" }));
    expect(screen.getByText("panel B")).toBeInTheDocument();
  });
});
