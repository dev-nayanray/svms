import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EmployeeUniversitiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/universities");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const universities = await prisma.university.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: 50,
    include: { country: { select: { name: true, flag: true } } },
  });

  return (
    <div>
      <EmployeePageHeader
        title="Universities"
        description="European universities supported by Euroscope."
      />
      {universities.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No universities in the catalog yet. Run the seed to populate.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {universities.map((u) => (
            <Card key={u.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.country?.flag} {u.country?.name} · {u.city ?? "—"}
                    </p>
                  </div>
                  {u.ranking && <Badge tone="info">#{u.ranking}</Badge>}
                </div>
                {u.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{u.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
