import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma BEFORE importing the module under test, so the
// notification service's prisma.notification.create + prisma.student.findFirst
// don't try to hit a real database.
const mockNotificationCreate = vi.fn();
const mockStudentFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      create: (args: unknown) => mockNotificationCreate(args),
    },
    student: {
      findFirst: (args: unknown) => mockStudentFindFirst(args),
    },
  },
}));

// Import after mocks are set up
import { studentEventBus, publishStudentEvent } from "@/lib/realtime/event-bus";
import { notifications } from "@/lib/services/notification";

describe("realtime event bus", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Remove all listeners between tests so counts don't accumulate
    studentEventBus.removeAllListeners();
    mockNotificationCreate.mockResolvedValue({
      id: "notif-1",
      type: "NEW_MESSAGE",
      title: "Test",
      message: "Hello",
      link: null,
      createdAt: new Date(),
    });
    mockStudentFindFirst.mockResolvedValue({ id: "stu-1" });
  });

  it("publish and subscribe deliver events to the right student", () => {
    const events: unknown[] = [];
    const unsubscribe = studentEventBus.subscribe("stu-1", (event) => {
      events.push(event);
    });

    publishStudentEvent("stu-1", "message_received", { conversationId: "c1" });
    publishStudentEvent("stu-2", "message_received", { conversationId: "c2" });
    publishStudentEvent("stu-1", "notification_created", { type: "NEW_MESSAGE" });

    expect(events).toHaveLength(2);
    expect((events[0] as { type: string }).type).toBe("message_received");
    expect((events[1] as { type: string }).type).toBe("notification_created");

    unsubscribe();
  });

  it("unsubscribe stops further events", () => {
    const events: unknown[] = [];
    const unsubscribe = studentEventBus.subscribe("stu-1", (event) => {
      events.push(event);
    });

    publishStudentEvent("stu-1", "message_received", {});
    expect(events).toHaveLength(1);

    unsubscribe();
    publishStudentEvent("stu-1", "message_received", {});
    expect(events).toHaveLength(1); // still 1, not 2
  });

  it("notifications.push publishes notification_created event for student users", async () => {
    const events: unknown[] = [];
    studentEventBus.subscribe("stu-1", (event) => {
      events.push(event);
    });

    await notifications.push({
      userId: "user-1",
      type: "NEW_MESSAGE",
      title: "New message",
      message: "Hello from counselor",
    });

    // Should have created the notification row
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          type: "NEW_MESSAGE",
          title: "New message",
        }),
      })
    );

    // Should have resolved the studentId
    expect(mockStudentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      })
    );

    // Should have published the event to the bus
    expect(events).toHaveLength(1);
    const event = events[0] as { type: string; studentId: string; payload: { type: string } };
    expect(event.type).toBe("notification_created");
    expect(event.studentId).toBe("stu-1");
    expect(event.payload.type).toBe("NEW_MESSAGE");
  });

  it("notifications.push skips publishing for non-student users", async () => {
    // Simulate an employee notification — no student row found
    mockStudentFindFirst.mockResolvedValue(null);

    const events: unknown[] = [];
    studentEventBus.subscribe("stu-1", (event) => {
      events.push(event);
    });

    await notifications.push({
      userId: "employee-user",
      type: "TASK_ASSIGNED",
      title: "Task assigned",
      message: "You have a new task",
    });

    // Still creates the notification row
    expect(mockNotificationCreate).toHaveBeenCalled();
    // But does NOT publish an event (no student SSE channel)
    expect(events).toHaveLength(0);
  });
});
