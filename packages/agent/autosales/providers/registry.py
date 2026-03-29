"""Provider registry -- singleton that tracks all available LLM providers.

Modelled after OpenClaw's plugin-registration pattern: each provider
``register``s itself with the global registry, and callers look them up by
``provider_id``.  Built-in providers are auto-registered on first import.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from autosales.providers.base import BaseProvider

logger = logging.getLogger("autosales.providers.registry")


class ProviderRegistry:
    """Singleton registry of :class:`BaseProvider` instances."""

    _instance: Optional[ProviderRegistry] = None
    _providers: dict[str, BaseProvider]

    def __new__(cls) -> ProviderRegistry:
        if cls._instance is None:
            inst = super().__new__(cls)
            inst._providers = {}
            cls._instance = inst
        return cls._instance

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def register(self, provider: BaseProvider) -> None:
        """Add *provider* to the registry (idempotent)."""
        if provider.id in self._providers:
            logger.debug("Provider %s already registered -- skipping", provider.id)
            return
        self._providers[provider.id] = provider
        logger.debug("Registered provider: %s (%s)", provider.id, provider.label)

    def get_provider(self, provider_id: str) -> BaseProvider:
        """Look up a provider by id.  Raises ``KeyError`` if not found."""
        try:
            return self._providers[provider_id]
        except KeyError:
            available = ", ".join(sorted(self._providers)) or "(none)"
            raise KeyError(
                f"Unknown provider '{provider_id}'. Available: {available}"
            ) from None

    def list_providers(self) -> list[BaseProvider]:
        """Return all registered providers (insertion order)."""
        return list(self._providers.values())

    def list_provider_ids(self) -> list[str]:
        """Return ids of all registered providers."""
        return list(self._providers.keys())

    @property
    def default_provider_id(self) -> str:
        """The provider to use when no explicit prefix is given.

        Read from ``DEFAULT_LLM_PROVIDER`` env (falls back to ``"anthropic"``).
        """
        pid = os.environ.get("DEFAULT_LLM_PROVIDER", "anthropic").lower()
        if pid not in self._providers:
            # fall back to first registered
            if self._providers:
                return next(iter(self._providers))
            return pid
        return pid

    def get_default_provider(self) -> BaseProvider:
        """Convenience: resolve the default provider."""
        return self.get_provider(self.default_provider_id)

    # ------------------------------------------------------------------
    # Reset (useful for testing)
    # ------------------------------------------------------------------

    def _reset(self) -> None:
        """Clear all registrations (test helper)."""
        self._providers.clear()


# ---------------------------------------------------------------------------
# Auto-register built-in providers
# ---------------------------------------------------------------------------

def _auto_register() -> None:
    """Import and register the three built-in providers."""
    from autosales.providers.anthropic_provider import AnthropicProvider
    from autosales.providers.openai_codex_provider import OpenAICodexProvider
    from autosales.providers.openai_provider import OpenAIProvider

    registry = ProviderRegistry()
    registry.register(AnthropicProvider())
    registry.register(OpenAIProvider())
    registry.register(OpenAICodexProvider())


_auto_register()


def get_registry() -> ProviderRegistry:
    """Return the global :class:`ProviderRegistry` singleton."""
    return ProviderRegistry()
