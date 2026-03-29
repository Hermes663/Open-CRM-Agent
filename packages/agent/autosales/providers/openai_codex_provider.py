"""OpenAI Codex OAuth provider -- ChatGPT subscription-based access.

This provider authenticates via OAuth 2.0 against the ChatGPT/Codex
backend, allowing users with a Plus or Pro subscription to access models
without per-token billing.

The OAuth flow:
  1. Build an authorization URL and open the user's browser.
  2. The user logs into ChatGPT and authorises the client.
  3. A local callback server receives the authorization code.
  4. The code is exchanged for ``access_token`` + ``refresh_token``.
  5. Tokens are persisted in the auth-profile store.
  6. Tokens are refreshed automatically before expiry.

NOTE: The actual ChatGPT OAuth endpoints and client IDs are not publicly
documented -- the values below are *realistic placeholders* that match the
general OAuth 2.0 / OIDC shape.  Swap them for the real ones once available.
"""

from __future__ import annotations

import base64
import json as _json
import logging
import os
import secrets
import time
from typing import Any, Optional
from urllib.parse import urlencode

import httpx

from autosales.providers.base import (
    AuthCredential,
    AuthType,
    BaseProvider,
    LLMRequest,
    LLMResponse,
    ModelConfig,
)
from autosales.providers.config import OPENAI_CODEX_MODELS, get_config, resolve_model_alias

logger = logging.getLogger("autosales.providers.openai_codex")

# ---------------------------------------------------------------------------
# OAuth constants (realistic placeholders)
# ---------------------------------------------------------------------------
_OAUTH_AUTHORIZE_URL = "https://auth.openai.com/authorize"
_OAUTH_TOKEN_URL = "https://auth.openai.com/oauth/token"
_OAUTH_USERINFO_URL = "https://api.openai.com/v1/me"
_CODEX_API_BASE = "https://api.openai.com/v1"  # same base, different auth

_DEFAULT_SCOPES = "openid profile email model.request model.read"
_TOKEN_EXPIRY_BUFFER = 300  # refresh 5 min before actual expiry


