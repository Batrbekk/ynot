import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { ReturnInstructionsUk } from "../return-instructions-uk";

describe("ReturnInstructionsUk", () => {
  it("renders return number, items, and ship-by date", async () => {
    const html = await render(
      <ReturnInstructionsUk
        returnNumber="RT-2026-00007"
        customerName="Anna"
        orderNumber="YN-2026-00042"
        items={[{ name: "Coat", qty: 1 }]}
        shipByDate="2026-05-15"
      />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("RT-2026-00007");
    expect(html).toContain("YN-2026-00042");
    expect(html).toContain("2026-05-15");
    expect(html).toContain("Coat");
    expect(html).toContain("post office");
  });
});
