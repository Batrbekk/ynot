import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { Text } from "@react-email/components";
import { EmailLayout } from "../_layout";

describe("EmailLayout", () => {
  it("renders children inside YNOT brand chrome", async () => {
    const html = await render(
      <EmailLayout previewText="Test">
        <Text>Body</Text>
      </EmailLayout>,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("YNOT London");
    expect(html).toContain("Body");
  });
});
