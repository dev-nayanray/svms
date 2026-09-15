import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

/**
 * Email service — sends transactional emails using SMTP settings
 * stored in the SystemSetting table (configured via Admin → Settings → Email).
 *
 * Settings keys:
 *  - email_from:          From address (noreply@example.com)
 *  - email_from_name:     From display name (Euroscope)
 *  - email_server_host:   SMTP host (smtp.gmail.com)
 *  - email_server_port:   SMTP port (587)
 *  - email_server_user:   SMTP username
 *  - email_server_password: SMTP password (App Password for Gmail)
 *
 * If any required setting is missing, the email is silently skipped
 * (logged to stderr) — the primary operation (e.g. Lead creation)
 * never fails because email delivery failed.
 */

type MailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Read SMTP settings from the DB. Returns null if not configured.
 */
async function getSmtpConfig() {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          "email_from",
          "email_from_name",
          "email_server_host",
          "email_server_port",
          "email_server_user",
          "email_server_password",
        ],
      },
    },
  });

  const map = new Map<string, string>();
  for (const s of settings) {
    // SystemSetting.value is Json? — can be string, number, or object
    // Convert everything to string for uniform handling
    if (s.value !== null && s.value !== undefined) {
      map.set(s.key, String(s.value));
    }
  }

  const host = map.get("email_server_host");
  const user = map.get("email_server_user");
  const pass = map.get("email_server_password");

  // All three are required — if any is missing, email is disabled
  if (!host || !user || !pass) return null;

  return {
    host,
    port: Number(map.get("email_server_port") ?? 587),
    auth: { user, pass },
    from: `"${map.get("email_from_name") || "Euroscope"}" <${map.get("email_from") || user}>`,
  };
}

/**
 * Send an email. Best-effort: never throws.
 * Returns true if sent, false if skipped or failed.
 */
export async function sendEmail(opts: MailOptions): Promise<boolean> {
  try {
    const config = await getSmtpConfig();
    if (!config) {
      console.warn("[email] SMTP not configured — skipping email to", opts.to);
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.auth.user, pass: config.auth.pass },
    });

    await transporter.sendMail({
      from: config.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]*>/g, ""),
    });

    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
  }
}

/**
 * Test SMTP configuration — used by the admin "Send test email" button.
 * Returns success/failure with details.
 */
export async function testSmtpConnection(targetEmail: string): Promise<{ ok: boolean; message: string }> {
  try {
    const config = await getSmtpConfig();
    if (!config) {
      return { ok: false, message: "SMTP settings are not configured. Set host, username, and password in Settings → Email." };
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.auth.user, pass: config.auth.pass },
    });

    await transporter.sendMail({
      from: config.from,
      to: targetEmail,
      subject: "Euroscope — Test Email",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e293b;">Euroscope SMTP Test</h2>
          <p>This email confirms that your SMTP configuration is working correctly.</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            Sent from: ${config.from}<br>
            Host: ${config.host}:${config.port}<br>
            Time: ${new Date().toISOString()}
          </p>
        </div>
      `,
    });

    return { ok: true, message: `Test email sent to ${targetEmail}. Check your inbox.` };
  } catch (err) {
    return {
      ok: false,
      message: `SMTP error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

/**
 * Send a notification email to admins/employees when a new lead comes in
 * from the marketing site.
 */
export async function sendNewLeadNotificationEmail(lead: {
  name: string;
  email: string;
  phone: string | null;
  source: string;
}): Promise<void> {
  // Find all admin + employee users who should be notified
  const recipients = await prisma.user.findMany({
    where: {
      roleName: { in: ["ADMIN", "EMPLOYEE"] },
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { email: true },
  });

  const emails = recipients.map((r) => r.email).filter(Boolean);
  if (emails.length === 0) return;

  await sendEmail({
    to: emails.join(", "),
    subject: `New lead from website: ${lead.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">New Lead Received</h2>
        <p>A new lead has been submitted from the website.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Name</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${lead.name}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Email</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${lead.email}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Phone</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${lead.phone || "—"}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Source</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${lead.source}</td></tr>
        </table>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/admin/leads" style="display: inline-block; padding: 10px 20px; background: #1e293b; color: white; text-decoration: none; border-radius: 8px;">View in Admin Panel</a></p>
      </div>
    `,
  });
}
