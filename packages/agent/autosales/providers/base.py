"""Base provider interfaces for the AutoSales LLM provider plugin system.

Inspired by OpenClaw's ProviderPlugin architecture -- defines the contract
that every LLM provider must implement plus the shared data types used
across the routing, auth, and registry layers.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncIterator, Optional


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class AuthType(Enum):
    """How a provider authenticates requests."""

    API_KEY = "api_key"
    OAUTH = "oauth"
    TOKEN = "token"


class FinishReason(Enum):
    """Why the model stopped generating."""

    STOP = "stop"
    LENGTH = "length"
    CONTENT_FILTER = "content_filter"
    ERROR = "error"


# ---------------------------------------------------------------------------
# Data-transfer objects
# ---------------------------------------------------------------------------

@dataclass
class AuthCredential:
    """Stored credential -- API key **or** OAuth tokens.

    A single credential belongs to exactly one ``provider_id`` and carries
    either an ``api_key`` (for API-key auth) or an ``access_token`` /
    ``refresh_token`` pair (for OAuth flows such as OpenAI Codex).
    """

    provider_id: str
    auth_type: AuthType

    # --- API-key auth ---
    api_key: Optional[str] = None

    # --- OAuth auth (Codex, future providers) ---
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_at: Optional[float] = None  # Unix timestamp
    email: Optional[str] = None
    display_name: Optional[str] = None

    # --- Metadata ---
    created_at: Optional[float] = field(default_factory=time.time)

    # ------------------------------------------------------------------

    @property
    def is_expired(self) -> bool:
        """Return ``True`` when the access token has passed its TTL."""
        if self.expires_at is None:
            return False
        return time.time() >= self.expires_at

    def to_dict(self) -> dict:
        """Serialise to a plain dictionary (safe for JSON storage)."""
        return {
            "provider_id": self.provider_id,
            "auth_type": self.auth_type.value,
            "api_key": self.api_key,
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
            "expires_at": self.expires_at,
            "email": self.email,
            "display_name": self.display_name,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> AuthCredential:
        """Deserialise from a plain dictionary."""
        return cls(
            provider_id=data["provider_id"],
            auth_type=AuthType(data["auth_type"]),
            api_key=data.get("api_key"),
            access_token=data.get("access_token"),
            refresh_token=data.get("refresh_token"),
            expires_at=data.get("expires_at"),
            email=data.get("email"),
            display_name=data.get("display_name"),
            created_at=data.get("created_at"),
        )


@dataclass
class ModelConfig:
    """Static metadata for a single model offered by a provider."""

    id: str                          # e.g. "gpt-4o", "claude-sonnet-4-6"
    provider_id: str                 # e.g. "openai", "openai-codex", "anthropic"
    name: str                        # Human-readable display name
    context_window: int = 128_000
    max_tokens: int = 4_096
    supports_json: bool = True
    supports_vision: bool = False
    supports_streaming: bool = True
    cost_input_per_1m: float = 0.0   # USD per 1 M input tokens
    cost_output_per_1m: float = 0.0  # USD per 1 M output tokens


@dataclass
class LLMRequest:
    """Provider-agnostic request payload."""

    system_prompt: str
    user_message: str
    model: Optional[str] = None
    temperature: float = 0.3
    max_tokens: int = 4_096
    json_mode: bool = False
    stream: bool = False


@dataclass
class LLMResponse:
    """Provider-agnostic response payload."""

    content: str
    model: str
    provider_id: str
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    finish_reason: str = "stop"
    latency_ms: int = 0


# ---------------------------------------------------------------------------
# Abstract provider
# ---------------------------------------------------------------------------

class BaseProvider(ABC):
    """Contract that every LLM provider plugin must satisfy.

    Modelled after OpenClaw's ``ProviderPlugin`` -- each concrete provider
    exposes its identity, auth requirements, model catalogue, and a
    ``complete()`` method that performs the actual inference call.
    """

    @property
    @abstractmethod
    def id(self) -> str:
        """Unique short identifier -- ``"openai"``, ``"openai-codex"``, ``"anthropic"``."""
        ...

    @property
    @abstractmethod
    def label(self) -> str:
        """Human-readable label -- ``"OpenAI"``, ``"OpenAI Codex"``, ``"Anthropic"``."""
        ...

    @property
    @abstractmethod
    def auth_type(self) -> AuthType:
        """Primary authentication mechanism for this provider."""
        ...

    @property
    @abstractmethod
    def env_vars(self) -> list[str]:
        """Environment variable names that can supply credentials."""
        ...

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------

    @abstractmethod
    async def authenticate(self, credential: AuthCredential) -> bool:
        """Validate that *credential* grants access to the provider.

        Returns ``True`` on success; raises on hard failures.
        """
        ...

    @abstractmethod
    async def complete(
        self,
        request: LLMRequest,
        credential: AuthCredential,
    ) -> LLMResponse:
        """Execute a chat-completion request and return the response."""
        ...

    @abstractmethod
    def get_models(self) -> list[ModelConfig]:
        """Return the static catalogue of models this provider offers."""
        ...

    # ------------------------------------------------------------------
    # Optional hooks
    # ------------------------------------------------------------------

    async def refresh_auth(self, credential: AuthCredential) -> AuthCredential:
        """Refresh an expiring credential (OAuth providers override this)."""
        return credential

    async def check_health(self, credential: AuthCredential) -> bool:
        """Quick liveness probe -- returns ``True`` if the provider is reachable."""
        try:
            return await self.authenticate(credential)
        except Exception:
            return False

    def get_default_model(self) -> str:
        """Return the recommended default model id for this provider."""
        models = self.get_models()
        return models[0].id if models else ""

    def calculate_cost(
        self,
        model_id: str,
        input_tokens: int,
        output_tokens: int,
    ) -> float:
        """Compute the USD cost for a given usage on *model_id*."""
        for m in self.get_models():
            if m.id == model_id:
                return (
                    input_tokens * m.cost_input_per_1m / 1_000_000
                    + output_tokens * m.cost_output_per_1m / 1_000_000
                )
        return 0.0
