import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardInput, type CardValue } from "../card-input";

function Harness({ onChange }: { onChange: (v: CardValue) => void }) {
  const [v, setV] = React.useState<CardValue>({ number: "", expiry: "", cvc: "" });
  return (
    <CardInput
      value={v}
      onChange={(next) => {
        setV(next);
        onChange(next);
      }}
    />
  );
}

describe("CardInput (stub)", () => {
  it("emits structured value on change", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/card number/i), "4242424242424242");
    const last = onChange.mock.calls.at(-1)?.[0] as CardValue;
    expect(last.number).toBe("4242424242424242");
  });
});
