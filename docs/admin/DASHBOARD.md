# Dashboard Guide

The admin dashboard is your daily command center. It shows what's happening, what needs attention, and what to do next.

## Understanding KPI Cards

The top row shows 10 Key Performance Indicators (KPIs). Each is clickable.

| KPI | What It Means | Where It Links |
|-----|---------------|----------------|
| Total Students | All registered students (excluding archived) | Students list |
| Active Students | Students with ACTIVE status | Students filtered by ACTIVE |
| New Leads | New leads in the selected date range | Leads list |
| Active Applications | Applications in progress (not completed/cancelled) | Applications list |
| Revenue (period) | Total payments received in the date range | Payments list |
| Visa Submitted | Applications in visa submission/biometrics/interview stages | Visa management |
| Visa Approved | Applications with completed visa (approved) | Visa management |
| Visa Refused | Applications with refused visa | Visa management |
| Pending Documents | Documents waiting for review | Document review |
| Outstanding | Total unpaid invoice amounts | Invoices list |

## Date Range Filters

Use the date range selector to change what period the KPIs cover:

- **Today** — just today's data
- **Last 7 Days** — rolling week
- **Last 30 Days** — rolling month (default)
- **Last 90 Days** — rolling quarter
- **This Year** — January 1 to today
- **Custom** — pick any start and end date

The filter affects: New Leads, Revenue, and Monthly charts.

## Action Required Section

The amber **Action Required** banner appears when items need your attention:

- **Overdue tasks** — tasks past their due date. Click to go to the Tasks page.
- **Documents need review** — uploaded documents waiting for approval. Click to review them.
- **Outstanding payments** — unpaid invoice amounts. Click to see invoices.

**Tip:** Check this section first thing every morning.

## Charts

The dashboard shows 7 charts, all using real database data:

1. **Applications by Country** — pie chart of where students are applying
2. **Applications by Stage** — bar chart of the pipeline distribution
3. **Applications by Intake** — bar chart of intake popularity
4. **Visa Decision Statistics** — pie chart of approved/submitted/refused
5. **Monthly Student Registration** — bar chart of new students per month
6. **Monthly Revenue** — bar chart of payment revenue per month
7. **Employee Performance** — bar chart of cases per employee

If a chart shows "No data available," it means there are no records matching the filter — not an error.

## Quick Actions

The Quick Actions bar gives one-click access to common tasks:

- **Add Student** — create a new student record
- **Add Lead** — create a new lead
- **Create Application** — start a new application
- **Review Documents** — go to the document review queue
- **Record Payment** — log a new payment
- **Create Invoice** — generate a new invoice
- **Create Task** — assign a task to a team member

## Operational Widgets

The bottom section shows 6 widgets:

1. **Today's Tasks** — count of tasks due today + overdue count
2. **Upcoming Deadlines** — tasks and document deadlines coming up
3. **Recent Applications** — 6 most recent applications
4. **Recent Payments** — 6 most recent payments
5. **Recent Activity** — 8 most recent audit log entries
6. **Documents & Finance** — pending documents + outstanding payments summary

## Empty States

If the database has no data yet (e.g., fresh installation), you'll see helpful messages like:
- "No applications yet."
- "No payments yet."
- "Nothing scheduled."

This is normal — the dashboard updates automatically as you add data.
