import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/collection/jackets",
  useSearchParams: () => new URLSearchParams(),
}));

import { SortDropdown } from "../sort-dropdown";

describe("SortDropdown", () => {
  it("renders default Newest", () => {
    render(<SortDropdown />);
    expect(screen.getByLabelText(/sort/i)).toHaveValue("newest");
  });
  it("calls router.push when changed", async () => {
    pushMock.mockClear();
    render(<SortDropdown />);
    await userEvent.selectOptions(
      screen.getByLabelText(/sort/i),
      "price-asc",
    );
    expect(pushMock).toHaveBeenCalled();
    expect(pushMock.mock.calls[0][0]).toContain("sort=price-asc");
  });
});
