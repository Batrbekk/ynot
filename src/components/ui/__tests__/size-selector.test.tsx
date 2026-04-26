import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SizeSelector } from "../size-selector";

describe("SizeSelector", () => {
  it("highlights selected and fires onChange", async () => {
    const onChange = vi.fn();
    render(
      <SizeSelector
        sizes={["S", "M", "L"]}
        value="M"
        onChange={onChange}
        stock={{ S: 0, M: 3, L: 1 }}
      />,
    );
    expect(screen.getByRole("button", { name: /size m, selected/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /size l/i }));
    expect(onChange).toHaveBeenCalledWith("L");
  });

  it("disables out-of-stock when allowSoldOut is false", () => {
    render(
      <SizeSelector
        sizes={["S", "M", "L"]}
        value="M"
        onChange={() => {}}
        stock={{ S: 0, M: 3, L: 1 }}
      />,
    );
    expect(screen.getByRole("button", { name: /size s/i })).toBeDisabled();
  });
});
