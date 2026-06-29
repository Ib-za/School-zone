import { z } from "zod";

export const notificationChannelSchema = z.enum(["push", "sms", "whatsapp", "email"]);

export const notificationJobSchema = z.object({
  schoolId: z.uuid(),
  channel: notificationChannelSchema,
  recipient: z.string().min(1),
  dedupeKey: z.string().min(1),
  payload: z.record(z.string(), z.unknown())
});

export type NotificationJob = z.infer<typeof notificationJobSchema>;

export function normalizeNotificationJob(input: NotificationJob) {
  return notificationJobSchema.parse(input);
}
