import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import {
  SETTING_SECTIONS,
  isSecretKey,
  isReadOnly,
  maskSecretValue,
  getDefaultValue,
  getSettingSection,
} from "@/lib/constants/settings";

/**
 * Admin Settings endpoint — returns all settings grouped by section.
 *
 * Secret settings (SMTP password, API keys) are masked in the response:
 * the UI never sees the full value. A masked secret appears as
 * "••••••••" — if the admin submits "••••••••" as the new value, the
 * PUT endpoint treats it as a no-op (the secret is unchanged).
 *
 * Read-only settings (system section) are returned but cannot be
 * modified via PUT.
 */
export async function GET() {
  try {
    const g = await guard("settings.manage");
    if (g.error) return g.error;

    const settings = await prisma.systemSetting.findMany();

    // Build a lookup: key → value
    const settingMap = new Map<string, unknown>();
    for (const s of settings) {
      settingMap.set(s.key, s.value);
    }

    // Group by section, applying defaults + masking secrets
    const sections = SETTING_SECTIONS.map((section) => ({
      key: section.key,
      label: section.label,
      icon: section.icon,
      description: section.description,
      settings: section.settings.map((def) => {
        const rawValue = settingMap.get(def.key) ?? def.defaultValue;
        return {
          key: def.key,
          label: def.label,
          type: def.type,
          placeholder: def.placeholder,
          options: def.options,
          helpText: def.helpText,
          isSecret: def.isSecret,
          isReadOnly: isReadOnly(def.key),
          value: maskSecretValue(def.key, rawValue),
        };
      }),
    }));

    return ok({ data: sections });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Update a setting. Every change is audit-logged with old→new diff.
 *
 * Security:
 *  - Secret values: if the submitted value is "••••••••" (the mask),
 *    treat it as a no-op (the admin didn't change the secret).
 *  - Read-only keys (system section): reject with 403.
 *  - All changes require `settings.manage` (admin only).
 */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard("settings.manage");
    if (g.error) return g.error;

    const body = (await req.json()) as { key?: string; value?: unknown };
    if (!body.key) return fail("BAD_REQUEST", "Setting key is required", 400);

    // Reject read-only keys
    if (isReadOnly(body.key)) {
      return fail("FORBIDDEN", "This setting is read-only", 403);
    }

    // Validate the key belongs to a known section
    const section = getSettingSection(body.key);
    if (!section) {
      return fail("BAD_REQUEST", `Unknown setting key: ${body.key}`, 400);
    }

    // If the key is a secret and the value is the mask, skip the update
    if (isSecretKey(body.key) && body.value === "••••••••") {
      return ok({ skipped: true, key: body.key, reason: "secret_unchanged" });
    }

    const existing = await prisma.systemSetting.findUnique({
      where: { key: body.key },
    });

    const setting = await prisma.systemSetting.upsert({
      where: { key: body.key },
      update: { value: body.value as object },
      create: { key: body.key, value: body.value as object },
    });

    await auditLog.record({
      userId: g.user.id,
      action: "setting.updated",
      entity: "SystemSetting",
      entityId: setting.id,
      oldValue: existing
        ? { key: body.key, value: isSecretKey(body.key) ? "[REDACTED]" : existing.value }
        : undefined,
      newValue: {
        key: body.key,
        value: isSecretKey(body.key) ? "[REDACTED]" : body.value,
      },
    });

    return ok({ updated: true, key: body.key });
  } catch (err) {
    return handleApiError(err);
  }
}
