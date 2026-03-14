import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password")
});

export const registerSchema = z
  .object({
    confirm_password: z.string(),
    email: z.string().email(),
    full_name: z.string().min(2),
    password: z
      .string()
      .min(8)
      .regex(/\d/, "Must contain at least one number")
  })
  .refine((value) => value.password === value.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"]
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address")
});

export const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit verification code.")
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type CodeValues = z.infer<typeof codeSchema>;
