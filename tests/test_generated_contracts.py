from __future__ import annotations

import json
import unittest

from src.cloud import CloudEvent, plan_event_dispatch
from src.protocols import PaymentProtocol, create_payment_intent


class PaymentContractTests(unittest.TestCase):
    def test_intent_is_json_serializable_and_never_authorized(self) -> None:
        intent = create_payment_intent(
            intent_id="intent-001",
            protocol="x402",
            amount_atomic=1_000,
            asset="USDC",
            recipient="recipient-placeholder",
        )

        payload = intent.to_dict()
        self.assertEqual(intent.protocol, PaymentProtocol.X402)
        self.assertFalse(payload["execution_authorized"])
        self.assertEqual(json.loads(json.dumps(payload)), payload)

    def test_invalid_amount_and_protocol_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            create_payment_intent(
                intent_id="intent-002",
                protocol="x402",
                amount_atomic=0,
                asset="USDC",
                recipient="recipient-placeholder",
            )
        with self.assertRaises(ValueError):
            create_payment_intent(
                intent_id="intent-003",
                protocol="unknown",
                amount_atomic=1,
                asset="USDC",
                recipient="recipient-placeholder",
            )


class CloudEventContractTests(unittest.TestCase):
    def test_dispatch_is_planned_without_invocation(self) -> None:
        event = CloudEvent(
            event_id="event-001",
            event_type="commerce.payment.requested",
            source="urn:harness:test",
            data={"intent_id": "intent-001"},
        )

        plan = plan_event_dispatch(
            event,
            {"commerce.payment.requested": "handle_payment_request"},
        )

        self.assertTrue(plan.matched)
        self.assertEqual(plan.handler_name, "handle_payment_request")
        self.assertFalse(plan.execution_authorized)
        self.assertEqual(json.loads(json.dumps(event.to_dict())), event.to_dict())

    def test_unmatched_event_has_no_handler(self) -> None:
        event = CloudEvent(
            event_id="event-002",
            event_type="unknown.event",
            source="urn:harness:test",
        )

        plan = plan_event_dispatch(event, {})

        self.assertFalse(plan.matched)
        self.assertIsNone(plan.handler_name)
        self.assertFalse(plan.execution_authorized)

    def test_invalid_specversion_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            CloudEvent(
                event_id="event-003",
                event_type="commerce.payment.requested",
                source="urn:harness:test",
                specversion="0.3",
            )


if __name__ == "__main__":
    unittest.main()
