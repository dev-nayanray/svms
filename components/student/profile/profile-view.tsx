"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  IdCard,
  MapPin,
  Phone,
  RefreshCw,
  ShieldAlert,
  Siren,
  User,
  WifiOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button, Badge, Input, Select } from "@/components/ui";
import { MobilePage, MobileCard, LoadingCards } from "@/components/student/ui";
import { ProfileSheet, Field } from "./profile-sheet";
import { ProfilePhoto, ProfileAvatar } from "./profile-photo";
import { AcademicRecordsSection } from "./academic-records";
import { EnglishProficiencySection } from "./english-proficiency";
import { studentProfilePatchSchema, type StudentProfilePatch } from "@/lib/validations";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

type AcademicRecord = {
  id: string;
  level: string;
  institution: string;
  group?: string | null;
  subject?: string | null;
  result?: string | null;
  passingYear?: number | null;
};

type EnglishProficiency = {
  id: string;
  testType: string;
  overallScore?: number | null;
  readingScore?: number | null;
  writingScore?: number | null;
  listeningScore?: number | null;
  speakingScore?: number | null;
  testDate?: string | null;
  expiryDate?: string | null;
};

type ProfileView = {
  id: string;
  studentId: string;
  // personal
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  profilePhotoUrl?: string | null;
  // contact
  email: string;
  phone?: string | null;
  whatsapp?: string | null;
  alternativePhone?: string | null;
  // address
  country?: string | null;
  division?: string | null;
  district?: string | null;
  city?: string | null;
  address?: string | null;
  postalCode?: string | null;
  // passport
  passportNumber?: string | null;
  passportNumberMasked?: string;
  passportIssueDate?: string | null;
  passportExpiryDate?: string | null;
  passportIssuingCountry?: string | null;
  // emergency
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  // relational
  academicRecords: AcademicRecord[];
  englishProficiencies: EnglishProficiency[];
  // meta
  completion: {
    percent: number;
    total: number;
    filled: number;
    missing: { section: string; sectionKey: string; path: string; label: string }[];
    bySection: { key: string; label: string; percent: number; total: number; filled: number }[];
  };
};

type SectionKey =
  | "personal"
  | "contact"
  | "address"
  | "passport"
  | "emergency";

