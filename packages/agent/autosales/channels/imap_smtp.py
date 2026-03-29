"""Universal IMAP/SMTP email channel for any provider."""

from __future__ import annotations

import email
import email.mime.multipart
import email.mime.text
import imaplib
import logging
import os
import smtplib
from datetime import datetime, timezone
from email.header import decode_header
from typing import Any

from autosales.channels.base import BaseChannel, EmailMessage

logger = logging.getLogger("autosales.channels.imap_smtp")


class IMAPSMTPChannel(BaseChannel):
    """Email channel using standard IMAP for reading and SMTP for sending.

    Configuration via environment variables:
        IMAP_HOST, IMAP_PORT (default 993),
        SMTP_HOST, SMTP_PORT (default 587),
        EMAIL_USER, EMAIL_PASSWORD
    """

    def __init__(self) -> None:
        self._imap_host = os.environ.get("IMAP_HOST", "")
        self._imap_port = int(os.environ.get("IMAP_PORT", "993"))
        self._smtp_host = os.environ.get("SMTP_HOST", "")
        self._smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        self._user = os.environ.get("EMAIL_USER", "")
        self._password = os.environ.get("EMAIL_PASSWORD", "")

    async def fetch_new_messages(self) -> list[EmailMessage]:
        """Fetch unseen messages from the IMAP inbox."""
        messages: list[EmailMessage] = []
        try:
            conn = imaplib.IMAP4_SSL(self._imap_host, self._imap_port)
            conn.login(self._user, self._password)
            conn.select("INBOX")

            _, msg_ids = conn.search(None, "UNSEEN")
            if not msg_ids or not msg_ids[0]:
                conn.logout()
                return messages

            for uid in msg_ids[0].split():
                _, data = conn.fetch(uid, "(RFC822)")
                if data and data[0] and isinstance(data[0], tuple):
                    raw_email = data[0][1]
                    parsed = email.message_from_bytes(raw_email)
                    messages.append(self._parse_email(parsed))

            conn.logout()
        except Exception:
            logger.exception("[imap_smtp] Failed to fetch messages")
        return messages

    async def send_message(
        self,
        to: str,
        subject: str,
        body: str,
        attachments: list[dict[str, Any]] | None = None,
    ) -> bool:
        """Send an email via SMTP with STARTTLS."""
        try:
            msg = email.mime.multipart.MIMEMultipart()
            msg["From"] = self._user
            msg["To"] = to
            msg["Subject"] = subject
            msg.attach(email.mime.text.MIMEText(body, "plain", "utf-8"))

            with smtplib.SMTP(self._smtp_host, self._smtp_port) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(self._user, self._password)
                server.sendmail(self._user, to, msg.as_string())

            logger.info("[imap_smtp] Sent email to %s: %s", to, subject)
            return True
        except Exception:
            logger.exception("[imap_smtp] Failed to send email to %s", to)
            return False

    async def check_health(self) -> bool:
        """Test IMAP connection."""
        try:
            conn = imaplib.IMAP4_SSL(self._imap_host, self._imap_port)
            conn.login(self._user, self._password)
            conn.logout()
            return True
        except Exception:
            logger.exception("[imap_smtp] Health check failed")
            return False

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_email(msg: email.message.Message) -> EmailMessage:
        """Convert a stdlib email.message.Message into our EmailMessage."""
        subject_raw = msg.get("Subject", "")
        decoded_parts = decode_header(subject_raw)
        subject = ""
        for part, enc in decoded_parts:
            if isinstance(part, bytes):
                subject += part.decode(enc or "utf-8", errors="replace")
            else:
                subject += part

        body = ""
        html_body = None
        if msg.is_multipart():
            for part in msg.walk():
                ct = part.get_content_type()
                if ct == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode("utf-8", errors="replace")
                elif ct == "text/html":
                    payload = part.get_payload(decode=True)
                    if payload:
                        html_body = payload.decode("utf-8", errors="replace")
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode("utf-8", errors="replace")

        date_str = msg.get("Date", "")
        received_at = None
        try:
            received_at = email.utils.parsedate_to_datetime(date_str)
            if received_at.tzinfo is None:
                received_at = received_at.replace(tzinfo=timezone.utc)
        except Exception:
            received_at = datetime.now(timezone.utc)

        return EmailMessage(
            from_addr=msg.get("From", ""),
            to_addr=msg.get("To", ""),
            subject=subject,
            body=body,
            html_body=html_body,
            received_at=received_at,
            message_id=msg.get("Message-ID", ""),
        )
