"""Model router -- resolves ``"provider/model"`` references and dispatches
completion requests to the right provider with automatic fallback.

Inspired by OpenClaw's ``model-selection.ts``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from autosales.providers.auth_profiles import AuthProfileStore
from autosales.providers.base import (
    AuthType,
    LLMRequest,
    LLMResponse,
)
from autosales.providers.config import get_config, resolve_model_alias
from autosales.providers.registry import ProviderRegistry, get_registry

logger = logging.getLogger("autosales.providers.router")


# ---------------------------------------------------------------------------
# Usage tracker
# ---------------------------------------------------------------------------

@dataclass
class UsageRecord:
    """Accumulated usage for a single session / router instance."""
    total_requests: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0
    total_latency_ms: int = 0

    def record(self, resp: LLMResponse) -> None:
        self.total_requests += 1
        self.total_input_tokens += resp.input_tokens
        self.total_output_tokens += resp.output_tokens
        self.total_cost_usd += resp.cost_usd
        self.total_latency_ms += resp.latency_ms

    def to_dict(self) -> dict:
        return {
            "total_requests": self.total_requests,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_cost_usd": round(self.total_cost_usd, 6),
            "total_latency_ms": self.total_latency_ms,
        }


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

class ModelRouter:
    """Resolve model references and dispatch completions with fallback.

    Model references use the ``"provider/model"`` convention::

        "openai/gpt-4o"
        "anthropic/claude-sonnet-4-6"
        "openai-codex/gpt-4o"
        "gpt-4o"  # uses default provider

    If the primary provider fails the router walks through the configured
    fallback chain.
    """

    def __init__(
        self,
        registry: ProviderRegistry | None = None,
        auth_store: AuthProfileStore | None = None,
        fallback_chain: list[str] | None = None,
    ) -> None:
        self._registry = registry or get_registry()
        self._auth_store = auth_store or AuthProfileStore()
        cfg = get_config()
        self._fallback_chain = fallback_chain or cfg.fallback_chain
        self._config = cfg
        self.usage = UsageRecord()

    # ------------------------------------------------------------------
    # Model resolution
    # ------------------------------------------------------------------

    def resolve_model(self, model_ref: str) -> tuple[str, str]:
        """Parse a model reference into ``(provider_id, model_id)``.

        Supports:
          * ``"provider/model"`` -- explicit
          * ``"model"``          -- uses the default provider
        """
        if "/" in model_ref:
            parts = model_ref.split("/", 1)
            provider_id = parts[0]
            model_id = resolve_model_alias(parts[1])
            return provider_id, model_id

        # No provider prefix -- use default
        model_id = resolve_model_alias(model_ref)
        default_pid = self._registry.default_provider_id
        return default_pid, model_id

    # ------------------------------------------------------------------
    # Completion (with retry + fallback)
    # ------------------------------------------------------------------

    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Route *request* to the appropriate provider.

        1. Resolve provider + model from ``request.model``.
        2. Load credential from auth store.
        3. Refresh OAuth if needed.
        4. Call ``provider.complete()``.
        5. On failure, walk the fallback chain.
        """
        model_ref = request.model or self._config.default_models.get(
            self._registry.default_provider_id, "gpt-4o"
        )
        primary_pid, model_id = self.resolve_model(model_ref)

        # Build ordered list: primary first, then fallback chain (deduplicated)
        candidates = [primary_pid]
        for pid in self._fallback_chain:
            if pid not in candidates:
                candidates.append(pid)

        last_error: Exception | None = None

        for pid in candidates:
            try:
                provider = self._registry.get_provider(pid)
            except KeyError:
                logger.warning("Fallback provider '%s' not registered -- skipping", pid)
                continue

            credential = self._auth_store.get_credential(pid)
            if credential is None:
                logger.warning("No credential for provider '%s' -- skipping", pid)
                continue

            # Auto-refresh OAuth tokens
            if (
                credential.auth_type == AuthType.OAUTH
                and credential.is_expired
                and credential.refresh_token
            ):
                try:
                    credential = await provider.refresh_auth(credential)
                    self._auth_store.save_credential(credential)
                except Exception as exc:
                    logger.warning("Token refresh failed for %s: %s", pid, exc)
                    continue

            # Attempt completion
            try:
                req = LLMRequest(
                    system_prompt=request.system_prompt,
                    user_message=request.user_message,
                    model=model_id,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens,
                    json_mode=request.json_mode,
                    stream=request.stream,
                )
                resp = await provider.complete(req, credential)
                self.usage.record(resp)
                return resp

            except Exception as exc:
                last_error = exc
                logger.warning(
                    "Provider %s failed for model %s: %s -- trying next",
                    pid, model_id, exc,
                )
                continue

        raise RuntimeError(
            f"All providers failed for model '{model_ref}'. "
            f"Tried: {candidates}. Last error: {last_error}"
        )

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    def list_all_models(self) -> list[dict]:
        """Return a flat list of every model across all providers."""
        models = []
        for provider in self._registry.list_providers():
            for m in provider.get_models():
                models.append({
                    "provider_id": m.provider_id,
                    "model_id": m.id,
                    "name": m.name,
                    "context_window": m.context_window,
                    "cost_input_per_1m": m.cost_input_per_1m,
                    "cost_output_per_1m": m.cost_output_per_1m,
                })
        return models
