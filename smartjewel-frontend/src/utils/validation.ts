import { z } from 'zod';

// Shared regex for password strength: min 6, at least one uppercase, one lowercase, one number
export const passwordStrength = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number');

export const emailField = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address');

export const nameField = z
  .string()
  .min(1, 'Name is required')
  .min(3, 'Name must be at least 3 characters')
  .max(80, 'Name is too long')
  .regex(/^[a-zA-Z\s]+$/, 'Full name can only contain letters and spaces');

export const phoneField = z
  .string()
  .min(1, 'Phone number is required')
  .regex(/^[0-9\s\-+()]+$/, 'Phone number can only contain digits, spaces, hyphens, and parentheses')
  .refine((value) => value.replace(/\D/g, '').length >= 10, 'Phone number must contain at least 10 digits');

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const registrationSchema = z
  .object({
    name: nameField,
    email: emailField,
    phone: phoneField,
    password: passwordStrength,
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegistrationFormValues = z.infer<typeof registrationSchema>;
