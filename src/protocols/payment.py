"""Serializable payment-intent contracts.

This module deliberately contains no wallet, RPC, HTTP, signing, or settlement
implementation. It lets generated agents exchange validated data without
mistaking a scaffold test for a live payment proof.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class PaymentProtocol(str, Enum):
    """Protocol identifiers recognized by the generated-code boundary."""

    AP2 = "ap2"
    X402 = "x402"
    PAY_SH = "pay.sh"


def _require_text(value: str, field_name: str) -> None:
    if not isinstance(value, str):
        raise TypeError(f"{field_name} must be a string")
    if not value or not value.strip():
        raise ValueError(f"{field_name} must be non-empty")


@dataclass(frozen=True, slots=True)
class PaymentIntent:
    """A validated intent that is explicitly unauthorized for execution."""

    intent_id: str
    protocol: PaymentProtocol
    amount_atomic: int
    asset: str
    recipient: str
    network: str = "solana-devnet"
    memo: str | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.protocol, PaymentProtocol):
            raise TypeError("protocol must be a PaymentProtocol")
        _require_text(self.intent_id, "intent_id")
        _require_text(self.asset, "asset")
        _require_text(self.recipient, "recipient")
        _require_text(self.network, "network")
        if isinstance(self.amount_atomic, bool) or not isinstance(self.amount_atomic, int):
            raise TypeError("amount_atomic must be an integer")
        if self.amount_atomic <= 0:
            raise ValueError("amount_atomic must be greater than zero")
        if self.memo is not None and not self.memo.strip():
            raise ValueError("memo must be non-empty when provided")

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-compatible, non-executing representation."""

        return {
            "schema_version": "1.0",
            "intent_id": self.intent_id,
            "protocol": self.protocol.value,
            "amount_atomic": self.amount_atomic,
            "asset": self.asset,
            "recipient": self.recipient,
            "network": self.network,
            "memo": self.memo,
            "execution_authorized": False,
        }


def create_payment_intent(
    *,
    intent_id: str,
    protocol: PaymentProtocol | str,
    amount_atomic: int,
    asset: str,
    recipient: str,
    network: str = "solana-devnet",
    memo: str | None = None,
) -> PaymentIntent:
    """Build an intent contract without signing, submitting, or settling it."""

    try:
        normalized_protocol = (
            protocol if isinstance(protocol, PaymentProtocol) else PaymentProtocol(protocol.lower())
        )
    except (AttributeError, ValueError) as exc:
        supported = ", ".join(item.value for item in PaymentProtocol)
        raise ValueError(f"unsupported payment protocol; expected one of: {supported}") from exc

    return PaymentIntent(
        intent_id=intent_id,
        protocol=normalized_protocol,
        amount_atomic=amount_atomic,
        asset=asset,
        recipient=recipient,
        network=network,
        memo=memo,
    )
