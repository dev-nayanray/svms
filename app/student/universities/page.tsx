import { StudentUniversitiesList } from "@/components/modules/student-universities-list";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Universities</h1>
        <p className="text-sm text-muted-foreground">
          Explore universities recommended by your counselor. Save your favorites or
          request counseling for any that catch your eye.
        </p>
      </header>
      <StudentUniversitiesList basePath="/student/universities" />
    </>
  );
}
