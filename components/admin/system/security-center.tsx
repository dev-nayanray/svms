"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, LoadingState } from "@/components/shared/page-kit";
import { SectionCard, StatusBadge } from "./shared";
import { ShieldCheck, Lock, KeyRound, Cookie, Activity, FileText } from "lucide-react";

type SecurityReport = {
  audit: {
    checks: Array<{
      id: string;
      category: string;
      name: string;
      status: "PASS" | "WARN" | "FAIL" | "INFO";
      detail: string;
      recommendation?: string;
    }>;
    summary: { pass: number; warn: number; fail: number; info: number };
    generatedAt: string;
  };
  rbac: {
    roles: string[];
    permissions: Array<{ key: string; allowed: Record<string, boolean> }>;
  };
};

export function SecurityCenter() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["/api/admin/system/security"],
    queryFn: () => apiFetch<SecurityReport>("/api/admin/system/security"),
    staleTime: 60 * 1000,
  });

  if (isPending) return <LoadingState label="Running security audit…" />;
  if (isError || !data) {
    return <p className="text-destructive">Failed to load security audit.</p>;
  }

  const { audit, rbac } = data;

  // Group checks by category
  const grouped = audit.checks.reduce<Record<string, typeof audit.checks>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Center"
        description="Audit of authentication, RBAC, security headers, rate limiting, and audit logging."
        breadcrumbs={["Admin", "System Administration", "Security"]}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard label="Passing" value={audit.summary.pass} icon={ShieldCheck} tone="success" />
        <SummaryCard label="Warnings" value={audit.summary.warn} icon={Activity} tone="warning" />
        <SummaryCard label="Failing" value={audit.summary.fail} icon={Lock} tone="destructive" />
        <SummaryCard label="Info" value={audit.summary.info} icon={FileText} tone="info" />
      </div>

      {Object.entries(grouped).map(([category, checks]) => (
        <SectionCard
          key={category}
          title={category}
          description={`${checks.filter((c) => c.status === "PASS").length}/${checks.length} checks passing`}
        >
          <div className="space-y-2">
            {checks.map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-md border border-border bg-background/50 p-3">
                <StatusBadge status={c.status as "PASS" | "WARN" | "FAIL" | "INFO"} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.detail}</p>
                  {c.recommendation && (
                    <p className="mt-1 text-xs text-warning">→ {c.recommendation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ))}

      {/* RBAC matrix */}
      <SectionCard
        title="RBAC Permission Matrix"
        description="Role-based access control matrix — server-side enforced at every API route."
        actions={<KeyRound className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left font-medium">Permission</th>
                {rbac.roles.map((r) => (
                  <th key={r} className="p-2 text-center font-medium">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rbac.permissions.map((p) => (
                <tr key={p.key} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-2 font-mono">{p.key}</td>
                  {rbac.roles.map((r) => (
                    <td key={r} className="p-2 text-center">
                      {p.allowed[r] ? (
                        <span className="text-success">✓</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Cookie & Session Security"
        description="NextAuth v5 JWT strategy with periodic revalidation."
        actions={<Cookie className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="space-y-2 text-sm">
          <Row label="Session strategy" value="JWT (stateless, serverless-friendly)" />
          <Row label="Session expiry" value="8 hours" />
          <Row label="Token revalidation" value="Every 5 minutes (detects suspension/deletion mid-session)" />
          <Row label="Cookie httpOnly" value="true (default in NextAuth v5)" />
          <Row label="Cookie sameSite" value="lax (CSRF protection)" />
          <Row label="Cookie secure" value="auto (requires HTTPS in production)" />
          <Row label="Password hashing" value="bcrypt (bcryptjs ^3.0.3)" />
        </div>
      </SectionCard>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "warning" | "destructive" | "info";
}) {
  const tones = {
    success: "border-success/30 bg-success/5 text-success",
    warning: "border-warning/30 bg-warning/5 text-warning",
    destructive: "border-destructive/30 bg-destructive/5 text-destructive",
    info: "border-info/30 bg-info/5 text-info",
  };
  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
