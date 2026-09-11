import { StudentCoursesList } from "@/components/modules/student-courses-list";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Courses</h1>
        <p className="text-sm text-muted-foreground">
          Browse programs offered by partner universities. Filter by country, tuition,
          degree level, intake, or English-test requirement.
        </p>
      </header>
      <StudentCoursesList basePath="/student/courses" />
    </>
  );
}
