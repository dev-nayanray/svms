"use client";

import { useState } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { Button, Input, Label, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { initials } from "@/lib/utils";
import type { ProfileDetail } from "@/lib/services/profile-cases";

type Props = {
  profile: ProfileDetail;
};

export function ProfileEditForm({ profile }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [avatar, setAvatar] = useState(profile.avatar ?? "");
  const [title, setTitle] = useState(profile.title ?? "");
  const [branch, setBranch] = useState(profile.branch ?? "");
  const [designation, setDesignation] = useState(profile.designation ?? "");
  const [address, setAddress] = useState(profile.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name !== profile.name ||
    phone !== (profile.phone ?? "") ||
    avatar !== (profile.avatar ?? "") ||
    title !== (profile.title ?? "") ||
    branch !== (profile.branch ?? "") ||
    designation !== (profile.designation ?? "") ||
    address !== (profile.address ?? "");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/employee/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          phone: phone || null,
          avatar: avatar || null,
          title: title || null,
          branch: branch || null,
          designation: designation || null,
          address: address || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      toast({ title: "Profile saved", variant: "success" });
      // Update local state to match server-returned values (so dirty=false)
      const updated = data.data as ProfileDetail;
      setName(updated.name);
      setPhone(updated.phone ?? "");
      setAvatar(updated.avatar ?? "");
      setTitle(updated.title ?? "");
      setBranch(updated.branch ?? "");
      setDesignation(updated.designation ?? "");
      setAddress(updated.address ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      toast({ title: "Could not save profile", description: msg, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setName(profile.name);
    setPhone(profile.phone ?? "");
    setAvatar(profile.avatar ?? "");
    setTitle(profile.title ?? "");
    setBranch(profile.branch ?? "");
    setDesignation(profile.designation ?? "");
    setAddress(profile.address ?? "");
    setError(null);
  }

  return (
    <div className="space-y-5">
      {/* Avatar preview + URL input */}
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-base font-semibold text-primary">
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(name) || "E"
          )}
        </span>
        <div className="flex-1">
          <Label htmlFor="profile-avatar">Profile photo URL</Label>
          <Input
            id="profile-avatar"
            type="url"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://…"
            className="mt-1"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Paste a publicly-accessible image URL. PNG, JPG, or WebP recommended.
          </p>
        </div>
      </div>

      {/* Name + Phone */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="profile-name">Name <span className="text-destructive">*</span></Label>
          <Input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            className="mt-1"
            required
          />
        </div>
        <div>
          <Label htmlFor="profile-phone">Phone</Label>
          <Input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            placeholder="+8801…"
            className="mt-1"
          />
        </div>
      </div>

      {/* Title + Designation */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="profile-title">Title</Label>
          <Input
            id="profile-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Senior Counselor"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="profile-designation">Designation</Label>
          <Input
            id="profile-designation"
            type="text"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            maxLength={200}
            placeholder="Education Consultant"
            className="mt-1"
          />
        </div>
      </div>

      {/* Branch */}
      <div>
        <Label htmlFor="profile-branch">Branch</Label>
        <Input
          id="profile-branch"
          type="text"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          maxLength={200}
          placeholder="Dhaka Main Office"
          className="mt-1"
        />
      </div>

      {/* Address */}
      <div>
        <Label htmlFor="profile-address">Address</Label>
        <Input
          id="profile-address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          maxLength={500}
          placeholder="House 12, Road 5, Banani, Dhaka"
          className="mt-1"
        />
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save changes
        </Button>
        <Button variant="ghost" onClick={reset} disabled={saving || !dirty}>
          Reset
        </Button>
        {dirty && (
          <Badge tone="warning" className="ml-auto">Unsaved changes</Badge>
        )}
      </div>
    </div>
  );
}
