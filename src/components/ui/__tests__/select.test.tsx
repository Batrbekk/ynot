import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "../select";

describe("Select", () => {
  it("renders options and fires onChange", async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Country"
        value="GB"
        onChange={onChange}
        options={[
          { value: "GB", label: "United Kingdom" },
          { value: "US", label: "United States" },
        ]}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Country"),
      "US",
    );
    expect(onChange).toHaveBeenCalledWith("US");
  });
});