export function ProfileView() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);

  const { data: profile, isLoading, isError, error, refetch, isFetching } = useQuery<ProfileView>({
    queryKey: ["student-profile"],
    queryFn: () => apiFetch<ProfileView>("/api/student/profile"),
    retry: false,
    staleTime: 30_000,
  });

  const online = useOnlineStatus();

  async function handlePatch(patch: Partial<StudentProfilePatch>) {
    const updated = await apiFetch<ProfileView>("/api/student/profile", {
      method: "PATCH",
      json: patch,
    });
    qc.setQueryData<ProfileView>(["student-profile"], updated);
    return updated;
  }

  function handlePhotoChange(view: unknown) {
    qc.setQueryData<ProfileView>(["student-profile"], view as ProfileView);
  }

  function handleRefresh() {
    refetch();
    toast({ title: "Refreshing…" });
  }

  // Loading state — show skeleton cards.
  if (isLoading && !profile) {
    return (
      <MobilePage>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
        <LoadingCards count={6} />
      </MobilePage>
    );
  }

  // Error state — server error OR offline.
  if (isError && !profile) {
    return (
      <MobilePage>
        <MobileCard className="py-8 text-center">
          {!online ? (
            <WifiOff className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          ) : (
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
          )}
          <h2 className="mt-3 text-base font-semibold">
            {!online ? "You're offline" : "Couldn't load your profile"}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {!online
              ? "Check your connection and try again."
              : error instanceof Error
                ? error.message
                : "Please try again in a moment."}
          </p>
          <Button onClick={handleRefresh} className="mt-4" disabled={!online}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Retry
          </Button>
        </MobileCard>
      </MobilePage>
    );
  }

  if (!profile) return null;

  const fullName = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim();
  const completion = profile.completion;
  const incomplete = completion.percent < 100;

  return (
    <MobilePage>
      {/* Hero header */}
      <MobileCard className="space-y-4">
        <div className="flex items-start gap-3">
          <ProfileAvatar photoUrl={profile.profilePhotoUrl} name={fullName} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">{fullName || "Student"}</h1>
            <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">ID: {profile.studentId}</p>
          </div>
        </div>

        {/* Completion indicator */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {incomplete ? (
                <ShieldAlert className="h-4 w-4 text-warning" aria-hidden />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
              )}
              <span className="text-sm font-medium">Profile Completion</span>
            </div>
            <Badge tone={incomplete ? "warning" : "success"}>{completion.percent}%</Badge>
          </div>
          <div
            role="progressbar"
            aria-valuenow={completion.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion"
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] motion-reduce:transition-none",
                incomplete ? "bg-warning" : "bg-success"
              )}
              style={{ width: `${completion.percent}%` }}
            />
          </div>
          {incomplete && completion.missing.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-muted-foreground">Missing:</p>
              <div className="flex flex-wrap gap-1.5">
                {completion.missing.slice(0, 4).map((m) => (
                  <span
                    key={`${m.sectionKey}-${m.path}`}
                    className="rounded-md bg-warning/10 px-1.5 py-0.5 text-[11px] text-warning"
                  >
                    {m.label}
                  </span>
                ))}
                {completion.missing.length > 4 && (
                  <span className="text-[11px] text-muted-foreground">
                    +{completion.missing.length - 4} more
                  </span>
                )}
              </div>
              <Button
                size="sm"
                className="mt-2 w-full"
                onClick={() => {
                  // Jump to the first section that's missing a field.
                  const firstSection = completion.missing[0]?.sectionKey as SectionKey | undefined;
                  if (firstSection) setOpenSection(firstSection);
                  else setOpenSection("personal");
                }}
              >
                Complete Profile
              </Button>
            </div>
          )}
        </div>
      </MobileCard>

      {/* Section cards */}
      <PersonalSection
        profile={profile}
        open={openSection === "personal"}
        onOpenChange={(v) => setOpenSection(v ? "personal" : null)}
        onSave={handlePatch}
      />
      <ContactSection
        profile={profile}
        open={openSection === "contact"}
        onOpenChange={(v) => setOpenSection(v ? "contact" : null)}
        onSave={handlePatch}
      />
      <AddressSection
        profile={profile}
        open={openSection === "address"}
        onOpenChange={(v) => setOpenSection(v ? "address" : null)}
        onSave={handlePatch}
      />
      <PassportSection
        profile={profile}
        open={openSection === "passport"}
        onOpenChange={(v) => setOpenSection(v ? "passport" : null)}
        onSave={handlePatch}
      />
      <AcademicRecordsSection profile={profile} />
      <EnglishProficiencySection profile={profile} />
      <EmergencySection
        profile={profile}
        open={openSection === "emergency"}
        onOpenChange={(v) => setOpenSection(v ? "emergency" : null)}
        onSave={handlePatch}
      />

      {/* Photo editor as a separate card so it's prominent */}
      <MobileCard className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">Profile Photo</h2>
        </div>
        <ProfilePhoto
          photoUrl={profile.profilePhotoUrl}
          firstName={profile.firstName}
          onChange={handlePhotoChange}
        />
      </MobileCard>

      {/* Refresh + offline indicator */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>
          {isFetching ? "Refreshing…" : `Last updated ${new Date().toLocaleTimeString()}`}
        </span>
        {!online && (
          <span className="flex items-center gap-1 text-warning">
            <WifiOff className="h-3 w-3" aria-hidden /> Offline
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={isFetching}>
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} aria-hidden />
        </Button>
      </div>

      {openSection && (
        <SectionSheetHost
          section={openSection}
          onClose={() => setOpenSection(null)}
        />
      )}
    </MobilePage>
  );
}

