import { z } from "zod";

export const retrievalRequestSchema = z.object({
  schoolId: z.uuid(),
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).default(5)
});

export type RetrievalRequest = z.infer<typeof retrievalRequestSchema>;

export async function retrieveSchoolContext(input: RetrievalRequest) {
  const request = retrievalRequestSchema.parse(input);

  return {
    schoolId: request.schoolId,
    query: request.query,
    matches: [] as Array<{ id: string; score: number; content: string }>
  };
}
