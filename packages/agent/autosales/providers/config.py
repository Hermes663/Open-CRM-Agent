"""Provider configuration -- model definitions, costs, and runtime settings.

Configuration is loaded from environment variables and can be overridden by a
``.env`` file (handled upstream by ``python-dotenv``).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional

from autosales.providers.base import ModelConfig


# ---------------------------------------------------------------------------
# Model catalogues (updated prices as of 2025-Q2)
# ---------------------------------------------------------------------------

OPENAI_MODELS: list[ModelConfig] = [
    ModelConfig(
        id="gpt-4o",
        provider_id="openai",
        name="GPT-4o",
        context_window=128_000,
        max_tokens=16_384,
        supports_json=True,
        supports_vision=True,
        supports_streaming=True,
        cost_input_per_1m=2.50,
        cost_output_per_1m=10.00,
    ),
    ModelConfig(
        id="gpt-4o-mini",
        provider_id="openai",
        name="GPT-4o Mini",
        context_window=128_000,
        max_tokens=16_384,
        supports_json=True,
        supports_vision=True,
        supports_streaming=True,
        cost_input_per_1m=0.15,
        cost_output_per_1m=0.60,
    ),
    ModelConfig(
        id="gpt-4-turbo",
        provider_id="openai",
        name="GPT-4 Turbo",
        context_window=128_000,
        max_tokens=4_096,
        supports_json=True,
        supports_vision=True,
        supports_streaming=True,
        cost_input_per_1m=10.00,
        cost_output_per_1m=30.00,
    ),
    ModelConfig(
        id="o1",
        provider_id="openai",
        name="o1",
        context_window=200_000,
        max_tokens=100_000,
        supports_json=True,
        supports_vision=True,
        supports_streaming=True,
        cost_input_per_1m=15.00,
        cost_output_per_1m=60.00,
    ),
    ModelConfig(
        id="o3-mini",
        provider_id="openai",
        name="o3-mini",
        context_window=200_000,
        max_tokens=100_000,
        supports_json=True,
        supports_vision=False,
        supports_streaming=True,
        cost_input_per_1m=1.10,
        cost_output_per_1m=4.40,
    ),
]

OPENAI_CODEX_MODELS: list[ModelConfig] = [
    ModelConfig(
        id="gpt-4o",
        provider_id="openai-codex",
        name="GPT-4o (Codex)",
        context_window=128_000,
        max_tokens=16_384,
        supports_json=True,
        supports_vision=True,
        supports_streaming=True,
        cost_input_per_1m=0.0,  # included in subscription
        cost_output_per_1m=0.0,
    ),
    ModelConfig(
        id="o3-mini",
        provider_id="openai-codex",
        name="o3-mini (Codex)",
        context_window=200_000,
        max_tokens=100_000,
        supports_json=True,
        supports_vision=False,
        supports_streaming=True,
        cost_input_per_1m=0.0,
        cost_output_per_1m=0.0,
    ),
]

ANTHROPIC_MODELS: list[ModelConfig] = [
    ModelConfig(
        id="claude-sonnet-4-20250514",
        provider_id="anthropic",
        name="Claude Sonnet 4",
        context_window=200_000,
        max_tokens=16_384,
        supports_json=True,
        supports_vision=True,
        supports_streaming=True,
        cost_input_per_1m=3.00,
        cost_output_per_1m=15.00,
    ),
    ModelConfig(
        id="claude-opus-4-20250514",
        provider_id="anthropic",
        name="Claude Opus 4",
        context_window=200_000,
        max_tokens=16_384,
        supports_json=True,
        supports_vision=True,
        supports_streaming=True,
        cost_input_per_1m=15.00,
        cost_output_per_1m=75.00,
    ),
    ModelConfig(
        id="claude-haiku-4-20250514",
        provider_id="anthropic",
        name="Claude Haiku 4",
        context_window=200_000,
        max_tokens=8_192,
        supports_json=True,
        supports_vision=True,
        supports_streaming=True,
        cost_input_per_1m=0.80,
        cost_output_per_1m=4.00,
    ),
]

# Convenience short aliases -> canonical model ids
MODEL_ALIASES: dict[str, str] = {
    # OpenAI
    "gpt-4o": "gpt-4o",
    "gpt4o": "gpt-4o",
    "gpt-4o-mini": "gpt-4o-mini",
    "gpt4o-mini": "gpt-4o-mini",
    "gpt-4-turbo": "gpt-4-turbo",
    "o1": "o1",
    "o3-mini": "o3-mini",
    # Anthropic
    "claude-sonnet-4-6": "claude-sonnet-4-20250514",
    "claude-sonnet-4": "claude-sonnet-4-20250514",
    "claude-opus-4-6": "claude-opus-4-20250514",
    "claude-opus-4": "claude-opus-4-20250514",
    "claude-haiku-4-5": "claude-haiku-4-20250514",
    "claude-haiku-4": "claude-haiku-4-20250514",
    "sonnet": "claude-sonnet-4-20250514",
    "opus": "claude-opus-4-20250514",
    "haiku": "claude-haiku-4-20250514",
}


# ---------------------------------------------------------------------------
# Runtime configuration
# ---------------------------------------------------------------------------

@dataclass
class ProviderConfig:
    """Centralised runtime settings loaded from the environment."""

    # Default provider when model ref has no prefix
    default_provider: str = field(
        default_factory=lambda: os.environ.get("DEFAULT_LLM_PROVIDER", "anthropic")
    )

    # Default model per provider (overridable via env)
    default_models: dict[str, str] = field(default_factory=dict)

    # Fallback chain: try providers in this order when the primary fails
    fallback_chain: list[str] = field(
        default_factory=lambda: os.environ.get(
            "LLM_FALLBACK_CHAIN", "anthropic,openai"
        ).split(",")
    )

    # Base URLs for self-hosted / proxied deployments
    openai_base_url: str = field(
        default_factory=lambda: os.environ.get(
            "OPENAI_BASE_URL", "https://api.openai.com/v1"
        )
    )
    anthropic_base_url: str = field(
        default_factory=lambda: os.environ.get(
            "ANTHROPIC_BASE_URL", "https://api.anthropic.com"
        )
    )

    # OAuth settings for Codex
    codex_client_id: Optional[str] = field(
        default_factory=lambda: os.environ.get("CODEX_OAUTH_CLIENT_ID")
    )
    codex_redirect_uri: str = field(
        default_factory=lambda: os.environ.get(
            "CODEX_OAUTH_REDIRECT_URI", "http://localhost:9876/callback"
        )
    )

    # Auth profile storage path
    auth_profile_path: Optional[str] = field(
        default_factory=lambda: os.environ.get("AUTOSALES_AUTH_PROFILE_PATH")
    )

    # Retry / timeout
    max_retries: int = 3
    base_retry_delay: float = 1.0
    request_timeout: float = 120.0

    def __post_init__(self) -> None:
        if not self.default_models:
            self.default_models = {
                "openai": os.environ.get("OPENAI_MODEL", "gpt-4o"),
                "openai-codex": os.environ.get("CODEX_MODEL", "gpt-4o"),
                "anthropic": os.environ.get(
                    "ANTHROPIC_MODEL", "claude-sonnet-4-20250514"
                ),
            }


def resolve_model_alias(model_ref: str) -> str:
    """Expand a short alias to a canonical model id."""
    return MODEL_ALIASES.get(model_ref, model_ref)


def get_config() -> ProviderConfig:
    """Return a fresh :class:`ProviderConfig` read from the environment."""
    return ProviderConfig()
