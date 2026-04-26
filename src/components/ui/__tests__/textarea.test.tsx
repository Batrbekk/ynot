import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "../textarea";

describe("Textarea", () => {
  it("renders with label and accepts input", async () => {
    const onChange = vi.fn();
    render(<Textarea label="Reason" onChange={onChange} />);
    const ta = screen.getByLabelText("Reason");
    await userEvent.type(ta, "Hello");
    expect(onChange).toHaveBeenCalled();
    expect((ta as HTMLTextAreaElement).value).toBe("Hello");
  });
});
