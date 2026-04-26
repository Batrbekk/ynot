import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "../skeleton";

describe("Skeleton", () => {
  it("renders a div with role=status by default", () => {
    const { container } = render(<Skeleton className="h-4 w-12" />);
    expect(container.firstChild).toHaveAttribute("role", "status");
  });
});
