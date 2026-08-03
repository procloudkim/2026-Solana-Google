#!/usr/bin/env python3
"""Local harness candidate.

This file is a dependency-free scaffold generated for an isolated experiment.
It is not evidence that ADK, Gemini, Solana, or an external agent CLI ran.
"""

from __future__ import annotations

import argparse
import json
from typing import Any


CANDIDATE_METADATA: dict[str, str] = {'hypothesis_id': 'explicit-agent-contract', 'title': 'Make generated agent capabilities explicit', 'description': 'Start from a dependency-free contract that distinguishes a local scaffold from verified ADK, Gemini, Solana, and payment integrations.', 'generator': 'local-template', 'implementation_status': 'scaffold-only'}


def build_agent_spec() -> dict[str, Any]:
    """Return the explicit starter contract for this candidate."""

    return {
        "name": "harness-research-candidate",
        "status": CANDIDATE_METADATA["implementation_status"],
        "hypothesis": CANDIDATE_METADATA["hypothesis_id"],
        "capabilities": [],
    }


def self_test() -> bool:
    spec = build_agent_spec()
    return (
        spec["status"] == "scaffold-only"
        and spec["hypothesis"] == CANDIDATE_METADATA["hypothesis_id"]
        and spec["capabilities"] == []
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        print(json.dumps({"ok": self_test()}, sort_keys=True))
        return 0 if self_test() else 1
    print(json.dumps(build_agent_spec(), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
