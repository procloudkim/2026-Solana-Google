# Readiness Control Plane Execution Record

검증일: 2026-07-23 KST

## Implemented

- append-only execution ledger와 derived readiness state
- G0~G7 해커톤 참전 gate 및 D-4 `PIVOT_REQUIRED`
- 세 후보 결정적 점수화와 자동 잠금/모호성 차단
- 제품 계약, 사람 승인, redacted evidence receipt schema
- 승인과 Gemini·Devnet·GCP runtime receipt의 원장 연결
- 운영 Wiki 8개와 공식 claim·상태·receipt graph 통합
- ideation, architecture, implementation, security, demo, submission context pack
- HARDENED 이전 생성을 거부하는 submission pack
- PowerShell, POSIX shell, Make readiness entrypoints

## Current state

```text
state=DISCOVERY
gate G0=PASS
gate G1=PENDING
blocker=candidate_set
next_action=ideate
```

공식 지식은 준비됐지만 제품 후보·제품 계약·runtime receipt가 없으므로 실제 참전 준비 완료를 주장하지 않는다.

## Verification evidence

| 검사 | 결과 |
|---|---|
| 전체 unittest | PASS, 37 tests |
| Readiness·graph·ingestion focused tests | PASS |
| Python compile | PASS |
| `bash -n harness.sh` | PASS |
| PowerShell `status` entrypoint | PASS |
| Media Python imports | PASS, faster-whisper/PyMuPDF/PaddleOCR/PyAV |
| MP4 transcript | 3/3 complete |
| PDF OCR/QR | 4/4 source entries complete, QR payload 3개 |
| Media source SHA-256 | mismatch 0 |
| JSON parse | PASS, 33 artifacts |
| JSONL parse | PASS, 2,084 records |
| Markdown local links | 138 checked, 0 broken |
| Graph | 458 nodes, 672 edges |
| Official graph nodes | 26 sources, 37 claims |
| Operational Wiki | 8 pages |
| Role context packs | 6, authority/control pins 누락 0 |
| Fact catalog | 37 facts |
| Secret-like key material pattern | 0 hits |
| Repeated `prepare` | ledger 1→1→1, idempotent |
| Candidate input 없는 `ideate` | expected refusal, exit 2 |
| HARDENED 이전 `pack` | expected refusal, exit 2 |
| 거부 명령 후 ledger | 1→1, unchanged |

## Proof boundary

- `agents-cli`, Solana CLI, pay.sh 설치·실행은 증명되지 않았다.
- Gemini/ADK 호출, 지갑 서명, Devnet transaction, Cloud Run 배포는 실행하지 않았다.
- 현재 graph와 test는 control-plane 동작 증거이지 제품 runtime 증거가 아니다.
- runtime receipt는 원장에 존재하는 사람 승인과 연결되어야 G4에 반영된다.
- Mainnet은 비활성화 상태다.

## Next command

승인된 agent가 `.harness/control/ideation-request.json`을 사용해 후보 세 개를 만든 뒤:

```powershell
.\harness.ps1 ideate --input .harness/control/candidates.input.json
```

후보가 75점 이상이고 2위와 5점 이상 차이 날 때만 자동 잠긴다. 그렇지 않으면 `CANDIDATES_READY`에서 사람 결정을 기다린다.
