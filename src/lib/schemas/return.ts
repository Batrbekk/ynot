import { z } from 'zod';

export const ReturnReasonSchema = z.enum([
  'DOES_NOT_FIT',
  'NOT_AS_DESCRIBED',
  'CHANGED_MIND',
  'DEFECTIVE',
  'ARRIVED_DAMAGED',
  'WRONG_ITEM',
  'OTHER',
]);
export type ReturnReasonT = z.infer<typeof ReturnReasonSchema>;

export const ReturnItemInputSchema = z.object({
  orderItemId: z.string().min(1),
  quantity: z.number().int().min(1),
});
export type ReturnItemInputT = z.infer<typeof ReturnItemInputSchema>;

/** Customer-facing POST /api/returns body. */
export const CreateReturnRequestSchema = z.object({
  orderId: z.string().min(1),
  items: z.array(ReturnItemInputSchema).min(1),
  reasonCategory: ReturnReasonSchema,
  reason: z.string().min(1).max(2000),
});
export type CreateReturnRequestT = z.infer<typeof CreateReturnRequestSchema>;

/** Admin approve body for /api/admin/returns/:id/approve (Group P). */
export const ApproveReturnRequestSchema = z.object({
  acceptedItemIds: z.array(z.string().min(1)).min(1),
  inspectionNotes: z.string().max(4000).optional(),
});
export type ApproveReturnRequestT = z.infer<typeof ApproveReturnRequestSchema>;

/** Admin reject body for /api/admin/returns/:id/reject (Group P). */
export const RejectReturnRequestSchema = z.object({
  rejectionReason: z.string().min(1).max(2000),
  inspectionNotes: z.string().min(1).max(4000),
});
export type RejectReturnRequestT = z.infer<typeof RejectReturnRequestSchema>;
