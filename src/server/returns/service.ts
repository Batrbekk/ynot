import * as React from 'react';
import type { Prisma, Return, ReturnReason } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { sendTemplatedEmail } from '@/server/email/send';
import { getEmailService } from '@/server/email';
import type { EmailService } from '@/server/email';
import type { LabelStorage } from '@/server/fulfilment/label-storage';
import type { RoyalMailClickDropProvider } from '@/server/shipping/royal-mail-click-drop';
import { ReturnInstructionsUk } from '@/emails/return-instructions-uk';
import { ReturnInstructionsInternational } from '@/emails/return-instructions-international';
import { isWithinReturnWindow, returnLabelPolicy } from './policy';
import { nextReturnNumber } from './return-number';
import { buildAndStoreCustomsDeclaration, RETURN_ADDRESS } from './customs';

const SHIP_BY_DAYS = 14;

const DEFAULT_ITEM_WEIGHT_GRAMS = 500;

export interface CreateReturnInput {
  orderId: string;
  items: Array<{ orderItemId: string; quantity: number }>;
  reasonCategory: ReturnReason;
  reason: string;
}

export interface CreateReturnDeps {
  rm: Pick<RoyalMailClickDropProvider, 'createReturnLabel'>;
  storage: LabelStorage;
  emailService?: EmailService;
}

const PENDING_RETURN_STATUSES = [
  'REQUESTED',
  'AWAITING_PARCEL',
  'RECEIVED',
] as const;

/**
 * Customer-initiated return entrypoint.
 *
 * 1. Validates the 14-day window + that every requested item belongs to the
 *    Order with sufficient remaining quantity (no overlap with pending
 *    Returns).
 * 2. Inserts `Return` + `ReturnItem` rows in a single transaction.
 * 3. Outside the tx, branches on country:
 *    - UK → calls `RoyalMailClickDropProvider.createReturnLabel`, stores the
 *      PDF, persists `returnLabelKey`, sends `ReturnInstructionsUk` with the
 *      label as an attachment.
 *    - Non-UK → renders + stores a CN23 customs PDF, sends
 *      `ReturnInstructionsInternational` with the customs PDF attached.
 *
 * The DB-then-IO split mirrors `checkout/service.ts::createOrderAndPaymentIntent`
 * — outbound carrier / email failures don't roll back the Return row, so a
 * later admin retry can re-issue paperwork without losing customer intent.
 */
