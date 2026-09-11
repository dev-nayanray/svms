import { prisma } from "@/lib/db";

export const notifications = {
  async push(input: {
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
  }) {
    await prisma.notification.create({ data: input });
  },
};
