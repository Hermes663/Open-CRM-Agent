"""Outlook / Microsoft 365 email channel via the Microsoft Graph API."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx

from autosales.channels.base import BaseChannel, EmailMessage

logger = logging.getLogger("autosales.channels.outlook")

_GRAPH_BASE = "https://graph.microsoft.com/v1.0"
_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"


class OutlookChannel(BaseChannel):
    """Email channel using the Microsoft Graph API with client credentials (OAuth2).

    Environment variables:
        OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_TENANT_ID, OUTLOOK_USER_EMAIL
    """

    def __init__(self) -> None:
        self._client_id = os.environ.get("OUTLOOK_CLIENT_ID", "")
        self._client_secret = os.environ.get("OUTLOOK_CLIENT_SECRET", "")
        self._tenant_id = os.environ.get("OUTLOOK_TENANT_ID", "")
        self._user_email = os.environ.get("OUTLOOK_USER_EMAIL", "")
        self._access_token: str | None = None
        self._token_expires: datetime | None = None

    async def fetch_new_messages(self) -> list[EmailMessage]:
        """Fetch unread messages from Outlook inbox."""
        token = await self._ensure_token()
        messages: list[EmailMessage] = []

        url = f"{_GRAPH_BASE}/users/{self._user_email}/mailFolders/inbox/messages"
        params = {
            "$filter": "isRead eq false",
            "$top": "50",
            "$orderby": "receivedDateTime desc",
            "$select": "from,toRecipients,subject,body,receivedDateTime,internetMessageId",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url,
                params=params,
                headers={"Authorization": f"Bearer {token}"},
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()

        for item in data.get("value", []):
            received = None
            if item.get("receivedDateTime"):
                try:
                    received = datetime.fromisoformat(
                        item["receivedDateTime"].replace("Z", "+00:00")
                    )
                except ValueError:
                    received = datetime.now(timezone.utc)

            from_addr = (
                item.get("from", {}).get("emailAddress", {}).get("address", "")
            )
            to_addrs = [
                r.get("emailAddress", {}).get("address", "")
                for r in item.get("toRecipients", [])
            ]

            body_obj = item.get("body", {})
            messages.append(
                EmailMessage(
                    from_addr=from_addr,
                    to_addr=to_addrs[0] if to_addrs else self._user_email,
                    subject=item.get("subject", ""),
                    body=body_obj.get("content", ""),
                    html_body=body_obj.get("content", "") if body_obj.get("contentType") == "html" else None,
                    received_at=received,
                    message_id=item.get("internetMessageId", ""),
                )
            )
        return messages

    async def send_message(
        self,
        to: str,
        subject: str,
        body: str,
        attachments: list[dict[str, Any]] | None = None,
    ) -> bool:
        """Send an email via Microsoft Graph."""
        token = await self._ensure_token()
        url = f"{_GRAPH_BASE}/users/{self._user_email}/sendMail"
        payload: dict[str, Any] = {
            "message": {
                "subject": subject,
                "body": {"contentType": "Text", "content": body},
                "toRecipients": [{"emailAddress": {"address": to}}],
            },
            "saveToSentItems": True,
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    timeout=30.0,
                )
                resp.raise_for_status()
            logger.info("[outlook] Sent email to %s: %s", to, subject)
            return True
        except Exception:
            logger.exception("[outlook] Failed to send email to %s", to)
            return False

    async def check_health(self) -> bool:
        """Check that we can authenticate and reach the Graph API."""
        try:
            token = await self._ensure_token()
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{_GRAPH_BASE}/users/{self._user_email}",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10.0,
                )
                return resp.status_code == 200
        except Exception:
            logger.exception("[outlook] Health check failed")
            return False

    # ------------------------------------------------------------------
    # OAuth2 token management
    # ------------------------------------------------------------------

    async def _ensure_token(self) -> str:
        """Obtain or refresh the access token using client credentials."""
        if self._access_token and self._token_expires and datetime.now(timezone.utc) < self._token_expires:
            return self._access_token

        url = _TOKEN_URL.format(tenant=self._tenant_id)
        data = {
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(url, data=data, timeout=15.0)
            resp.raise_for_status()
            token_data = resp.json()

        self._access_token = token_data["access_token"]
        expires_in = token_data.get("expires_in", 3600)
        from datetime import timedelta
        self._token_expires = datetime.now(timezone.utc) + timedelta(seconds=expires_in - 60)

        logger.debug("[outlook] Obtained access token (expires in %ds)", expires_in)
        return self._access_token
