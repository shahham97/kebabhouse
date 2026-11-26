import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().min(1).optional(),
  APP_SECRET: z.string().min(16).default('star-kebab-dev-secret-change-in-prod'),
  ENCRYPTION_KEY: z.string().min(32).default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  STORE_TIMEZONE: z.string().default('Australia/Sydney'),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  ABLY_API_KEY: z.string().optional().default(''),
  UPSTASH_REDIS_REST_URL: z.string().optional().default(''),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(''),
  INTERNAL_JOB_SECRET: z.string().optional().default('star-kebab-job-secret-dev'),
});

export const env = envSchema.parse(process.env);
