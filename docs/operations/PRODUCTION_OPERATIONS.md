# Production Operations Guide

## Deployment Checklist

### Before First Deployment

1. **Environment Variables**
   - `DATABASE_URL` — MongoDB Atlas connection string
   - `AUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXT_PUBLIC_APP_NAME` — "Euroscope" (or your brand name)
   - `NEXT_PUBLIC_APP_URL` — your production domain
   - `NODE_ENV` — "production"

2. **Database**
   - Run `npx prisma db push --accept-data-loss` to create all collections + indexes
   - Run `npx prisma generate` to generate the Prisma client
   - Run `npm run seed` to populate roles, countries, universities, and demo data

3. **Build**
   - Run `npm run build` — must succeed with no errors
   - Run `npm run start` — verify production server starts

4. **HTTPS**
   - Configure a reverse proxy (nginx, Caddy, or Vercel) with TLS
   - HSTS header requires HTTPS to function

### Regular Deployments

1. `git pull origin main`
2. `npm install` (if dependencies changed)
3. `npx prisma generate` (if schema changed)
4. `npx prisma db push` (if schema changed)
5. `npm run build`
6. Restart the production server

## Backup & Recovery

### MongoDB Atlas (Recommended)

If using MongoDB Atlas:
- **Automated backups**: Enable continuous backups in Atlas dashboard
- **Backup frequency**: Every 24 hours (Atlas default)
- **Retention**: 7 days recommended
- **Restore**: Use Atlas "Restore" button → create new cluster from snapshot

### Self-Hosted MongoDB

```bash
# Backup
mongodump --uri="mongodb://localhost:27017/euroscope" --out=/backups/$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb://localhost:27017/euroscope" /backups/20260914/
```

### Recovery Objectives

- **RPO (Recovery Point Objective)**: 24 hours (daily backup)
- **RTO (Recovery Time Objective)**: 2 hours (restore + restart)

## Monitoring

### Required Monitoring

| Metric | Alert Threshold | Tool |
|--------|----------------|------|
| Application errors | > 10/min | Next.js error tracking, console logs |
| API latency | > 2s average | APM tool (Datadog, New Relic) |
| Database latency | > 1s average | MongoDB Atlas monitoring |
| Auth failures | > 20/min | Rate limit logs |
| Disk space | > 80% | Server monitoring |
| Memory usage | > 90% | Server monitoring |

## Incident Response

### P0: System Down

1. Check if MongoDB is reachable
2. Check if Node.js process is running
3. Check disk space and memory
4. Restart the application
5. If database is down: restore from latest backup

### Security Incident

1. **Change all admin passwords** immediately
2. **Review audit logs** for suspicious activity
3. **Rotate AUTH_SECRET** — this invalidates all sessions
4. **Document the incident**
