import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioGroup } from "../radio-group";

describe("RadioGroup", () => {
  it("calls onChange with selected value", async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        name="ship"
        value="rm"
        onChange={onChange}
        options={[
          { value: "rm", label: "Royal Mail" },
          { value: "dhl", label: "DHL" },
        ]}
      />,
    );
    await userEvent.click(screen.getByLabelText("DHL"));
    expect(onChange).toHaveBeenCalledWith("dhl");
  });
});
