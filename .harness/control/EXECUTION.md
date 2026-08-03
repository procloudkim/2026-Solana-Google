# Readiness Control Plane 실행 영수증

> 2026-07-23 KST의 control-plane scaffold 검증을 보존한 역사적 receipt

이 문서는 현재 Mandate Pool의 구현·배포 상태가 아니라, append-only readiness 하네스가 당시 의도대로 동작했음을 기록합니다. 현재 제출 상태는 [해커톤 실행 런북](../../research/decision-report/hackathon-environment-codex-runbook.md)을 따릅니다.

## 검증하려던 주장

제품 후보·사람 승인·runtime receipt가 없는 상태에서는 readiness gate가 자동으로 올라가지 않으며, 입력이 같은 반복 실행은 ledger를 중복 변경하지 않아야 합니다.

## 구현 범위

- append-only execution ledger와 derived readiness state
- G0~G7 gate와 deadline overlay
- 세 후보의 결정론적 비교와 모호성 차단
- 제품 계약, 사람 승인, redacted evidence receipt schema
- approval과 Gemini·Devnet·GCP receipt의 참조 연결
- 운영 Wiki 8개와 role별 context pack 6개
- `HARDENED` 이전 submission pack 거부
- PowerShell, POSIX shell, Make entrypoint

## 당시 관찰 결과

```text
state=DISCOVERY
gate G0=PASS
gate G1=PENDING
blocker=candidate_set
next_action=ideate
```

이 값은 2026-07-23 ledger의 projection입니다. 이후 선택·구현된 Mandate Pool의 상태를 부정하거나 대체하지 않습니다.

| 검사 | 당시 결과 |
|---|---|
| 전체 unittest | PASS, 37 tests |
| Readiness·graph·ingestion focused tests | PASS |
| Python compile | PASS |
| `bash -n harness.sh` | PASS |
| PowerShell `status` entrypoint | PASS |
| Media Python imports | PASS |
| MP4 transcript | 3/3 complete |
| PDF OCR/QR | 4/4 source entries complete, QR payload 3개 |
| Media source SHA-256 | mismatch 0 |
| JSON/JSONL parse | PASS |
| Markdown local links | 138 checked, 0 broken |
| Graph | 458 nodes, 672 edges |
| Official graph nodes | 26 sources, 37 claims |
| Operational Wiki | 8 pages |
| Role context packs | 6개, authority/control pin 누락 0 |
| Secret-like key material pattern | 0 hits |
| 반복 `prepare` | ledger 1→1→1, idempotent |
| 후보 없이 `ideate` | expected refusal, exit 2 |
| `HARDENED` 이전 `pack` | expected refusal, exit 2 |
| 거부 명령 뒤 ledger | 1→1, unchanged |

## 증거의 의미와 한계

이 receipt가 증명하는 것:

- control-plane schema, gate, projection, idempotency가 당시 test 범위에서 동작했습니다.
- 누락된 후보와 증거가 있는 상태에서 명령이 fail-closed로 거부됐습니다.

이 receipt가 증명하지 않는 것:

- Gemini/ADK 주문 흐름
- Solana 지갑 서명 또는 제품 Devnet transaction
- Cloud Run 배포
- 현재 source의 제품 runtime 상태
- 외부 Graphify 또는 `agents-cli` 실행

현재 재검증은 저장소 루트에서 다음 명령으로 수행합니다.

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
./harness.sh status --json
```

Projection을 현실에 맞추려면 현재 제품 계약과 기존 receipt를 검토해 정식 event로 기록해야 합니다. 문서만 맞추기 위해 증거 없는 event를 추가하지 않습니다.
