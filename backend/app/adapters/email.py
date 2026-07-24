import asyncio
import smtplib
import logging
import traceback
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from concurrent.futures import ThreadPoolExecutor

from app.config import settings

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=2)


def _send_sync(from_email: str, password: str, to_emails: list[str], subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = ", ".join(to_emails)
    msg.attach(MIMEText(html, "html"))

    try:
        logger.info(f"Connecting to SMTP {settings.smtp_host}:{settings.smtp_port} as {settings.smtp_username}")
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
            server.set_debuglevel(1)
            server.starttls()
            server.login(settings.smtp_username, password)
            server.sendmail(from_email, to_emails, msg.as_string())
        logger.info(f"Email sent to {to_emails}: {subject}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_emails}\n{traceback.format_exc()}")


class EmailAdapter:
    def __init__(self):
        self.password = settings.smtp_password.replace(" ", "")
        self.configured = bool(settings.smtp_username and self.password and settings.smtp_from_email)
        self.from_email = settings.smtp_from_email

    async def send_incident_summary(self, to_emails: list[str], incident_data: dict) -> None:
        if not self.configured or not to_emails:
            logger.warning("Email not configured or no recipients — skipping incident summary email")
            return

        incident_id = incident_data.get("incident_id", "N/A")[:8]
        name = incident_data.get("name", "Unnamed")
        severity = incident_data.get("severity", "N/A")
        description = incident_data.get("description", "")
        revenue_risk = incident_data.get("revenue_risk_per_day", 0)
        workflow_id = incident_data.get("workflow_id", "N/A")[:8]
        completed_at = incident_data.get("completed_at", "")

        subject = f"[{severity}] Incident {incident_id} — {name} [COMPLETED]"

        html = f"""\
<html>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f6; padding: 24px;">
<div style="max-width: 560px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
<div style="background: #45d9c8; padding: 20px 28px;">
<h1 style="color: #0f1218; margin: 0; font-size: 18px;">Incident Completed</h1>
</div>
<div style="padding: 28px;">
<table style="width:100%; border-collapse: collapse; font-size: 14px;">
<tr><td style="padding: 8px 0; color: #6b7280;">Incident ID</td><td style="padding: 8px 0; font-family: monospace;"><strong>{incident_id}</strong></td></tr>
<tr><td style="padding: 8px 0; color: #6b7280;">Workflow ID</td><td style="padding: 8px 0; font-family: monospace;"><strong>{workflow_id}</strong></td></tr>
<tr><td style="padding: 8px 0; color: #6b7280;">Name</td><td style="padding: 8px 0;"><strong>{name}</strong></td></tr>
<tr><td style="padding: 8px 0; color: #6b7280;">Severity</td><td style="padding: 8px 0;"><strong>{severity}</strong></td></tr>
<tr><td style="padding: 8px 0; color: #6b7280;">Revenue Risk / Day</td><td style="padding: 8px 0;"><strong>${revenue_risk:,.0f}</strong></td></tr>
<tr><td style="padding: 8px 0; color: #6b7280;">Completed At</td><td style="padding: 8px 0;"><strong>{completed_at}</strong></td></tr>
</table>
<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
<p style="color: #374151; font-size: 14px; line-height: 1.6;"><strong>Description:</strong><br>{description}</p>
<p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">This is an automated notification from the Enterprise AI OS Command Center.</p>
</div></div></body></html>"""

        await self._send_async(to_emails, subject, html)

    async def _send_async(self, to_emails: list[str], subject: str, html: str) -> None:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(_executor, _send_sync, self.from_email, self.password, to_emails, subject, html)
