# Cron Email Notifications Setup Guide

## Overview

This guide explains how to set up and configure the automated email notification system using Vercel cron jobs and Resend.

## Environment Variables

### Required Variables

Add these to your `.env.local` file and Vercel project settings:

```bash
# Resend API Key (already configured)
RESEND_API_KEY=your_resend_api_key_here

# Cron Job Security (REQUIRED for production)
CRON_SECRET=your_secure_random_string_here

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Generating CRON_SECRET

Generate a secure random string for `CRON_SECRET`:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

## Cron Job Configuration

### Vercel Configuration (`vercel.json`)

The cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-summary",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/monthly-report", 
      "schedule": "0 10 1 * *"
    }
  ]
}
```

### Schedule Explanation

- **Daily Summary**: `0 9 * * *` - Runs daily at 9:00 AM UTC
- **Weekly Report**: `0 10 * * 1` - Runs every Monday at 10:00 AM UTC

## User Settings

Users control their email preferences through the `settings` table:

- `email_alerts`: Master toggle for all email notifications
- `daily_summary`: Enable/disable daily expiry alerts
- `weekly_report`: Enable/disable weekly reports
- `alert_threshold`: Days before expiry to send alerts (default: 7)

## Testing

### Local Testing

1. **Test Email Service**:
   ```bash
   node test-email.js
   ```

2. **Test Cron Endpoints**:
   ```bash
   node test-cron.js
   ```

3. **Manual Endpoint Testing**:
   ```bash
   # Daily Summary
   curl -H "Authorization: Bearer your_cron_secret" \
        http://localhost:3000/api/cron/daily-summary
   
   # Weekly Report
   curl -H "Authorization: Bearer your_cron_secret" \
        http://localhost:3000/api/cron/weekly-report
   ```

### Production Testing

After deployment to Vercel:

1. **Check Vercel Dashboard**: Go to your project → Settings → Cron Jobs
2. **View Logs**: Check function logs in Vercel dashboard
3. **Test Endpoints**: Use the same curl commands with your production URL

## Email Templates

### Daily Alert Email Features

- Shows products expiring within user's threshold
- Color-coded status badges (Expired, Urgent, Warning, Notice)
- Clean product table with batch numbers and categories
- Direct link to dashboard

### Weekly Report Email Features

- Statistics overview (total products, expired, expiring soon)
- Top categories breakdown
- Lists of recently expired and expiring products
- Professional branding with LifeCycle colors

## Security

### Authorization

All cron endpoints require the `CRON_SECRET` in the Authorization header:

```
Authorization: Bearer your_cron_secret_here
```

### Database Access

Cron jobs use the Supabase service role key to access all user data without RLS restrictions.

## Monitoring

### Success Metrics

Both cron jobs return detailed response objects:

```json
{
  "message": "Weekly report cron job completed",
  "processed": 15,
  "emails_sent": 12,
  "timestamp": "2024-01-15T10:00:00.000Z",
  "errors": ["Failed to send email to user@example.com: Invalid email"]
}
```

### Error Handling

- Invalid authorization returns 401
- Database errors return 500
- Email sending errors are logged but don't stop processing
- Individual user failures don't affect other users

## Deployment Checklist

- [ ] Set `CRON_SECRET` in Vercel environment variables
- [ ] Verify `RESEND_API_KEY` is configured
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` has proper permissions
- [ ] Test cron endpoints manually
- [ ] Monitor first scheduled runs
- [ ] Check email delivery and formatting

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check `CRON_SECRET` matches in both local and Vercel
2. **Email not sending**: Verify `RESEND_API_KEY` and domain verification
3. **No users processed**: Check user settings in database
4. **Database errors**: Verify service role key permissions

### Debugging

Enable detailed logging by checking:
- Vercel function logs
- Resend delivery dashboard
- Supabase logs
- Console output in test scripts

## Customization

### Email Templates

Modify templates in `src/lib/email-templates.tsx`:
- Update colors and branding
- Change email structure
- Add new product information

### Cron Schedules

Update schedules in `vercel.json`:
- Change timing
- Add new cron jobs
- Modify frequency

### Notification Logic

Modify logic in cron route files:
- Change alert thresholds
- Add new notification types
- Update user filtering criteria
