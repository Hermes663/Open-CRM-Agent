"""Persistent auth-profile store (like OpenClaw's ``auth-profiles.json``).

Credentials are saved as JSON in ``~/.autosales/auth-profiles.json`` by
default.  API keys read from the environment are treated as implicit
credentials so callers never need to special-case "env vs stored".
"""

from __future__ import annotations

import base64
import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

from autosales.providers.base import AuthCredential, AuthType

logger = logging.getLogger("autosales.providers.auth_profiles")

_DEFAULT_DIR = Path.home() / ".autosales"
_DEFAULT_FILE = "auth-profiles.json"

# Env-var map: provider_id -> env var holding an API key
_ENV_KEY_MAP: dict[str, str] = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}


class AuthProfileStore:
    """Read / write auth credentials to a local JSON file.

    The store is intentionally simple -- production deployments would
    replace this with a secrets-manager backend.  For the MVP the file
    payload is base64-encoded (not encrypted) so it is at least not
    plain-text at rest.
    """

    def __init__(self, path: Optional[str | Path] = None) -> None:
        env_path = os.environ.get("AUTOSALES_AUTH_PROFILE_PATH")
        if path is not None:
            self._path = Path(path)
        elif env_path:
            self._path = Path(env_path)
        else:
            self._path = _DEFAULT_DIR / _DEFAULT_FILE

        self._profiles: dict[str, dict] = {}
        self._load()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def save_credential(self, credential: AuthCredential) -> None:
        """Persist *credential* (upsert by ``provider_id``)."""
        self._profiles[credential.provider_id] = credential.to_dict()
        self._flush()
        logger.info("Saved credential for provider %s", credential.provider_id)

    def get_credential(self, provider_id: str) -> Optional[AuthCredential]:
        """Return stored credential, falling back to environment variables."""
        # 1. Explicit stored profile
        raw = self._profiles.get(provider_id)
        if raw:
            return AuthCredential.from_dict(raw)

        # 2. Implicit from environment
        env_var = _ENV_KEY_MAP.get(provider_id)
        if env_var:
            api_key = os.environ.get(env_var)
            if api_key:
                return AuthCredential(
                    provider_id=provider_id,
                    auth_type=AuthType.API_KEY,
                    api_key=api_key,
                )

        return None

    def list_credentials(self) -> list[AuthCredential]:
        """Return all persisted credentials (does *not* include env-only ones)."""
        return [AuthCredential.from_dict(v) for v in self._profiles.values()]

    def delete_credential(self, provider_id: str) -> None:
        """Remove the stored credential for *provider_id*."""
        self._profiles.pop(provider_id, None)
        self._flush()
        logger.info("Deleted credential for provider %s", provider_id)

    @staticmethod
    def is_expired(credential: AuthCredential) -> bool:
        """Check whether the credential's access token has expired."""
        return credential.is_expired

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def _load(self) -> None:
        if not self._path.exists():
            self._profiles = {}
            return
        try:
            raw_bytes = self._path.read_bytes()
            decoded = base64.b64decode(raw_bytes)
            self._profiles = json.loads(decoded)
            logger.debug("Loaded %d auth profiles from %s", len(self._profiles), self._path)
        except Exception as exc:
            logger.warning("Failed to load auth profiles from %s: %s", self._path, exc)
            self._profiles = {}

    def _flush(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(self._profiles, indent=2, default=str)
        encoded = base64.b64encode(payload.encode())
        self._path.write_bytes(encoded)
        logger.debug("Flushed %d auth profiles to %s", len(self._profiles), self._path)
