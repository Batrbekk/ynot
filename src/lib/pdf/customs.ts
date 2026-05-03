import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface CustomsAddress {
  /** Sender name — only present on the `from` address. */
  name?: string;
  line1: string;
  city: string;
  postcode: string;
  country: string;
}

export interface CustomsItem {
  name: string;
  quantity: number;
  valueCents: number;
  hsCode: string | null;
  countryOfOrigin: string | null;
  weightGrams: number;
}

export interface CustomsInput {
  returnNumber: string;
  orderNumber: string;
  fromAddress: CustomsAddress & { name: string };
  toAddress: CustomsAddress;
  items: CustomsItem[];
}

/**
 * Render a CN23-style customs declaration PDF for an international return.
 *
 * Output is a Buffer containing a single A4 page with sender + recipient
 * addresses, the return + original order references, and a per-item table
 * (description, qty, HS code, origin, value, weight).
 *
 * Used by Group K's `buildAndStoreCustomsDeclaration` (returns flow). Spec §7.3.
 */
export async function buildCustomsDeclaration(input: CustomsInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 in points
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const draw = (
    s: string,
    x: number,
    y: number,
    fnt: typeof font = font,
    size = 10,
  ): void => {
    page.drawText(s, { x, y, font: fnt, size, color: rgb(0, 0, 0) });
  };

  draw('CN23 — CUSTOMS DECLARATION', 40, 800, bold, 14);
  draw(
    `Return: ${input.returnNumber}    Original order: ${input.orderNumber}`,
    40,
    780,
  );

  draw('From (sender):', 40, 750, bold);
  draw(input.fromAddress.name, 40, 735);
  draw(input.fromAddress.line1, 40, 720);
  draw(`${input.fromAddress.city} ${input.fromAddress.postcode}`, 40, 705);
  draw(input.fromAddress.country, 40, 690);

  draw('To (recipient):', 320, 750, bold);
  draw('YNOT London (Returns)', 320, 735);
  draw(input.toAddress.line1, 320, 720);
  draw(`${input.toAddress.city} ${input.toAddress.postcode}`, 320, 705);
  draw(input.toAddress.country, 320, 690);

  draw(
    'Reason: RETURNED MERCHANDISE — ORIGINAL SALE INVOICE ATTACHED',
    40,
    660,
    bold,
  );

  // Table header
  let y = 620;
  draw('Description', 40, y, bold);
  draw('Qty', 280, y, bold);
  draw('HS code', 320, y, bold);
  draw('Origin', 400, y, bold);
  draw('Value (GBP)', 460, y, bold);
  draw('Weight (g)', 540, y, bold);
  y -= 16;

  for (const it of input.items) {
    draw(it.name.slice(0, 40), 40, y);
    draw(String(it.quantity), 280, y);
    draw(it.hsCode ?? '—', 320, y);
    draw(it.countryOfOrigin ?? '—', 400, y);
    draw((it.valueCents / 100).toFixed(2), 460, y);
    draw(String(it.weightGrams), 540, y);
    y -= 14;
  }

  draw('Signature: ____________________', 40, 100);
  draw(`Date: ${new Date().toISOString().slice(0, 10)}`, 40, 80);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
