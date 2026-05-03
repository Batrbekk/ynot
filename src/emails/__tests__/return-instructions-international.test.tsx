import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { ReturnInstructionsInternational } from "../return-instructions-international";

describe("ReturnInstructionsInternational", () => {
  it("renders address and customs declaration text", async () => {
    const html = await render(
      <ReturnInstructionsInternational
        returnNumber="RT-2026-00010"
        customerName="Aigerim"
        orderNumber="YN-2026-00050"
        items={[{ name: "Trench", qty: 1 }]}
        returnAddress={{
          line1: "13 Elvaston Place, Flat 1",
          city: "London",
          postcode: "SW7 5QG",
          country: "United Kingdom",
        }}
        shipByDate="2026-05-20"
      />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("RT-2026-00010");
    expect(html).toContain("YN-2026-00050");
    expect(html).toContain("customs declaration");
    expect(html).toContain("13 Elvaston Place");
    expect(html).toContain("United Kingdom");
    expect(html).toContain("returned merchandise");
  });
});
