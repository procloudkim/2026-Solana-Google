# Mandate Pool 의존성 보안 영수증

- 검증일: 2026-08-03 KST
- 대상: `product/mandate-pool`
- Node/npm: 22.20.0 / 10.9.3
- Google ADK: npm registry 최신 `1.5.0`

## 판정

배포 설치에서는 high/critical advisory가 없다. 기본 `npm ci`가 보고한 critical/high는 앱이 사용하지 않는 Google ADK의 DB driver peer가 자동 설치되면서 생긴 경로이며, 기존 Dockerfile은 build와 runtime 모두 `--omit=peer`로 이 경로를 제외한다.

```text
@google/adk@1.5.0
  -> peer @mikro-orm/sqlite@6.6.16
  -> sqlite3@5.1.7
  -> node-gyp@8.4.1 / tar@6.2.1
```

앱이 직접 사용하는 ADK API는 `LlmAgent`와 `InMemoryRunner`뿐이며 MikroORM·SQLite import는 없다. `npm ci --omit=peer` 뒤 `@mikro-orm/sqlite`, `sqlite3`, `node-gyp`, `tar`가 설치 트리에 없음을 확인했다.

## 검증 결과

| 검사 | 결과 |
|---|---|
| 기본 전체 install audit | 27건: critical 1, high 6, moderate 18, low 2 |
| `npm ci --omit=peer` | 성공, 528 packages |
| peer 제외 production audit | high 0, critical 0; moderate 19 |
| typecheck | 통과 |
| Vitest | 9 files, 87 tests 통과 |
| build | 통과 |

실행한 보안 gate:

```bash
npm ci --omit=peer
npm audit --omit=dev --omit=peer --audit-level=high
npm run typecheck
npm test
npm run build
```

남은 moderate 19건은 ADK의 OpenTelemetry와 Google API 전이 의존성이다. `npm audit fix --force`는 ADK를 `0.1.3`으로 breaking downgrade하므로 적용하지 않았다. `tar` major override도 DB peer를 사용하지 않는 현재 제품에 불필요한 호환성 위험을 추가하므로 적용하지 않았다.

## 외부 근거와 경계

- npm 문서는 `--omit=peer`가 peer dependency를 lockfile에는 유지하되 설치 트리에는 두지 않는다고 명시한다: [npm install omit](https://docs.npmjs.com/cli/v11/commands/npm-install#omit)
- 보고된 `node-tar` critical advisory는 untrusted archive 압축 해제 시 자원 고갈 위험이다: [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw)
- npm registry에서 확인한 최신 `@google/adk`는 1.5.0이며 다섯 MikroORM DB driver를 peer dependency로 선언한다.

이 판정은 현재 lockfile과 peer 제외 Docker 설치에 한정한다. ADK 또는 lockfile이 바뀌면 audit를 다시 실행한다.