/**
 * Single sheet host. React Hook Form's <form> must be inside the
 * sheet (not the section card) so submit doesn't navigate the page.
 */
function SectionSheetHost({ section, onClose }: { section: SectionKey; onClose: () => void }) {
  // This is a placeholder; the actual sheets are inside each section
  // component. We keep this component for potential future use.
  void section;
  void onClose;
  return null;
}

// ── Personal Section ──────────────────────────────────────────────

function PersonalSection({
  profile,
  open,
  onOpenChange,
  onSave,
}: {
  profile: ProfileView;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: Partial<StudentProfilePatch>) => Promise<ProfileView>;
}) {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(studentProfilePatchSchema as never) as never,
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
      gender: (profile.gender as "MALE" | "FEMALE" | "OTHER" | null) ?? null,
      nationality: profile.nationality ?? "",
    },
  });

  // The form is reset in the onEdit handler before opening the sheet, so
  // the latest server data is always used. No effect needed here.

  async function handleSave() {
    const valid = await form.trigger();
    if (!valid) return;
    const values = form.getValues();
    const patch: Partial<StudentProfilePatch> = {
      firstName: values.firstName,
      lastName: values.lastName,
      dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth as string) : null,
      gender: (values.gender || null) as StudentProfilePatch["gender"],
      nationality: values.nationality || null,
    };
    setSaving(true);
    try {
      await onSave(patch);
      toast({ title: "Saved", variant: "success" });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileCard className="space-y-2">
      <SectionHeader
        icon={<User className="h-4 w-4 text-primary" aria-hidden />}
        title="Personal Information"
        onEdit={() => {
          form.reset({
            firstName: profile.firstName,
            lastName: profile.lastName,
            dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
            gender: (profile.gender as "MALE" | "FEMALE" | "OTHER" | null) ?? null,
            nationality: profile.nationality ?? "",
          });
          onOpenChange(true);
        }}
      />
      <FieldList
        rows={[
          { label: "Full Name", value: `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() },
          { label: "Date of Birth", value: fmtDate(profile.dateOfBirth) },
          { label: "Gender", value: profile.gender ?? null },
          { label: "Nationality", value: profile.nationality ?? null },
        ]}
      />
      <ProfileSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Edit Personal Information"
        description="Your basic identity details."
        onSave={handleSave}
        saving={saving}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" required error={form.formState.errors.firstName?.message as string}>
              <Input {...form.register("firstName")} autoComplete="given-name" />
            </Field>
            <Field label="Last Name" required error={form.formState.errors.lastName?.message as string}>
              <Input {...form.register("lastName")} autoComplete="family-name" />
            </Field>
          </div>
          <Field label="Date of Birth">
            <Input type="date" {...form.register("dateOfBirth")} />
          </Field>
          <Field label="Gender">
            <Select {...form.register("gender")} aria-label="Gender">
              <option value="">Not specified</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
          <Field label="Nationality">
            <Input {...form.register("nationality")} autoComplete="country-name" placeholder="Bangladeshi" />
          </Field>
        </div>
      </ProfileSheet>
    </MobileCard>
  );
}

// ── Contact Section ──────────────────────────────────────────────

function ContactSection({
  profile,
  open,
  onOpenChange,
  onSave,
}: {
  profile: ProfileView;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: Partial<StudentProfilePatch>) => Promise<ProfileView>;
}) {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(studentProfilePatchSchema as never) as never,
    defaultValues: {
      phone: profile.phone ?? "",
      whatsapp: profile.whatsapp ?? "",
      alternativePhone: profile.alternativePhone ?? "",
    },
  });

  async function handleSave() {
    const valid = await form.trigger();
    if (!valid) return;
    const v = form.getValues();
    const patch: Partial<StudentProfilePatch> = {
      phone: v.phone || null,
      whatsapp: v.whatsapp || null,
      alternativePhone: v.alternativePhone || null,
    };
    setSaving(true);
    try {
      await onSave(patch);
      toast({
        title: "Contact saved",
        description: "Critical contact changes are audited.",
        variant: "success",
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileCard className="space-y-2">
      <SectionHeader
        icon={<Phone className="h-4 w-4 text-primary" aria-hidden />}
        title="Contact Information"
        onEdit={() => {
          form.reset({
            phone: profile.phone ?? "",
            whatsapp: profile.whatsapp ?? "",
            alternativePhone: profile.alternativePhone ?? "",
          });
          onOpenChange(true);
        }}
      />
      <FieldList
        rows={[
          { label: "Email", value: profile.email, hint: "Email changes require verification." },
          { label: "Phone", value: profile.phone ?? null },
          { label: "WhatsApp", value: profile.whatsapp ?? null },
          { label: "Alternative Phone", value: profile.alternativePhone ?? null },
        ]}
      />
      <ProfileSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Edit Contact Information"
        description="Phone, WhatsApp, and alternative phone are audited on change."
        onSave={handleSave}
        saving={saving}
      >
        <div className="space-y-4">
          <Field label="Email" hint="Email changes go through a verified flow — not here.">
            <Input value={profile.email} disabled readOnly />
          </Field>
          <Field label="Phone" error={form.formState.errors.phone?.message as string}>
            <Input {...form.register("phone")} type="tel" autoComplete="tel" placeholder="+8801XXXXXXXXX" />
          </Field>
          <Field label="WhatsApp" error={form.formState.errors.whatsapp?.message as string}>
            <Input {...form.register("whatsapp")} type="tel" autoComplete="tel" placeholder="+8801XXXXXXXXX" />
          </Field>
          <Field label="Alternative Phone" error={form.formState.errors.alternativePhone?.message as string}>
            <Input {...form.register("alternativePhone")} type="tel" autoComplete="tel" placeholder="Optional" />
          </Field>
        </div>
      </ProfileSheet>
    </MobileCard>
  );
}

// ── Address Section ──────────────────────────────────────────────

function AddressSection({
  profile,
  open,
  onOpenChange,
  onSave,
}: {
  profile: ProfileView;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: Partial<StudentProfilePatch>) => Promise<ProfileView>;
}) {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(studentProfilePatchSchema as never) as never,
    defaultValues: {
      country: profile.country ?? "",
      division: profile.division ?? "",
      district: profile.district ?? "",
      city: profile.city ?? "",
      address: profile.address ?? "",
      postalCode: profile.postalCode ?? "",
    },
  });

  async function handleSave() {
    const valid = await form.trigger();
    if (!valid) return;
    const v = form.getValues();
    const patch: Partial<StudentProfilePatch> = {
      country: v.country || null,
      division: v.division || null,
      district: v.district || null,
      city: v.city || null,
      address: v.address || null,
      postalCode: v.postalCode || null,
    };
    setSaving(true);
    try {
      await onSave(patch);
      toast({ title: "Address saved", variant: "success" });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileCard className="space-y-2">
      <SectionHeader
        icon={<MapPin className="h-4 w-4 text-primary" aria-hidden />}
        title="Address"
        onEdit={() => {
          form.reset({
            country: profile.country ?? "",
            division: profile.division ?? "",
            district: profile.district ?? "",
            city: profile.city ?? "",
            address: profile.address ?? "",
            postalCode: profile.postalCode ?? "",
          });
          onOpenChange(true);
        }}
      />
      <FieldList
        rows={[
          { label: "Country", value: profile.country ?? null },
          { label: "Division / State", value: profile.division ?? null },
          { label: "District", value: profile.district ?? null },
          { label: "City", value: profile.city ?? null },
          { label: "Address", value: profile.address ?? null },
          { label: "Postal Code", value: profile.postalCode ?? null },
        ]}
      />
      <ProfileSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Edit Address"
        description="Your residential address."
        onSave={handleSave}
        saving={saving}
      >
        <div className="space-y-4">
          <Field label="Country" error={form.formState.errors.country?.message as string}>
            <Input {...form.register("country")} autoComplete="country-name" placeholder="Bangladesh" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Division / State">
              <Input {...form.register("division")} placeholder="Dhaka" />
            </Field>
            <Field label="District">
              <Input {...form.register("district")} placeholder="Dhaka" />
            </Field>
          </div>
          <Field label="City" error={form.formState.errors.city?.message as string}>
            <Input {...form.register("city")} autoComplete="address-level2" placeholder="Dhaka" />
          </Field>
          <Field label="Address" error={form.formState.errors.address?.message as string}>
            <Input {...form.register("address")} autoComplete="street-address" placeholder="House, road, area" />
          </Field>
          <Field label="Postal Code">
            <Input {...form.register("postalCode")} autoComplete="postal-code" placeholder="1207" inputMode="numeric" />
          </Field>
        </div>
      </ProfileSheet>
    </MobileCard>
  );
}

// ── Passport Section ─────────────────────────────────────────────

function PassportSection({
  profile,
  open,
  onOpenChange,
  onSave,
}: {
  profile: ProfileView;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: Partial<StudentProfilePatch>) => Promise<ProfileView>;
}) {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(studentProfilePatchSchema as never) as never,
    defaultValues: {
      passportNumber: profile.passportNumber ?? "",
      passportIssueDate: profile.passportIssueDate ? profile.passportIssueDate.slice(0, 10) : "",
      passportExpiryDate: profile.passportExpiryDate ? profile.passportExpiryDate.slice(0, 10) : "",
      passportIssuingCountry: profile.passportIssuingCountry ?? "",
    },
  });

  async function handleSave() {
    const valid = await form.trigger();
    if (!valid) return;
    const v = form.getValues();
    const patch: Partial<StudentProfilePatch> = {
      passportNumber: v.passportNumber || null,
      passportIssueDate: v.passportIssueDate ? new Date(v.passportIssueDate as string) : null,
      passportExpiryDate: v.passportExpiryDate ? new Date(v.passportExpiryDate as string) : null,
      passportIssuingCountry: v.passportIssuingCountry || null,
    };
    setSaving(true);
    try {
      await onSave(patch);
      toast({ title: "Passport saved", variant: "success" });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileCard className="space-y-2">
      <SectionHeader
        icon={<IdCard className="h-4 w-4 text-primary" aria-hidden />}
        title="Passport Information"
        onEdit={() => {
          form.reset({
            passportNumber: profile.passportNumber ?? "",
            passportIssueDate: profile.passportIssueDate ? profile.passportIssueDate.slice(0, 10) : "",
            passportExpiryDate: profile.passportExpiryDate ? profile.passportExpiryDate.slice(0, 10) : "",
            passportIssuingCountry: profile.passportIssuingCountry ?? "",
          });
          onOpenChange(true);
        }}
      />
      <FieldList
        rows={[
          { label: "Passport Number", value: profile.passportNumberMasked ?? "—", hint: "Masked for security." },
          { label: "Issue Date", value: fmtDate(profile.passportIssueDate) },
          { label: "Expiry Date", value: fmtDate(profile.passportExpiryDate) },
          { label: "Issuing Country", value: profile.passportIssuingCountry ?? null },
        ]}
      />
      <ProfileSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Edit Passport Information"
        description="Your passport details are masked on read."
        onSave={handleSave}
        saving={saving}
      >
        <div className="space-y-4">
          <Field label="Passport Number" hint="Stored securely; masked on display." error={form.formState.errors.passportNumber?.message as string}>
            <Input {...form.register("passportNumber")} placeholder="AB1234567" autoComplete="off" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue Date">
              <Input type="date" {...form.register("passportIssueDate")} />
            </Field>
            <Field label="Expiry Date" error={form.formState.errors.passportExpiryDate?.message as string}>
              <Input type="date" {...form.register("passportExpiryDate")} />
            </Field>
          </div>
          <Field label="Issuing Country" error={form.formState.errors.passportIssuingCountry?.message as string}>
            <Input {...form.register("passportIssuingCountry")} placeholder="Bangladesh" />
          </Field>
        </div>
      </ProfileSheet>
    </MobileCard>
  );
}

// ── Emergency Contact Section ────────────────────────────────────

function EmergencySection({
  profile,
  open,
  onOpenChange,
  onSave,
}: {
  profile: ProfileView;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: Partial<StudentProfilePatch>) => Promise<ProfileView>;
}) {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(studentProfilePatchSchema as never) as never,
    defaultValues: {
      emergencyContactName: profile.emergencyContactName ?? "",
      emergencyContactPhone: profile.emergencyContactPhone ?? "",
      emergencyContactRelation: profile.emergencyContactRelation ?? "",
    },
  });

  async function handleSave() {
    const valid = await form.trigger();
    if (!valid) return;
    const v = form.getValues();
    const patch: Partial<StudentProfilePatch> = {
      emergencyContactName: v.emergencyContactName || null,
      emergencyContactPhone: v.emergencyContactPhone || null,
      emergencyContactRelation: v.emergencyContactRelation || null,
    };
    setSaving(true);
    try {
      await onSave(patch);
      toast({ title: "Emergency contact saved", variant: "success" });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileCard className="space-y-2">
      <SectionHeader
        icon={<Siren className="h-4 w-4 text-primary" aria-hidden />}
        title="Emergency Contact"
        onEdit={() => {
          form.reset({
            emergencyContactName: profile.emergencyContactName ?? "",
            emergencyContactPhone: profile.emergencyContactPhone ?? "",
            emergencyContactRelation: profile.emergencyContactRelation ?? "",
          });
          onOpenChange(true);
        }}
      />
      <FieldList
        rows={[
          { label: "Contact Name", value: profile.emergencyContactName ?? null },
          { label: "Contact Phone", value: profile.emergencyContactPhone ?? null },
          { label: "Relationship", value: profile.emergencyContactRelation ?? null },
        ]}
      />
      <ProfileSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Edit Emergency Contact"
        description="Who to call in case of emergency."
        onSave={handleSave}
        saving={saving}
      >
        <div className="space-y-4">
          <Field label="Contact Name" error={form.formState.errors.emergencyContactName?.message as string}>
            <Input {...form.register("emergencyContactName")} autoComplete="name" placeholder="Full name" />
          </Field>
          <Field label="Contact Phone" error={form.formState.errors.emergencyContactPhone?.message as string}>
            <Input {...form.register("emergencyContactPhone")} type="tel" autoComplete="tel" placeholder="+8801XXXXXXXXX" />
          </Field>
          <Field label="Relationship" error={form.formState.errors.emergencyContactRelation?.message as string}>
            <Input {...form.register("emergencyContactRelation")} placeholder="Parent / Spouse / Sibling" />
          </Field>
        </div>
      </ProfileSheet>
    </MobileCard>
  );
}

// ── Shared small pieces ──────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  onEdit,
}: {
  icon: React.ReactNode;
  title: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <button
        onClick={onEdit}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`Edit ${title}`}
      >
        Edit
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

function FieldList({
  rows,
}: {
  rows: { label: string; value: string | null; hint?: string }[];
}) {
  return (
    <dl className="divide-y divide-border text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex items-start justify-between gap-3 py-1.5">
          <dt className="shrink-0 text-muted-foreground">{r.label}</dt>
          <dd className="min-w-0 max-w-[65%] text-right font-medium">
            {r.value ? (
              <span className="block truncate" title={r.value}>
                {r.value}
              </span>
            ) : (
              <span className="text-muted-foreground/70">—</span>
            )}
            {r.hint && <span className="block text-[10px] font-normal text-muted-foreground">{r.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function fmtDate(d?: string | null): string {
  if (!d) return "";
  try {
    return format(parseISO(d), "MMM d, yyyy");
  } catch {
    return "";
  }
}

// We need the Input/Select imports — already imported at the top.

/** Hook that subscribes to online/offline events. */
function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
