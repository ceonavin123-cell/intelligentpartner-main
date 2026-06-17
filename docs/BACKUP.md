# Database Backup & Recovery

## Supabase Backups (Production)

### Automatic Backups
- **Free Plan**: Daily backups, 7-day retention
- **Pro Plan ($25/mo)**: Daily backups, 30-day retention
- **Team Plan ($599/mo)**: Point-in-time recovery (PITR)

### How to Configure
1. Go to supabase.com → Your Project → **Settings**
2. Click **Backups**
3. Enable **Point-in-Time Recovery** (requires Team plan)
4. Set backup schedule (daily recommended)

### How to Restore
1. Go to **Settings** → **Backups**
2. Select a backup date
3. Click **Restore**

## Manual Backup (SQL Dump)
Run in Supabase SQL Editor:
```sql
-- Export all data as SQL (run locally)
-- pg_dump your_database > backup_$(date +%Y%m%d).sql
```

## Environment Variable
Add to .env for backup notifications:
```
BACKUP_WEBHOOK_URL=https://your-slack-or-email-webhook.com/backup
```
