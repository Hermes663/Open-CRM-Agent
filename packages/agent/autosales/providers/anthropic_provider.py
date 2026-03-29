"""Anthropic Claude provider -- direct HTTP via httpx (no SDK).

Keeps the provider layer SDK-free so every backend is implemented the same
way and the only hard dependency is ``httpx``.
"""

from __future__ import annotations

import json as _json
import logging
import os
import time
from typing import Any

import httpx

from autosales.providers.base import (
    AuthCredential,
    AuthType,
    BaseProvider,
    LLMRequest,
    LLMResponse,
    ModelConfig,
)
from autosales.providers.config import ANTHROPIC_MODELS, get_config, resolve_model_alias

logger = logging.getLogger("autosales.providers.anthropic")

_ANTHROPIC_API_VERSION = "2023-06-01"


class AnthropicProvider(BaseProvider):
    """Provider plugin for the Anthropic Messages API."""

    # ------------------------------------------------------------------
    # Identity
    # ------------------------------------------------------------------

    @property
    def id(self) -> str:
        return "anthropic"

    @property
    def label(self) -> str:
        return "Anthropic"

    @property
    def auth_type(self) -> AuthType:
        return AuthType.API_KEY

    @property
    def env_vars(self) -> list[str]:
        return ["ANTHROPIC_API_KEY"]

    # ------------------------------------------------------------------
    # Models
    # ------------------------------------------------------------------

    def get_models(self) -> list[ModelConfig]:
        return list(ANTHROPIC_MODELS)

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    async def authenticate(self, credential: AuthCredential) -> bool:
        """Validate the key by sending a minimal completion request."""
        api_key = credential.api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise ValueError("No Anthropic API key provided")

        cfg = get_config()
        headers = self._build_headers(api_key)

        # Cheapest possible validation: tiny message
        payload = {
            "model": "claude-haiku-4-20250514",
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "hi"}],
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{cfg.anthropic_base_url}/v1/messages",
                headers=headers,
                json=payload,
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
        api_key = credential.api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise ValueError("No Anthropic API key available")

        cfg = get_config()
        model = resolve_model_alias(
            request.model or cfg.default_models.get("anthropic", "claude-sonnet-4-20250514")
        )

        system_prompt = request.system_prompt
        if request.json_mode:
            system_prompt += "\n\nYou MUST respond with valid JSON only. No markdown fences."

        payload: dict[str, Any] = {
            "model": model,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "system": system_prompt,
            "messages": [{"role": "user", "content": request.user_message}],
        }

        headers = self._build_headers(api_key)

        if request.stream:
            payload["stream"] = True

        t0 = time.monotonic()

        async with httpx.AsyncClient(timeout=cfg.request_timeout) as client:
            if request.stream:
                return await self._stream_complete(client, cfg, headers, payload, model, t0)

            resp = await client.post(
                f"{cfg.anthropic_base_url}/v1/messages",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()

        data = resp.json()
        latency_ms = int((time.monotonic() - t0) * 1000)

        content = ""
        for block in data.get("content", []):
            if block.get("type") == "text":
                content += block.get("text", "")

        finish_reason = data.get("stop_reason", "end_turn")
        usage = data.get("usage", {})
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)

        cost = self.calculate_cost(model, input_tokens, output_tokens)

        logger.info(
            "[anthropic] %s | %d in + %d out | $%.6f | %dms",
            model, input_tokens, output_tokens, cost, latency_ms,
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
    # Streaming
    # ------------------------------------------------------------------

    async def _stream_complete(
        self,
        client: httpx.AsyncClient,
        cfg: Any,
        headers: dict[str, str],
        payload: dict[str, Any],
        model: str,
        t0: float,
    ) -> LLMResponse:
        chunks: list[str] = []
        input_tokens = 0
        output_tokens = 0
        finish_reason = "end_turn"

        async with client.stream(
            "POST",
            f"{cfg.anthropic_base_url}/v1/messages",
            headers=headers,
            json=payload,
        ) as stream:
            async for line in stream.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[len("data: "):]
                try:
                    event = _json.loads(raw)
                except _json.JSONDecodeError:
                    continue

                event_type = event.get("type", "")

                if event_type == "content_block_delta":
                    delta = event.get("delta", {})
                    if delta.get("type") == "text_delta":
                        chunks.append(delta.get("text", ""))

                elif event_type == "message_delta":
                    delta = event.get("delta", {})
                    finish_reason = delta.get("stop_reason", finish_reason)
                    usage = event.get("usage", {})
                    output_tokens = usage.get("output_tokens", output_tokens)

                elif event_type == "message_start":
                    msg = event.get("message", {})
                    usage = msg.get("usage", {})
                    input_tokens = usage.get("input_tokens", input_tokens)

        content = "".join(chunks)
        latency_ms = int((time.monotonic() - t0) * 1000)
        cost = self.calculate_cost(model, input_tokens, output_tokens)

        logger.info(
            "[anthropic-stream] %s | %d in + %d out | $%.6f | %dms",
            model, input_tokens, output_tokens, cost, latency_ms,
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
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_headers(api_key: str) -> dict[str, str]:
        return {
            "x-api-key": api_key,
            "anthropic-version": _ANTHROPIC_API_VERSION,
            "content-type": "application/json",
        }