export async function createReturn(
  input: CreateReturnInput,
  deps: CreateReturnDeps,
): Promise<Return> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      items: true,
      shipments: true,
      user: true,
      returns: {
        where: { status: { in: [...PENDING_RETURN_STATUSES] } },
        include: { items: true },
      },
    },
  });
  if (!order) throw new Error(`Order ${input.orderId} not found`);
  if (!isWithinReturnWindow(order)) {
    throw new Error('Order is outside the 14-day return window');
  }
  if (input.items.length === 0) {
    throw new Error('A return must include at least one item');
  }

  // Build a "remaining returnable qty" map: ordered qty minus qty locked in
  // any pending (REQUESTED / AWAITING_PARCEL / RECEIVED) Return.
  const remaining = new Map<string, number>();
  for (const oi of order.items) {
    remaining.set(oi.id, oi.quantity);
  }
  for (const r of order.returns) {
    for (const ri of r.items) {
      const cur = remaining.get(ri.orderItemId) ?? 0;
      remaining.set(ri.orderItemId, cur - ri.quantity);
    }
  }

  for (const it of input.items) {
    const oi = order.items.find((o) => o.id === it.orderItemId);
    if (!oi) {
      throw new Error(
        `OrderItem ${it.orderItemId} does not belong to order ${order.id}`,
      );
    }
    if (it.quantity < 1) {
      throw new Error(`Quantity must be at least 1 for ${it.orderItemId}`);
    }
    const left = remaining.get(it.orderItemId) ?? 0;
    if (it.quantity > left) {
      throw new Error(
        `Quantity ${it.quantity} for ${it.orderItemId} exceeds remaining returnable (${left})`,
      );
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const returnNumber = await nextReturnNumber(tx);
    return tx.return.create({
      data: {
        orderId: order.id,
        returnNumber,
        reason: input.reason,
        reasonCategory: input.reasonCategory,
        status: 'AWAITING_PARCEL',
        items: {
          create: input.items.map((i) => ({
            orderItemId: i.orderItemId,
            quantity: i.quantity,
          })),
        },
      },
      include: { items: { include: { orderItem: true } } },
    });
  });

  const policy = returnLabelPolicy(order);
  const recipientEmail = order.user?.email ?? null;
  const emailService = deps.emailService ?? getEmailService();
  const shipBy = new Date(Date.now() + SHIP_BY_DAYS * 86400000)
    .toDateString();
  const itemSummaries = created.items.map((ri) => ({
    name: ri.orderItem.productName,
    qty: ri.quantity,
  }));

  if (policy === 'PREPAID_UK') {
    const label = await deps.rm.createReturnLabel(
      buildReturnCarrierInput(order, created),
    );
    const labelKey = await deps.storage.put(
      `return-${created.id}-label`,
      label.labelPdfBytes,
    );
    await prisma.return.update({
      where: { id: created.id },
      data: { returnLabelKey: labelKey },
    });
    if (recipientEmail) {
      await sendTemplatedEmail({
        service: emailService,
        to: recipientEmail,
        subject: `Return ${created.returnNumber} — your prepaid label`,
        component: React.createElement(ReturnInstructionsUk, {
          returnNumber: created.returnNumber,
          customerName: order.shipFirstName,
          orderNumber: order.orderNumber,
          items: itemSummaries,
          shipByDate: shipBy,
        }),
        attachments: [
          {
            filename: `return-label-${created.returnNumber}.pdf`,
            content: label.labelPdfBytes,
            contentType: 'application/pdf',
          },
        ],
      });
    }
  } else {
    const customsKey = await buildAndStoreCustomsDeclaration(created.id, deps);
    const customsBytes = await deps.storage.get(customsKey);
    if (recipientEmail) {
      await sendTemplatedEmail({
        service: emailService,
        to: recipientEmail,
        subject: `Return ${created.returnNumber} — instructions`,
        component: React.createElement(ReturnInstructionsInternational, {
          returnNumber: created.returnNumber,
          customerName: order.shipFirstName,
          orderNumber: order.orderNumber,
          items: itemSummaries,
          returnAddress: {
            line1: RETURN_ADDRESS.line1,
            city: RETURN_ADDRESS.city,
            postcode: RETURN_ADDRESS.postcode,
            country: RETURN_ADDRESS.country,
          },
          shipByDate: shipBy,
        }),
        attachments: [
          {
            filename: `customs-${created.returnNumber}.pdf`,
            content: customsBytes,
            contentType: 'application/pdf',
          },
        ],
      });
    }
  }

  // Re-read so the caller sees the latest returnLabelKey / customsPdfKey.
  return prisma.return.findUniqueOrThrow({ where: { id: created.id } });
}

type OrderWithBits = Prisma.OrderGetPayload<{
  include: { items: true; shipments: true; user: true };
}>;

type ReturnWithItems = Prisma.ReturnGetPayload<{
  include: { items: { include: { orderItem: true } } };
}>;

function buildReturnCarrierInput(
  order: OrderWithBits,
  ret: ReturnWithItems,
) {
  const itemRows = ret.items.map((ri) => {
    const oi = ri.orderItem;
    return {
      productSlug: oi.productSlug,
      name: oi.productName,
      sku: oi.productSlug,
      quantity: ri.quantity,
      unitPriceCents: oi.unitPriceCents,
      weightGrams: DEFAULT_ITEM_WEIGHT_GRAMS,
      hsCode: null as string | null,
      countryOfOriginCode: null as string | null,
    };
  });
  const subtotalCents = itemRows.reduce(
    (s, i) => s + i.unitPriceCents * i.quantity,
    0,
  );
  const weightGrams = itemRows.reduce(
    (s, i) => s + i.weightGrams * i.quantity,
    0,
  );
  return {
    orderRef: ret.returnNumber,
    recipient: {
      fullName: `${order.shipFirstName} ${order.shipLastName}`.trim(),
      addressLine1: order.shipLine1,
      ...(order.shipLine2 ? { addressLine2: order.shipLine2 } : {}),
      city: order.shipCity,
      postalCode: order.shipPostcode,
      countryCode: order.shipCountry,
      phone: order.shipPhone,
    },
    items: itemRows,
    weightGrams,
    subtotalCents,
    declaredValueCents: subtotalCents,
    isInternational: false,
  };
}
