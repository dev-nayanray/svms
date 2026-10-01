# Live 10K+ Demo Data Import and Cleanup Report

## Status: AWAITING USER EXECUTION

The demo data generator script has been built and pushed (commit `233dc00`). However, the actual data import cannot be performed from the development workspace because it requires direct MongoDB access (the workspace `.env` points to SQLite, not the production MongoDB).

**The user must run the import on their machine.**

---

## Import Instructions

### Step 1: Ensure MongoDB Connection

On your Windows machine, verify your `.env` has the production MongoDB URL:
```
DATABASE_URL=mongodb+srv://...
```

### Step 2: Run the Generator

```powershell
PS C:\Users\USER\Desktop\svms> git pull
PS C:\Users\USER\Desktop\svms> npm run demo:generate
```

This will:
- Generate 10,000 students with unique emails (`demo1@euroscope.demo` through `demo10000@euroscope.demo`)
- Generate all connected data (leads, applications, documents, payments, invoices, tasks, etc.)
- Process in batches of 500 students
- Print progress per batch
- Verify final counts at the end
- Take approximately 5-15 minutes depending on MongoDB connection speed

### Step 3: Verify on Live Site

After the generator completes, open:
```
https://svms-ten.vercel.app/admin
```

The dashboard should now show:
- Total Students: 10,000+
- Active Applications: 10,000+
- Documents: 30,000+
- Payments: 15,000+
- etc.

### Step 4: Remove Demo System (After Verification)

Once you've confirmed the data is visible on the live site, remove the demo generator:

```powershell
PS C:\Users\USER\Desktop\svms> del scripts\demo-generate.ts
```

Then remove the npm script from `package.json`:
- Delete the line: `"demo:generate": "tsx scripts/demo-generate.ts",`

Then commit + push:
```powershell
PS C:\Users\USER\Desktop\svms> git add -A
PS C:\Users\USER\Desktop\svms> git commit -m "chore: remove demo import system after 10k production data import"
PS C:\Users\USER\Desktop\svms> git push origin main
```

---

## Demo System Audit

### Demo UI References
- Admin Panel pages: **NONE** ✅
- Admin navigation items: **NONE** ✅
- Admin API routes: **NONE** ✅
- Admin components: **NONE** ✅
- Admin buttons/CTAs: **NONE** ✅
- Admin settings: **NONE** ✅

### Demo Code References
- CLI script: `scripts/demo-generate.ts` (to be removed after import)
- npm script: `demo:generate` in `package.json` (to be removed after import)
- Documentation: `LARGE_SCALE_DEMO_DATA_AUDIT.md` (not yet created — will be created after import)

### What Does NOT Need Removal
- No demo admin pages exist
- No demo API routes exist
- No demo navigation items exist
- No demo UI components exist
- No demo environment variables exist
- The imported data records (`demo+N@euroscope.demo`) must **NOT** be deleted

---

## Post-Import Verification Checklist

After running `npm run demo:generate`, verify on `https://svms-ten.vercel.app/admin`:

| Module | Expected | How to Verify |
|--------|----------|---------------|
| Dashboard | 10,000+ students | KPI card shows 10,000+ |
| Students | 10,000+ records | Table shows pagination (500+ pages) |
| Applications | 12,000+ records | Table shows pagination |
| Documents | 30,000+ records | Document Review page |
| Payments | 15,000+ records | Payments table |
| Invoices | 10,000+ records | Invoices table |
| Tasks | 15,000+ records | Tasks table (includes overdue) |
| Reports | Real aggregations | Run 30-day report |
| Global Search | Works across 10k+ | Ctrl+K, search "demo" |
| Action Required | Shows overdue tasks | Dashboard amber banner |

---

## Final Status

```
DEMO DATA IMPORTED: PENDING (user must run npm run demo:generate)
DEMO SYSTEM REMOVAL: PENDING (after import verification)
PRODUCTION VERIFIED: PENDING (after import)

EXPECTED FINAL STATUS: 10K+ DEMO DATA IMPORTED — DEMO SYSTEM REMOVED — PRODUCTION VERIFIED
```
