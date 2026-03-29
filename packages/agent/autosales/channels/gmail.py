"""Gmail channel via the Google Gmail API (OAuth2)."""

from __future__ import annotations

import base64
import logging
import os
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import httpx

from autosales.channels.base import BaseChannel, EmailMessage

logger = logging.getLogger("autosales.channels.gmail")

_GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1"
_TOKEN_URL = "https://oauth2.googleapis.com/token"


class GmailChannel(BaseChannel):
    """Email channel using the Google Gmail API with OAuth2.

    Environment variables:
        GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
    """

    def __init__(self) -> None:
        self._client_id = os.environ.get("GMAIL_CLIENT_ID", "")
        self._client_secret = os.environ.get("GMAIL_CLIENT_SECRET", "")
        self._refresh_token = os.environ.get("GMAIL_REFRESH_TOKEN", "")
        self._access_token: str | None = None
        self._token_expires: datetime | None = None

    async def fetch_new_messages(self) -> list[EmailMessage]:
        """Fetch unread messages from the Gmail inbox."""
        token = await self._ensure_token()
        messages: list[EmailMessage] = []

        # List unread message IDs
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{_GMAIL_BASE}/users/me/messages",
                params={"q": "is:unread", "maxResults": "50"},
                headers={"Authorization": f"Bearer {token}"},
                timeout=30.0,
            )
            resp.raise_for_status()
            msg_list = resp.json().get("messages", [])

        # Fetch each message's full payload
        async with httpx.AsyncClient() as client:
            for msg_stub in msg_list:
                msg_id = msg_stub["id"]
                resp = await client.get(
                    f"{_GMAIL_BASE}/users/me/messages/{msg_id}",
                    params={"format": "full"},
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30.0,
                )
                if resp.status_code != 200:
                    continue
                data = resp.json()
                messages.append(self._parse_message(data))

        return messages

    async def send_message(
        self,
        to: str,
        subject: str,
        body: str,
        attachments: list[dict[str, Any]] | None = None,
    ) -> bool:
        """Send an email via the Gmail API."""
        token = await self._ensure_token()

        msg = MIMEMultipart()
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain", "utf-8"))

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{_GMAIL_BASE}/users/me/messages/send",
                    json={"raw": raw},
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    timeout=30.0,
                )
                resp.raise_for_status()
            logger.info("[gmail] Sent email to %s: %s", to, subject)
            return True
        except Exception:
            logger.exception("[gmail] Failed to send email to %s", to)
            return False

    async def check_health(self) -> bool:
        """Verify Gmail API access."""
        try:
            token = await self._ensure_token()
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{_GMAIL_BASE}/users/me/profile",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10.0,
                )
                return resp.status_code == 200
        except Exception:
            logger.exception("[gmail] Health check failed")
            return False

    # ------------------------------------------------------------------
    # OAuth2 token management
    # ------------------------------------------------------------------

    async def _ensure_token(self) -> str:
        """Refresh the access token using the stored refresh token."""
        if (
            self._access_token
            and self._token_expires
            and datetime.now(timezone.utc) < self._token_expires
        ):
            return self._access_token

        data = {
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "refresh_token": self._refresh_token,
            "grant_type": "refresh_token",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(_TOKEN_URL, data=data, timeout=15.0)
            resp.raise_for_status()
            token_data = resp.json()

        self._access_token = token_data["access_token"]
        expires_in = token_data.get("expires_in", 3600)
        from datetime import timedelta

        self._token_expires = datetime.now(timezone.utc) + timedelta(seconds=expires_in - 60)
        logger.debug("[gmail] Refreshed access token (expires in %ds)", expires_in)
        return self._access_token

    # ------------------------------------------------------------------
    # Parsing helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_message(data: dict[str, Any]) -> EmailMessage:
        """Parse a Gmail API message resource into an EmailMessage."""
        headers = {h["name"].lower(): h["value"] for h in data.get("payload", {}).get("headers", [])}

        # Extract body
        body = ""
        html_body = None
        payload = data.get("payload", {})

        def _extract_parts(parts: list[dict]) -> None:
            nonlocal body, html_body
            for part in parts:
                mime = part.get("mimeType", "")
                if mime == "text/plain" and not body:
                    raw = part.get("body", {}).get("data", "")
                    if raw:
                        body = base64.urlsafe_b64decode(raw).decode("utf-8", errors="replace")
                elif mime == "text/html" and not html_body:
                    raw = part.get("body", {}).get("data", "")
                    if raw:
                        html_body = base64.urlsafe_b64decode(raw).decode("utf-8", errors="replace")
                if "parts" in part:
                    _extract_parts(part["parts"])

        if "parts" in payload:
            _extract_parts(payload["parts"])
        else:
            raw = payload.get("body", {}).get("data", "")
            if raw:
                body = base64.urlsafe_b64decode(raw).decode("utf-8", errors="replace")

        received_at = None
        date_str = headers.get("date", "")
        if date_str:
            try:
                from email.utils import parsedate_to_datetime

                received_at = parsedate_to_datetime(date_str)
                if received_at.tzinfo is None:
                    received_at = received_at.replace(tzinfo=timezone.utc)
            except Exception:
                received_at = datetime.now(timezone.utc)

        return EmailMessage(
            from_addr=headers.get("from", ""),
            to_addr=headers.get("to", ""),
            subject=headers.get("subject", ""),
            body=body,
            html_body=html_body,
            received_at=received_at,
            message_id=headers.get("message-id", data.get("id", "")),
        )
