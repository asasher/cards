import { z } from "zod";

export const kvInputSchema = z.object({
  key: z.string().trim().min(1, "Key is required").max(64, "Key must be at most 64 characters"),
  value: z.string().trim().min(1, "Value is required").max(2000, "Value must be at most 2000 characters"),
});

export const kvUpdateSchema = z.object({
  key: z.string().trim().min(1),
  value: z.string().trim().min(1, "Value is required").max(2000, "Value must be at most 2000 characters"),
});

export type KvInput = z.infer<typeof kvInputSchema>;
export type KvUpdateInput = z.infer<typeof kvUpdateSchema>;

export interface KvItem {
  key: string;
  value: string;
  updatedAt: string;
}
