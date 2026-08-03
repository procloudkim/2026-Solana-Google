# Mandate Pool 의존성 보안 검증 기록

## 검증 목적

이 문서는 `product/mandate-pool`의 **배포 이미지에 설치되는 의존성 트리**가 2026-08-03 시점에 npm의 high·critical advisory를 포함하는지 검증한다. 개발용 전체 설치 트리가 안전하다고 주장하거나, 이후 lockfile 변경까지 보증하는 문서가 아니다.

## 대상과 전제

| 항목 | 검증값 |
|---|---|
| 검증일 | 2026-08-03 KST |
| 대상 | `product/mandate-pool` |
| Node / npm | 22.20.0 / 10.9.3 |
| lockfile의 `@google/adk` | 1.5.0 |
| 배포 설치 방식 | `npm ci --omit=dev --omit=peer` |

`package-lock.json`에는 `@google/adk@1.5.0`이 다섯 MikroORM DB driver를 peer dependency로 선언한 사실이 기록되어 있다. 제품은 `LlmAgent`와 `InMemoryRunner`만 import하며 MikroORM·SQLite API를 사용하지 않는다. Dockerfile도 build와 runtime 단계에서 peer dependency를 설치 트리에서 제외한다. npm 공식 문서에 따르면 `--omit=peer`는 peer dependency를 lockfile에서 제거하지 않고 디스크의 설치 트리에서만 제외한다. 따라서 아래 판정은 lockfile 전체가 아니라 **실제로 배포되는 peer 제외 트리**를 기준으로 한다. [npm `omit` 옵션](https://docs.npmjs.com/cli/install/#omit)

## 검증 방법

1. 기본 `npm ci` 트리와 배포용 peer 제외 트리의 audit 결과를 비교했다.
2. `npm ls`와 lockfile을 통해 high·critical 경로가 ADK의 SQLite peer chain에 있는지 확인했다.
3. peer 제외 설치 뒤 `@mikro-orm/sqlite`, `sqlite3`, `node-gyp`, `tar`가 설치 트리에 없는지 확인했다.
4. 배포 설치 조건에서 typecheck, 전체 Vitest, build를 실행해 peer 제외가 현재 제품 경로를 깨뜨리지 않는지 확인했다.

관찰된 취약 경로는 다음과 같다.

```text
@google/adk@1.5.0
  -> peer @mikro-orm/sqlite@6.6.16
  -> sqlite3@5.1.7
  -> node-gyp@8.4.1 / tar@6.2.1
```

## 관찰 결과

| 검사 | 결과 |
|---|---|
| 기본 전체 install audit | 27건: critical 1, high 6, moderate 18, low 2 |
| `npm ci --omit=peer` | 성공, 528 packages |
| peer 제외 production audit | high 0, critical 0, moderate 19 |
| typecheck | 통과 |
| Vitest | 9 files, 87 tests 통과 |
| build | 통과 |

재현에 사용한 gate는 다음과 같다.

```bash
npm ci --omit=peer
npm audit --omit=dev --omit=peer --audit-level=high
npm run typecheck
npm test
npm run build
```

## 판정과 실행 결정

**배포 설치 트리의 high·critical gate는 통과했다.** 기본 설치에서 나타난 critical/high는 현재 제품이 사용하지 않고 Docker 이미지에도 설치하지 않는 ADK의 DB driver peer 경로에서 발생했다. GitHub Advisory의 해당 `node-tar` 이슈는 조작된 archive를 처리할 때 발생할 수 있는 자원 고갈 문제다. [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw)

남은 moderate 19건은 ADK의 OpenTelemetry와 Google API 전이 의존성 경로에서 관찰됐다. `npm audit fix --force`는 ADK를 `0.1.3`으로 breaking downgrade하므로 적용하지 않았다. 사용하지 않는 DB peer만을 위해 `tar` major override를 추가하는 것도 현재 검증된 조합에 새 호환성 위험을 만들 수 있어 적용하지 않았다.

## 한계와 재검증 조건

- 이 결과는 2026-08-03의 lockfile, npm advisory 데이터, peer 제외 Docker 설치에만 유효하다.
- high·critical 0은 취약점이 전혀 없다는 뜻이 아니다. moderate 19건과 아직 공개되지 않은 취약점은 이 판정 밖이다.
- ADK API 사용 범위가 DB session·persistence로 넓어지면 peer 제외 전제를 다시 검토해야 한다.
- `package.json`, lockfile, Dockerfile 또는 npm advisory가 바뀌면 위 gate를 다시 실행하고 이 문서를 현재 결과로 갱신한다.
