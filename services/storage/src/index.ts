import { z } from "zod";

export const imageUploadSchema = z.object({
  schoolId: z.uuid(),
  fileName: z.string().min(1),
  contentType: z.string().min(1)
});

export type ImageUpload = z.infer<typeof imageUploadSchema>;

export function createImageUploadDescriptor(input: ImageUpload) {
  return imageUploadSchema.parse(input);
}
