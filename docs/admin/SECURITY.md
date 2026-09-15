# Security Guide

This guide explains practical security rules for Euroscope administrators.

## Golden Rules

1. **Never share your password** — not with colleagues, not with IT staff, not with anyone
2. **Use strong passwords** — at least 12 characters with mixed case, numbers, and symbols
3. **Don't share admin accounts** — each person should have their own account
4. **Log out when done** — especially on shared computers
5. **Report suspicious activity** — contact your system administrator immediately

## Password Best Practices

- Use a unique password for Euroscope (not used on other sites)
- Consider using a password manager (1Password, Bitwarden, etc.)
- Change your password if you suspect it's been compromised
- Use the "Forgot Password?" link if you forget — don't ask someone to reset it for you

## Document Security

- Documents (passports, transcripts, bank statements) are stored privately
- Only authorized staff can access documents
- Documents are never publicly accessible via URL
- Download links are authenticated — you can't share a document link with someone outside the system
- Document access is audit-logged

## Financial Security

- All payment amounts are calculated server-side (client-side values are not trusted)
- Refunds require admin authorization
- Financial actions are audit-logged
- Invoice numbers are unique and sequential — they cannot be duplicated

## Audit Trail

Every important action is recorded in the audit log:
- User login/logout
- Student creation/deletion
- Application stage changes
- Document approval/rejection
- Payment creation/refund
- Invoice issuance/cancellation
- Settings changes
- Role/permission changes

**Audit logs cannot be modified or deleted.** They are permanent records.

## Least Privilege Principle

Give each user the minimum permissions they need:
- Counselors need `students.read`, `applications.manage`, `documents.review` — but not `finance.manage`
- Finance staff need `finance.read` and `finance.manage` — but not `settings.manage`
- Only the system administrator should have all permissions

## What to Do If...

### You suspect unauthorized access
1. Change your password immediately
2. Contact your system administrator
3. Review the audit logs for suspicious activity

### A staff member leaves the company
1. Deactivate their user account (don't delete — preserve audit trail)
2. Reassign their students to other counselors
3. Review their recent activity in audit logs

### You accidentally delete something
1. Don't panic — Euroscope uses soft delete
2. Contact your system administrator
3. Archived records can be restored

## Never Do These

- Never share your login credentials
- Never use a shared/admin account for daily work
- Never download sensitive documents to personal devices
- Never email student documents outside the system
- Never change settings you don't understand
- Never delete audit logs
