# Troubleshooting

Common problems and their solutions.

## Login Issues

### Can't log in
**Problem:** I enter my email and password but can't log in.

**Solutions:**
1. Check that your email is spelled correctly (including capitalization)
2. Use the "Forgot Password?" link to reset
3. Ask your system administrator to verify your account is active
4. Clear your browser cookies and cache, then try again

### Redirected to wrong panel
**Problem:** I'm an admin but I get redirected to the student portal.

**Solutions:**
1. Your account role might be set to STUDENT instead of ADMIN — contact your system administrator
2. Clear your browser cookies and log in again

### Logged out unexpectedly
**Problem:** I get logged out after a few hours.

**Cause:** Sessions expire after 8 hours for security. This is normal.

**Solution:** Simply log in again.

## Page Issues

### 404 error on a page
**Problem:** I get a "Page not found" error.

**Solutions:**
1. Check the URL is correct
2. Try navigating from the sidebar instead of using a bookmark
3. Clear your browser cache and the `.next` directory (if you're a developer)
4. Restart the development server

### Page loads but shows no data
**Problem:** A table or dashboard is empty.

**Solutions:**
1. Check if you have filters applied — clear them and try again
2. Verify there's actually data in the database (check another module)
3. Check your internet connection
4. Try refreshing the page

### "Failed to load" error
**Problem:** A page shows an error message.

**Solutions:**
1. Click the **Retry** button
2. Check your internet connection
3. Try again in a few minutes (the server might be restarting)
4. If it persists, contact your system administrator with the error message

## Data Issues

### Can't find a student
**Problem:** I know a student exists but can't find them.

**Solutions:**
1. Use global search (Ctrl+K) to search by name, email, or student ID
2. Check if the student is archived — clear the status filter or select "Archived"
3. Check if you have a branch filter applied that excludes the student

### Can't change application stage
**Problem:** The system won't let me advance an application to the next stage.

**Cause:** Stage transitions have prerequisites (e.g., can't go to Visa Submitted without completing Document Collection).

**Solutions:**
1. Check the application timeline to see what's missing
2. Ensure required documents are approved
3. Contact your system administrator if you believe this is an error

### Duplicate records
**Problem:** There are two records for the same student.

**Solutions:**
1. Archive the duplicate (don't delete — preserve history)
2. Keep the one with the most complete data
3. Transfer any related records (applications, documents) to the kept record

## Performance Issues

### Pages load slowly
**Solutions:**
1. Check your internet connection speed
2. Close other browser tabs
3. Try a different browser (Chrome, Firefox, Edge)
4. Clear browser cache
5. If the issue persists, contact your system administrator — the server may need resources

### Table is slow to scroll
**Solutions:**
1. Use server-side pagination (don't load all records at once)
2. Apply filters to reduce the number of visible rows
3. Use the search bar to find specific records

## Getting Help

If none of these solutions work:

1. **Contact your system administrator** — they have access to server logs and can diagnose deeper issues
2. **Provide details** — include the page URL, what you were trying to do, and the exact error message
3. **Check the audit log** — if an action failed, there may be a related audit entry with more details
