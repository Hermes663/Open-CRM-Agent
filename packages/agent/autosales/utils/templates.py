"""Simple email template engine with built-in follow-up templates."""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger("autosales.utils.templates")

# Directory for user-supplied templates (relative to project root).
_TEMPLATE_DIR = Path("agent-config/templates")

# ---------------------------------------------------------------------------
# Built-in templates
# ---------------------------------------------------------------------------

BUILT_IN_TEMPLATES: dict[str, str] = {
    "first_email": (
        "Subject: {{subject}}\n\n"
        "Hi {{first_name}},\n\n"
        "{{body}}\n\n"
        "Best regards,\n"
        "{{sender_name}}\n"
        "{{sender_title}}"
    ),
    "follow_up_1": (
        "Subject: Re: {{original_subject}}\n\n"
        "Hi {{first_name}},\n\n"
        "I wanted to quickly follow up on my previous email. "
        "I thought you might find it interesting given {{company}}'s "
        "focus on {{pain_point}}.\n\n"
        "Would you be open to a brief 15-minute chat this week?\n\n"
        "Best,\n"
        "{{sender_name}}"
    ),
    "follow_up_2": (
        "Subject: Re: {{original_subject}}\n\n"
        "Hi {{first_name}},\n\n"
        "I know how busy things get at {{company}}. I wanted to share "
        "a quick insight that might be relevant: {{value_prop}}.\n\n"
        "If now isn't the right time, no worries at all -- just let me "
        "know and I won't follow up again.\n\n"
        "Cheers,\n"
        "{{sender_name}}"
    ),
    "follow_up_3": (
        "Subject: Re: {{original_subject}}\n\n"
        "Hi {{first_name}},\n\n"
        "This will be my last note -- I don't want to crowd your inbox. "
        "If there's ever a better time to connect, I'm just a reply away.\n\n"
        "Wishing you and the {{company}} team all the best.\n\n"
        "{{sender_name}}"
    ),
}


class EmailTemplateEngine:
    """Loads and renders Mustache-style email templates.

    Templates can be stored on disk under ``agent-config/templates/`` or
    selected from the built-in set.  Variable substitution uses the
    ``{{variable}}`` syntax.
    """

    def __init__(self, template_dir: Path | None = None) -> None:
        self._template_dir = template_dir or _TEMPLATE_DIR

    def load_template(self, name: str) -> str:
        """Load a template by name.

        Looks on disk first (``<template_dir>/<name>.md`` or ``.txt``),
        then falls back to built-in templates.

        Args:
            name: Template identifier (e.g. ``follow_up_1``).

        Returns:
            Template string with ``{{variable}}`` placeholders.

        Raises:
            FileNotFoundError: If the template cannot be found anywhere.
        """
        # Try disk
        for ext in (".md", ".txt", ".html"):
            path = self._template_dir / f"{name}{ext}"
            if path.exists():
                logger.debug("[templates] Loaded template '%s' from %s", name, path)
                return path.read_text(encoding="utf-8")

        # Try built-in
        if name in BUILT_IN_TEMPLATES:
            logger.debug("[templates] Using built-in template '%s'", name)
            return BUILT_IN_TEMPLATES[name]

        raise FileNotFoundError(f"Template '{name}' not found in {self._template_dir} or built-ins")

    @staticmethod
    def render(template: str, variables: dict[str, Any]) -> str:
        """Replace ``{{key}}`` placeholders with values from *variables*.

        Missing keys are left as-is (with a warning).

        Args:
            template: Template string.
            variables: Key-value mapping for substitution.

        Returns:
            Rendered string.
        """
        def _replacer(match: re.Match) -> str:
            key = match.group(1).strip()
            if key in variables:
                return str(variables[key])
            logger.debug("[templates] Unresolved variable: {{%s}}", key)
            return match.group(0)

        return re.sub(r"\{\{(\s*\w+\s*)\}\}", _replacer, template)

    def render_template(self, name: str, variables: dict[str, Any]) -> str:
        """Convenience: load + render in one call."""
        tpl = self.load_template(name)
        return self.render(tpl, variables)
