"""AutoSales LLM Provider Plugin System.

Public surface:

    from autosales.providers import (
        # Core types
        AuthType, AuthCredential, ModelConfig,
        LLMRequest, LLMResponse, BaseProvider,
        # Concrete providers
        OpenAIProvider, OpenAICodexProvider, AnthropicProvider,
        # Registry & routing
        ProviderRegistry, get_registry,
        ModelRouter,
        # Auth store
        AuthProfileStore,
        # Config
        ProviderConfig, get_config,
    )
"""

from autosales.providers.base import (
    AuthCredential,
    AuthType,
    BaseProvider,
    LLMRequest,
    LLMResponse,
    ModelConfig,
)
from autosales.providers.config import ProviderConfig, get_config
from autosales.providers.auth_profiles import AuthProfileStore
from autosales.providers.registry import ProviderRegistry, get_registry
from autosales.providers.router import ModelRouter

# Concrete providers (also triggers auto-registration via registry import)
from autosales.providers.openai_provider import OpenAIProvider
from autosales.providers.openai_codex_provider import OpenAICodexProvider
from autosales.providers.anthropic_provider import AnthropicProvider

__all__ = [
    "AuthType",
    "AuthCredential",
    "ModelConfig",
    "LLMRequest",
    "LLMResponse",
    "BaseProvider",
    "OpenAIProvider",
    "OpenAICodexProvider",
    "AnthropicProvider",
    "ProviderRegistry",
    "get_registry",
    "ModelRouter",
    "AuthProfileStore",
    "ProviderConfig",
    "get_config",
]
