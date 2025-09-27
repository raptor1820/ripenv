import { z } from "zod";

export const magicLinkSchema = z.object({
    email: z.string().email("Enter a valid email"),
});

export const projectSchema = z.object({
    name: z.string().min(2, "Project name must be at least 2 characters"),
});

export const memberSchema = z.object({
    email: z.string().email("Enter a valid email"),
});

export const passwordSchema = z.object({
    password: z.string().min(8, "Password must be at least 8 characters"),
});
