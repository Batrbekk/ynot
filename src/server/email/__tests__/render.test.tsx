import { describe, expect, it } from "vitest";
import { Heading } from "@react-email/components";
import { renderEmail } from "../render";

describe("renderEmail", () => {
  it("renders a JSX element to {html, text}", async () => {
    const r = await renderEmail(<Heading>Hello YNOT</Heading>);
    expect(r.html).toContain("Hello YNOT");
    // Plain-text conversion uppercases <h1> content via html-to-text.
    expect(r.text.toLowerCase()).toContain("hello ynot");
    expect(r.html).toContain("<h1");
  });
});
