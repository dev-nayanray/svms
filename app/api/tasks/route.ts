import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { taskSchema, paginationSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";
import { notifications } from "@/lib/services/notification";

export async function GET(req: NextRequest) {
  try {
    const g = await guard("tasks.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      status: sp.get("status") ?? undefined,
      search: sp.get("search") ?? undefined,
    });
    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(g.user.role === "EMPLOYEE" ? { assignedToId: g.user.id } : {}),
      ...(params.search ? { title: { contains: params.search, mode: "insensitive" as const } } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: { student: true, application: true },
        orderBy: sortFrom(sp, ["title", "status", "dueDate", "priority", "createdAt"], { dueDate: "asc" }),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.task.count({ where }),
    ]);
    return ok({
      data,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / params.pageSize), 1),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard("tasks.manage");
    if (g.error) return g.error;
    const body = taskSchema.parse(await req.json());
    const task = await prisma.task.create({
      data: { ...body, createdById: g.user.id },
    });
    await notifications.push({
      userId: body.assignedToId,
      type: "TASK_ASSIGNED",
      title: "New task assigned",
      message: body.title,
    });
    await auditLog.record({
      userId: g.user.id,
      action: "task.created",
      entity: "Task",
      entityId: task.id,
    });
    return ok(task, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
