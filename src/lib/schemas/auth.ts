import { z } from "zod";

const PasswordRule = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");

const EmailRule = z.email().transform((s) => s.toLowerCase().trim());

const CodeRule = z.string().regex(/^\d{6}$/, "Enter the 6-digit code.");

export const RegisterRequestSchema = z.object({
  email: EmailRule,
  password: PasswordRule,
  name: z.string().min(1).max(120).optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const VerifyEmailRequestSchema = z.object({
  email: EmailRule,
  code: CodeRule,
});
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

export const ResendVerifyRequestSchema = z.object({ email: EmailRule });
export type ResendVerifyRequest = z.infer<typeof ResendVerifyRequestSchema>;

export const SignInRequestSchema = z.object({
  email: EmailRule,
  password: z.string().min(1),
});
export type SignInRequest = z.infer<typeof SignInRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({ email: EmailRule });
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  email: EmailRule,
  code: CodeRule,
  newPassword: PasswordRule,
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const UpdateProfileRequestSchema = z.object({
  name: z.string().min(1).max(120),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: PasswordRule,
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const DeleteAccountRequestSchema = z.object({
  confirmEmail: EmailRule,
});
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;
