# Roles & Permissions

Euroscope uses role-based access control (RBAC) to determine who can do what.

## Roles

| Role | Description | Home Page |
|------|-------------|-----------|
| Admin | Full business and system management | /admin |
| Employee | Assigned operational work (counselors, case officers) | /employee |
| Student | Own data only — can view their applications, documents, etc. | /student |

## Permission Categories

### Student Management
- `students.read` — View student lists and profiles (Admin, Employee)
- `students.create` — Add new students (Admin, Employee)
- `students.update` — Edit student information (Admin, Employee)
- `students.delete` — Archive/delete students (Admin only)

### Employee Management
- `employees.read` — View employee list (Admin only)
- `employees.create` — Add new employees (Admin only)
- `employees.update` — Edit employee profiles (Admin only)
- `employees.delete` — Remove employees (Admin only)

### Applications
- `applications.read` — View applications (Admin, Employee)
- `applications.manage` — Create/edit/change stages (Admin, Employee)
- `applications.delete` — Delete applications (Admin only)

### Documents
- `documents.read` — View documents (Admin, Employee)
- `documents.upload` — Upload documents (Admin, Employee, Student)
- `documents.review` — Approve/reject documents (Admin, Employee)

### Finance
- `finance.read` — View payments and invoices (Admin only)
- `finance.manage` — Create/edit payments and invoices (Admin only)

### Reports
- `reports.read` — View reports (Admin, Employee)

### System
- `settings.manage` — Change system settings (Admin only)
- `audit.read` — View audit logs (Admin only)
- `branches.manage` — Manage branches (Admin only)

## Protection Rules

- **Last administrator protection** — the system prevents deleting the last admin account
- **Self-deletion prevention** — you cannot delete your own account
- **Audit log immutability** — audit logs cannot be modified or deleted
- **Soft delete** — most records are archived, not permanently deleted

## Managing Users

1. Go to **Team & Organization → Team & Users**
2. View all system users
3. Create new users with appropriate roles
4. Activate/deactivate users
5. Reset passwords when needed

## Managing Employees

1. Go to **Team & Organization → Employees**
2. Create employee profiles linked to user accounts
3. Assign employees to branches
4. Assign students to employees (counselor assignments)

## Related

- [Settings](./SETTINGS.md) — system configuration
- [Audit Logs](./AUDIT_LOGS.md) — tracking permission changes
- [Security](./SECURITY.md) — security best practices
