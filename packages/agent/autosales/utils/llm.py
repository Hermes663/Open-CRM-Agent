"""Unified LLM client abstraction -- now backed by the provider plugin system.

Maintains backward compatibility with the original ``LLMClient.call()``
interface used throughout the agent codebase while delegating all work to
:class:`~autosales.providers.router.ModelRouter`.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

logger = logging.getLogger("autosales.utils.llm")

# Retry configuration (kept for backward compat)
_MAX_RETRIES = 3
_BASE_DELAY = 1.0  # seconds


class LLMClient:
    """Provider-agnostic wrapper for calling any registered LLM provider.

    The active provider is selected via the ``LLM_PROVIDER`` environment
    variable (``anthropic``, ``openai``, ``openai-codex``).  A specific
    model can be pinned via ``LLM_MODEL`` or by using the ``model``
    parameter on :meth:`call`.

    Model references support the ``"provider/model"`` format::

        client = LLMClient()
        await client.call(system, user, model="openai/gpt-4o")
        await client.call(system, user, model="anthropic/claude-sonnet-4-6")
        await client.call(system, user)  # uses defaults
    """

    def __init__(self) -> None:
        from autosales.providers.router import ModelRouter

        self._router = ModelRouter()
        self._total_input_tokens = 0
        self._total_output_tokens = 0
        self._total_calls = 0
        self._total_cost_usd = 0.0

    # ------------------------------------------------------------------
    # Main entry-point (backward-compatible)
    # ------------------------------------------------------------------

    async def call(
        self,
        system_prompt: str,
        user_message: str,
        json_mode: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        model: str | None = None,
        stream: bool = False,
    ) -> str:
        """Send a chat completion request to the configured LLM.

        Args:
            system_prompt: System / instruction message.
            user_message: The user turn.
            json_mode: If True, request structured JSON output.
            temperature: Sampling temperature.
            max_tokens: Maximum response tokens.
            model: Optional model reference (``"provider/model"`` or just
                ``"model"``).  Falls back to ``LLM_MODEL`` env, then to the
                provider's default.
            stream: If True, use streaming transport (result is still
                the complete string).

        Returns:
            The assistant's response text.

        Raises:
            RuntimeError: After exhausting all retries.
        """
        from autosales.providers.base import LLMRequest

        effective_model = model or os.environ.get("LLM_MODEL")

        request = LLMRequest(
            system_prompt=system_prompt,
            user_message=user_message,
            model=effective_model,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
            stream=stream,
        )

        last_error: Exception | None = None

        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                response = await self._router.complete(request)

                self._total_input_tokens += response.input_tokens
                self._total_output_tokens += response.output_tokens
                self._total_cost_usd += response.cost_usd
                self._total_calls += 1

                logger.info(
                    "[llm] %s/%s | %d in + %d out | $%.6f | %dms",
                    response.provider_id,
                    response.model,
                    response.input_tokens,
                    response.output_tokens,
                    response.cost_usd,
                    response.latency_ms,
                )
                return response.content

            except Exception as exc:
                last_error = exc
                delay = _BASE_DELAY * (2 ** (attempt - 1))
                logger.warning(
                    "[llm] Attempt %d/%d failed (%s). Retrying in %.1fs",
                    attempt,
                    _MAX_RETRIES,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)

        raise RuntimeError(f"LLM call failed after {_MAX_RETRIES} attempts: {last_error}")

    # ------------------------------------------------------------------
    # Extended API (new)
    # ------------------------------------------------------------------

    async def complete(
        self,
        system_prompt: str,
        user_message: str,
        *,
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        json_mode: bool = False,
        stream: bool = False,
    ) -> "LLMResponse":
        """Like :meth:`call` but returns the full :class:`LLMResponse`."""
        from autosales.providers.base import LLMRequest, LLMResponse

        effective_model = model or os.environ.get("LLM_MODEL")

        request = LLMRequest(
            system_prompt=system_prompt,
            user_message=user_message,
            model=effective_model,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
            stream=stream,
        )
        return await self._router.complete(request)

    # ------------------------------------------------------------------
    # Stats (backward-compatible)
    # ------------------------------------------------------------------

    @property
    def stats(self) -> dict[str, Any]:
        """Cumulative token, call, and cost counts."""
        return {
            "total_calls": self._total_calls,
            "total_input_tokens": self._total_input_tokens,
            "total_output_tokens": self._total_output_tokens,
            "total_cost_usd": round(self._total_cost_usd, 6),
        }

    @property
    def router(self) -> "ModelRouter":
        """Expose the underlying :class:`ModelRouter` for advanced usage."""
        return self._router
