# Applications

The Applications module tracks each student's journey through the 18-stage pipeline, from initial lead to completed visa.

## The 18-Stage Pipeline

| Stage | Description |
|-------|-------------|
| Lead | Initial inquiry — student has shown interest |
| Counselling | First counselling session with a counselor |
| Profile Assessment | Reviewing academic background and English scores |
| Country Selection | Choosing the destination country |
| University Selection | Shortlisting universities |
| Document Collection | Gathering required documents |
| Application Submitted | Application sent to the university |
| Conditional Offer | University offered a place with conditions |
| Unconditional Offer | University offered a confirmed place |
| Deposit Payment | Student paid the university deposit |
| Confirmation | University confirmed the enrollment |
| Visa Preparation | Preparing visa application documents |
| Visa Submitted | Visa application submitted to embassy |
| Biometrics | Student attended biometrics appointment |
| Interview | Student attended visa interview |
| Visa Decision | Visa approved or refused |
| Travel Preparation | Preparing for travel |
| Completed | Student has traveled — journey complete |

## How to Create an Application

1. Go to **CRM → Applications**
2. Click **Create Application**
3. Select the student
4. Select the country, university, course, and intake
5. The application starts at the **Lead** stage

## How to Change the Stage

1. Open the application detail page
2. Use the **pipeline progress** to see current stage
3. Click the next stage to advance
4. The system prevents invalid transitions (e.g., can't go to Visa Submitted without completing Document Collection)
5. Every stage change is recorded in the **Timeline**

## Application Detail Page

- **Header** — application number, country, university, course, current stage, progress ring
- **Pipeline** — visual representation of the 18 stages
- **Overview** — key facts (student, counselor, intake, dates)
- **Documents** — documents linked to this application
- **Tasks & Payments** — related tasks and financial records
- **Visa** — visa application details (if applicable)
- **Timeline** — chronological history of all stage changes and actions
- **Notes** — internal notes (not visible to students)

## Statuses

| Status | Meaning |
|--------|---------|
| Active | In progress |
| On Hold | Temporarily paused |
| Completed | Journey complete |
| Cancelled | Abandoned or withdrawn |

## Search & Filter

- **Search** by application number or student name
- **Filter** by status, stage, country, university, or assigned employee
- **Sort** by created date, last updated, or stage
- **Bulk actions** — assign employee, change priority

## Related Modules

- [Students](./STUDENTS.md) — the student this application belongs to
- [Documents](./DOCUMENTS.md) — documents required for this application
- [Visa Management](./VISA_MANAGEMENT.md) — visa tracking for this application
- [Payments](./PAYMENTS.md) — payments linked to this application
