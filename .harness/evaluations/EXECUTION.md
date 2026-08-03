# 리서치 하네스 실행 영수증

> 2026-07-23 KST에 원문 동기화·미디어 보강·graph 생성·로컬 연구 loop를 검증한 역사적 receipt

이 문서는 Mandate Pool을 선택하기 전 리서치 하네스의 재현성을 기록합니다. 제품 우수성, Google ADK runtime, Cloud Run 배포, Solana 거래를 증명하지 않습니다. 현재 제품과 제출 상태는 [루트 README](../../README.md)와 [실행 런북](../../research/decision-report/hackathon-environment-codex-runbook.md)을 따릅니다.

## 검증하려던 주장

같은 원문과 설정을 입력하면 provenance가 유지된 Wiki·graph·bounded research 결과를 재현하고, 기계 생성 결과의 한계를 receipt에 남길 수 있어야 합니다.

## 당시 환경

- Harness Python: 3.14.3
- Isolated media Python: 3.12.10 (`.venv-media`)
- 확인한 native entrypoint: `harness.ps1`
- WSL GNU Make: 4.3 dry-run
- PDF text: `pypdf` 6.9.2
- Transcript: faster-whisper 1.2.1, CTranslate2 4.6.0, PyAV 16.0.1, CPU int8 `small`
- OCR/QR: PaddleOCR 3.7.0, PaddlePaddle 3.3.1, PyMuPDF 1.28.0, OpenCV 4.10.0

버전은 당시 영수증 값이며 현재 설치 권고가 아닙니다.

## 1. 원문 동기화

```powershell
./harness.ps1 sync
```

- Exit code: 0
- Source: 9개, 총 623,368,264 bytes
- Output: raw-reference Markdown 9개, concept module 4개, index와 manifest
- Status: extracted 2, enriched 3, transcribed 3, duplicate 1
- MP4: 608,006,068 bytes, container metadata 6,076.649초
- Wiki manifest SHA-256: `7144f9b362ddc4d525360424fefb1bd6d02025889905e8d0e8235a34cb1e4d60`

**의미:** source inventory와 derived file provenance가 생성됐습니다. 내용의 사실성이나 전사 정확도를 자동 보증하지 않습니다.

## 2. 미디어 보강

```powershell
./harness.ps1 media
```

- Exit code: 0
- MP4 3개: decoded 6,076.523초, Korean timestamp segment 2,083개
- PDF: unique 3개, 60 pages OCR; duplicate 1개 재사용
- OCR: confidence filter를 통과한 text line 1,369개
- QR: intro deck 11쪽에서 URL payload 3개 decode
- Repeat: source SHA와 설정이 같으면 completed artifact를 재사용
- `uv pip check -p .venv-media`: 73 packages 통과
- Enrichment manifest SHA-256: `94a2879fd346f301154bd2362601f19aec9aea2191dd0f09adce259682808f0a`

**한계:** transcript는 human-gold가 아니며 diarization을 수행하지 않았습니다. OCR 오류와 누락 가능성이 있고, QR 세 개 외의 모든 시각 요소를 해석했다고 주장하지 않습니다.

## 3. Graph와 context pack

```powershell
./harness.ps1 graph
```

- Exit code: 0
- Node 300개, edge 402개
- Evidence state: observed 383, derived 2, declared 8, proposed 9
- Python parse error: 0
- Bounded context node: 64
- Graph SHA-256: `2d828d91b4978b27b539d46be08eb2ca4121817d0a6d860b0d65f62efe040502`

**의미:** native AST와 문서 관계 graph가 만들어졌습니다. 외부 Graphify 실행이나 vendor schema 호환을 뜻하지 않습니다.

## 4. 한 번의 로컬 연구 loop

```powershell
./harness.ps1 loop
```

- Exit code: 0
- Run: `20260722T182107269246Z-afcac91c40`
- Hypothesis: `explicit-agent-contract`
- Generator: deterministic `local-template`
- Local benchmark score: 1.0
- Promoted file: `src/agents/harness_research_agent.py`

**의미:** bounded candidate→test→promotion 기계 흐름이 동작했습니다. 이 내부 점수는 공식 심사 점수도, 외부 Agent runtime 품질도 아닙니다.

## 재현 명령

원문 보강을 다시 수행하지 않고 현재 하네스 코드만 검증하려면 저장소 루트에서 실행합니다.

```bash
./harness.sh sync
./harness.sh graph
python3 -m unittest discover -s tests -p 'test_*.py'
```

MP4 transcript·PDF OCR은 source SHA 또는 adapter 설정이 바뀌었을 때만 별도 media 환경에서 재실행합니다. 자동 생성 Markdown은 직접 윤문하지 않고 generator 또는 source를 수정한 뒤 다시 만듭니다.