class OpenAICodexProvider(BaseProvider):
    """Provider plugin for OpenAI Codex (ChatGPT subscription, OAuth auth).

    When OAuth tokens are unavailable the provider can optionally fall back
    to a standard API key (set via ``OPENAI_API_KEY``), so the same models
    remain accessible in CI / server environments.
    """

    # ------------------------------------------------------------------
    # Identity
    # ------------------------------------------------------------------

    @property
    def id(self) -> str:
        return "openai-codex"

    @property
    def label(self) -> str:
        return "OpenAI Codex"

    @property
    def auth_type(self) -> AuthType:
        return AuthType.OAUTH

    @property
    def env_vars(self) -> list[str]:
        return [
            "CODEX_OAUTH_CLIENT_ID",
            "CODEX_OAUTH_REDIRECT_URI",
            "OPENAI_API_KEY",  # fallback
        ]

    # ------------------------------------------------------------------
    # Models
    # ------------------------------------------------------------------

    def get_models(self) -> list[ModelConfig]:
        return list(OPENAI_CODEX_MODELS)

    # ------------------------------------------------------------------
    # OAuth flow helpers
    # ------------------------------------------------------------------

    def build_authorization_url(
        self,
        client_id: Optional[str] = None,
        redirect_uri: Optional[str] = None,
        state: Optional[str] = None,
    ) -> tuple[str, str]:
        """Return ``(url, state)`` -- the URL to open in the user's browser.

        The *state* parameter is a CSRF token that **must** be verified in the
        callback.
        """
        cfg = get_config()
        cid = client_id or cfg.codex_client_id or os.environ.get("CODEX_OAUTH_CLIENT_ID", "")
        ruri = redirect_uri or cfg.codex_redirect_uri
        st = state or secrets.token_urlsafe(32)

        params = {
            "response_type": "code",
            "client_id": cid,
            "redirect_uri": ruri,
            "scope": _DEFAULT_SCOPES,
            "state": st,
        }
        url = f"{_OAUTH_AUTHORIZE_URL}?{urlencode(params)}"
        return url, st

    async def exchange_code(
        self,
        code: str,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        redirect_uri: Optional[str] = None,
    ) -> AuthCredential:
        """Exchange an authorization *code* for access + refresh tokens."""
        cfg = get_config()
        cid = client_id or cfg.codex_client_id or os.environ.get("CODEX_OAUTH_CLIENT_ID", "")
        csec = client_secret or os.environ.get("CODEX_OAUTH_CLIENT_SECRET", "")
        ruri = redirect_uri or cfg.codex_redirect_uri

        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": cid,
            "client_secret": csec,
            "redirect_uri": ruri,
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(_OAUTH_TOKEN_URL, data=payload)
            resp.raise_for_status()
            data = resp.json()

        access_token: str = data["access_token"]
        refresh_token: str = data.get("refresh_token", "")
        expires_in: int = data.get("expires_in", 3600)
        expires_at = time.time() + expires_in

        # Decode identity from the JWT access token (or id_token)
        email, display_name = self._decode_jwt_identity(
            data.get("id_token", access_token)
        )

        credential = AuthCredential(
            provider_id=self.id,
            auth_type=AuthType.OAUTH,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            email=email,
            display_name=display_name,
        )

        logger.info(
            "Codex OAuth: obtained tokens for %s (expires in %ds)",
            email or "unknown",
            expires_in,
        )
        return credential

    async def refresh_auth(self, credential: AuthCredential) -> AuthCredential:
        """Use the refresh token to obtain a fresh access token."""
        if not credential.refresh_token:
            logger.warning("Codex OAuth: no refresh_token -- cannot refresh")
            return credential

        cfg = get_config()
        cid = cfg.codex_client_id or os.environ.get("CODEX_OAUTH_CLIENT_ID", "")
        csec = os.environ.get("CODEX_OAUTH_CLIENT_SECRET", "")

        payload = {
            "grant_type": "refresh_token",
            "refresh_token": credential.refresh_token,
            "client_id": cid,
            "client_secret": csec,
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(_OAUTH_TOKEN_URL, data=payload)
            resp.raise_for_status()
            data = resp.json()

        credential.access_token = data["access_token"]
        credential.refresh_token = data.get("refresh_token", credential.refresh_token)
        expires_in = data.get("expires_in", 3600)
        credential.expires_at = time.time() + expires_in

        logger.info("Codex OAuth: refreshed token (expires in %ds)", expires_in)
        return credential

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    async def authenticate(self, credential: AuthCredential) -> bool:
        """Verify the credential is usable.

        For OAuth credentials the access token is validated; for the API-key
        fallback the key is tested against ``/models``.
        """
        token = self._resolve_bearer(credential)
        if not token:
            raise ValueError("No Codex OAuth token or OPENAI_API_KEY fallback available")

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{_CODEX_API_BASE}/models",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
        return True

    # ------------------------------------------------------------------
    # Completion
    # ------------------------------------------------------------------

    async def complete(
        self,
        request: LLMRequest,
        credential: AuthCredential,
    ) -> LLMResponse:
        # Auto-refresh if close to expiry
        if credential.auth_type == AuthType.OAUTH and self._needs_refresh(credential):
            credential = await self.refresh_auth(credential)

        token = self._resolve_bearer(credential)
        if not token:
            raise ValueError("No Codex OAuth token or API-key fallback")

        cfg = get_config()
        model = resolve_model_alias(
            request.model or cfg.default_models.get("openai-codex", "gpt-4o")
        )

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": request.system_prompt},
            {"role": "user", "content": request.user_message},
        ]

        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        }

        if request.json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        t0 = time.monotonic()

        async with httpx.AsyncClient(timeout=cfg.request_timeout) as client:
            resp = await client.post(
                f"{_CODEX_API_BASE}/chat/completions",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()

        data = resp.json()
        latency_ms = int((time.monotonic() - t0) * 1000)

        choice = data["choices"][0]
        content = choice["message"]["content"] or ""
        finish_reason = choice.get("finish_reason", "stop")
        usage = data.get("usage", {})
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)

        # Codex subscription = zero marginal cost
        cost = 0.0

        logger.info(
            "[codex] %s | %d in + %d out | %dms | auth=%s",
            model,
            input_tokens,
            output_tokens,
            latency_ms,
            credential.auth_type.value,
        )

        return LLMResponse(
            content=content,
            model=model,
            provider_id=self.id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            finish_reason=finish_reason,
            latency_ms=latency_ms,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_bearer(self, credential: AuthCredential) -> str:
        """Return the best available bearer token string."""
        if credential.access_token:
            return credential.access_token
        if credential.api_key:
            return credential.api_key
        return os.environ.get("OPENAI_API_KEY", "")

    @staticmethod
    def _needs_refresh(credential: AuthCredential) -> bool:
        if credential.expires_at is None:
            return False
        return time.time() >= (credential.expires_at - _TOKEN_EXPIRY_BUFFER)

    @staticmethod
    def _decode_jwt_identity(token: str) -> tuple[Optional[str], Optional[str]]:
        """Best-effort decode of a JWT to extract ``email`` and ``name``.

        Does **not** verify the signature -- that's the token endpoint's job.
        Returns ``(email, display_name)``; both may be ``None``.
        """
        try:
            # JWT structure: header.payload.signature
            parts = token.split(".")
            if len(parts) < 2:
                return None, None

            # Add padding
            payload_b64 = parts[1]
            padding = 4 - len(payload_b64) % 4
            if padding != 4:
                payload_b64 += "=" * padding

            payload_bytes = base64.urlsafe_b64decode(payload_b64)
            claims = _json.loads(payload_bytes)

            email = claims.get("email")
            name = claims.get("name") or claims.get("preferred_username")
            return email, name
        except Exception:
            return None, None
