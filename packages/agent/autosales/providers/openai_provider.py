"""OpenAI API-key provider -- standard pay-per-token access.

Uses ``httpx`` directly (no SDK dependency) to keep the provider layer
lightweight and uniform across all backends.
"""

from __future__ import annotations

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
from autosales.providers.config import OPENAI_MODELS, get_config, resolve_model_alias

logger = logging.getLogger("autosales.providers.openai")


class OpenAIProvider(BaseProvider):
    """Provider plugin for the OpenAI Chat Completions API (API-key auth)."""

    # ------------------------------------------------------------------
    # Identity
    # ------------------------------------------------------------------

    @property
    def id(self) -> str:
        return "openai"

    @property
    def label(self) -> str:
        return "OpenAI"

    @property
    def auth_type(self) -> AuthType:
        return AuthType.API_KEY

    @property
    def env_vars(self) -> list[str]:
        return ["OPENAI_API_KEY"]

    # ------------------------------------------------------------------
    # Model catalogue
    # ------------------------------------------------------------------

    def get_models(self) -> list[ModelConfig]:
        return list(OPENAI_MODELS)

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    async def authenticate(self, credential: AuthCredential) -> bool:
        """Validate the API key by hitting the ``/models`` endpoint."""
        api_key = credential.api_key or os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            raise ValueError("No OpenAI API key provided")

        cfg = get_config()
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{cfg.openai_base_url}/models",
                headers={"Authorization": f"Bearer {api_key}"},
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
        api_key = credential.api_key or os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            raise ValueError("No OpenAI API key available")

        cfg = get_config()
        model = resolve_model_alias(request.model or cfg.default_models.get("openai", "gpt-4o"))

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

        if request.stream:
            payload["stream"] = True

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        t0 = time.monotonic()

        async with httpx.AsyncClient(timeout=cfg.request_timeout) as client:
            if request.stream:
                return await self._stream_complete(client, cfg, headers, payload, model, t0)

            resp = await client.post(
                f"{cfg.openai_base_url}/chat/completions",
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

        cost = self.calculate_cost(model, input_tokens, output_tokens)

        logger.info(
            "[openai] %s | %d in + %d out | $%.6f | %dms",
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
    # Streaming helper
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
        """Consume an SSE stream and return the aggregated response."""
        import json as _json

        chunks: list[str] = []
        finish_reason = "stop"

        async with client.stream(
            "POST",
            f"{cfg.openai_base_url}/chat/completions",
            headers=headers,
            json=payload,
        ) as stream:
            async for line in stream.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[len("data: "):]
                if raw.strip() == "[DONE]":
                    break
                try:
                    event = _json.loads(raw)
                except _json.JSONDecodeError:
                    continue
                delta = event.get("choices", [{}])[0].get("delta", {})
                token_text = delta.get("content")
                if token_text:
                    chunks.append(token_text)
                fr = event.get("choices", [{}])[0].get("finish_reason")
                if fr:
                    finish_reason = fr

        content = "".join(chunks)
        latency_ms = int((time.monotonic() - t0) * 1000)

        # Streaming responses don't always include usage; estimate
        logger.info("[openai-stream] %s | %dms | %d chars", model, latency_ms, len(content))

        return LLMResponse(
            content=content,
            model=model,
            provider_id=self.id,
            finish_reason=finish_reason,
            latency_ms=latency_ms,
        )
