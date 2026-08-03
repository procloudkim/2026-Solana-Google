"""CloudEvents-style data contracts and deterministic dispatch planning."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping


def _require_text(value: str, field_name: str) -> None:
    if not isinstance(value, str):
        raise TypeError(f"{field_name} must be a string")
    if not value or not value.strip():
        raise ValueError(f"{field_name} must be non-empty")


@dataclass(frozen=True, slots=True)
class CloudEvent:
    """A minimal CloudEvents 1.0 envelope suitable for local generation tests."""

    event_id: str
    event_type: str
    source: str
    data: Mapping[str, object] = field(default_factory=dict)
    subject: str | None = None
    specversion: str = "1.0"

    def __post_init__(self) -> None:
        _require_text(self.event_id, "event_id")
        _require_text(self.event_type, "event_type")
        _require_text(self.source, "source")
        if self.specversion != "1.0":
            raise ValueError("only CloudEvents specversion 1.0 is supported")
        if self.subject is not None and not self.subject.strip():
            raise ValueError("subject must be non-empty when provided")
        if not isinstance(self.data, Mapping):
            raise TypeError("data must be a mapping")

    def to_dict(self) -> dict[str, object]:
        """Return a detached JSON-compatible envelope shape."""

        payload: dict[str, object] = {
            "specversion": self.specversion,
            "id": self.event_id,
            "type": self.event_type,
            "source": self.source,
            "data": dict(self.data),
        }
        if self.subject is not None:
            payload["subject"] = self.subject
        return payload


@dataclass(frozen=True, slots=True)
class EventDispatchPlan:
    """A route decision that records intent but performs no dispatch."""

    event_id: str
    event_type: str
    handler_name: str | None
    matched: bool
    execution_authorized: bool = False

    def to_dict(self) -> dict[str, object]:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "handler_name": self.handler_name,
            "matched": self.matched,
            "execution_authorized": self.execution_authorized,
        }


def plan_event_dispatch(
    event: CloudEvent,
    routes: Mapping[str, str],
) -> EventDispatchPlan:
    """Resolve an event type to a handler name without invoking that handler."""

    handler_name = routes.get(event.event_type)
    if handler_name is not None:
        _require_text(handler_name, "handler_name")
    return EventDispatchPlan(
        event_id=event.event_id,
        event_type=event.event_type,
        handler_name=handler_name,
        matched=handler_name is not None,
    )
