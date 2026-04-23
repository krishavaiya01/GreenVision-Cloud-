# GreenVision-Cloud

## Email Notifications (Backend)

The backend now supports email notifications for AI recommendations and urgent alerts.

Configure SMTP via environment variables in `backend/.env` (create if missing):

```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
EMAIL_FROM="GreenVision Cloud <no-reply@greenvision.cloud>"
```

If SMTP variables are not provided, the server falls back to a JSON transport that logs the email content to the server console (useful for local development).

API Endpoints:
- POST /api/notifications/ai-recommendations — send a summary to the logged-in user's email
- POST /api/notifications/urgent — send an urgent alert

Request body for urgent alert:
```
{
	"title": "High CPU Usage on AWS",
	"message": "Average CPU > 90% across 3 instances in us-east-1 for 15m",
	"severity": "critical", // optional
	"context": { "avgCPU": 93, "instances": 3 } // optional
}
```

