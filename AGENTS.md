<!-- BEGIN:nextjs-agent-rules -->

# 이건 당신이 알던 Next.js가 아닙니다

이 버전은 breaking change가 있습니다 — API, 컨벤션, 파일 구조 모두 학습 데이터와 다를 수 있습니다. 코드를 작성하기 전에 `node_modules/next/dist/docs/`에서 관련 가이드를 먼저 읽으세요. deprecation 공지를 반드시 확인하세요.

<!-- END:nextjs-agent-rules -->

# 프로젝트 컨벤션

속도보다 정확성을 우선시하여 작업하세요.
이 환경은 일반적인 개발 작업에 충분한 CPU, RAM, 시간이 확보되어 있다고 가정하세요. 단순히 빨리 끝내기 위해 빌드, 테스트, 인덱싱, 광범위한 검색, 깊이 있는 진단을 회피하지 마세요.
지름길로 가지 마세요. 관련 코드를 확인하고, 근거를 따라가고, 적절한 검증을 수행하며, 작업이 실질적으로 해결되거나 구체적인 blocker를 발견할 때까지 계속하세요.
명확한 정체(stuck) 징후나 무의미하다는 증거가 없는 한 오래 실행되는 명령은 계속 진행하도록 두세요. 속도 최적화는 명시적으로 요청받았을 때, 실제 timeout이 존재할 때, 또는 현재 접근 방식이 명백히 진전이 없을 때만 하세요.

이 프로젝트는 **Next.js (App Router) + TypeScript + RSC**를 사용합니다.
아래는 **핵심 컨벤션**입니다. 다른 패턴은 프로젝트가 진행되면서 정의됩니다.
확신이 서지 않으면 임의로 벗어나지 말고 먼저 질문하세요.

---

## 1. 최상위 디렉토리 아키텍처

소스 코드는 루트 레벨에서 여섯 가지 관심사로 분리됩니다. 경계를 존중하세요.
├── app/ # Next.js App Router (routes, layouts, pages)
├── client/ # 브라우저 전용 코드 (hooks, stores, client utils, providers)
├── server/ # 백엔드 전용 코드
├── lib/ # 서드파티 연동·데이터 파이프라인 (외부 API 클라이언트, 캐싱, 오케스트레이션). 런타임 신뢰 영역상 server/와 동급으로 취급
├── shared/ # 클라이언트와 서버 양쪽에서 사용 가능한 코드 (types, constants, pure utils)
└── components/ # React 컴포넌트 (UI 레이어)

### Import 방향 규칙

- `client/`는 `server/`나 `lib/`를 import해서는 안 됩니다 (MUST NOT) — 단, 타입 전용 참조(`import type`/`export type`)는 예외로 허용합니다. 컴파일 시 완전히 소거되어 런타임 번들에 영향이 없기 때문입니다.
- `server/`와 `lib/`는 서로 자유롭게 import할 수 있습니다 (MAY) — 같은 백엔드 런타임 신뢰 영역입니다.
- `server/`와 `lib/`는 `client/`나 `components/`를 import해서는 안 됩니다 (MUST NOT).
- `shared/`는 `client/`, `server/`, `lib/`, `components/`, `app/` 어느 것도 import해서는 안 됩니다 (MUST NOT).
- `components/`는 `client/`, `shared/`를 import할 수 있습니다 (MAY). `server/`나 `lib/`는 import해서는 안 됩니다 (MUST NOT) — 단, `client/`와 동일하게 타입 전용 참조는 예외로 허용합니다.
- `app/`는 전체를 orchestrate합니다. 어느 레이어든 import할 수 있습니다 (MAY).

브라우저나 서버 API에 런타임 의존성이 없는 유틸리티라면 → `shared/`에 두세요.

---

## 2. 파일 네이밍

- **컴포넌트**: `PascalCase.tsx`
- **훅(Hooks)**: `useCamelCase.ts`
- **그 외 파일**: `camelCase.ts`

---

## 3. Server Component vs Client Component

- **기본값은 Server Component입니다.** 필요하지 않으면 `"use client"`를 추가하지 마세요.
- 다음이 필요할 때만 `"use client"`를 추가하세요:
  - React 훅 (`useState`, `useEffect` 등)
  - 브라우저 API
  - 이벤트 핸들러
  - 클라이언트 전용 라이브러리 (상태 관리 스토어, 데이터 페칭 훅 등 — 구체적인 라이브러리는 CLAUDE.md 참고)
- **`"use client"` 경계는 가능한 한 깊게 밀어 넣으세요.** 페이지 전체가 아니라 인터랙티브한 leaf 노드만 감싸세요.
- 초기 데이터 페칭 → `async/await`를 사용하는 Server Component.
- 사용자 상호작용에 의한 페칭 → 데이터 페칭 라이브러리를 사용하는 Client Component.

✅ 좋은 예:

```tsx
// app/chat/page.tsx (Server Component)
export default async function ChatPage() {
  const initial = await fetchMessages();
  return <ChatRoom initial={initial} />;
}

// components/domains/chat/ChatRoom.tsx
("use client");
export function ChatRoom({ initial }) {
  /* ... */
}
```

---

## 4. Components 레이어

components/
├── commons/ # 도메인에 종속되지 않는 UI 프리미티브 (Button, Input, Card, ...)
├── domains/ # 기능 단위로 그룹화된 도메인 특화 컴포넌트
└── layout/ # 특정 도메인에 속하지 않는 앱 셸/내비게이션 컴포넌트 (BottomTabBar, GlobalNav, ...)

### `commons/`

- 재사용 가능하고 도메인에 종속되지 않는 UI.
- 비즈니스 로직이나 도메인 상태를 포함해서는 안 됩니다 (MUST NOT).
- `domains/`를 import해서는 안 됩니다 (MUST NOT).

### `layout/`

- 앱 전역 셸/내비게이션 컴포넌트. 특정 기능 도메인 하나에 속하지 않는다는 점에서 `domains/`와 구분되고, 도메인 상태(다크모드, 인증 세션 등)에 연결될 수 있다는 점에서 `commons/`와 구분됩니다.
- `domains/`를 import해서는 안 됩니다 (MUST NOT) — commons/와 마찬가지로 특정 도메인에 대한 의존성을 갖지 않습니다.

### UI 컴포넌트 설치 규칙

- `commons/`의 기본 UI 컴포넌트(Button, Toggle, Switch, Input 등)는 프로젝트가 지정한 UI 킷에서 설치해야 합니다 (MUST). 구체적인 UI 킷과 설치 명령은 CLAUDE.md를 확인하세요.
- 컴포넌트를 처음부터 작성하기 전에, 항상 지정된 UI 킷에서 사용 가능한지 먼저 확인하세요.
- 지정된 UI 킷이 제공하지 않는 경우에만 커스텀 컴포넌트를 구현하세요.

### `domains/`

- 도메인 폴더별로 조직된 기능 특화 컴포넌트.
- `commons/` 컴포넌트를 조합합니다. 스토어와 쿼리 훅에 연결될 수 있습니다.
- **규칙**: 파일을 `domains/` 바로 아래에 두지 마세요. 항상 도메인 이름의 하위 폴더 안에 중첩하세요.
  - ✅ `components/domains/chat/ChatRoom.tsx`
  - ❌ `components/domains/ChatRoom.tsx`

`commons/`와 `domains/` 내부의 하위 폴더 구조는 프로젝트와 함께 진화합니다 — 필요에 따라 관심사별로 그룹화하세요.

---

## 5. 상태 관리

**서버 상태**와 **클라이언트 상태**를 엄격히 분리하세요.

### 서버 상태 — 데이터 페칭 라이브러리

- 데이터 페칭, 캐싱, mutation에 사용합니다. 구체적인 라이브러리는 CLAUDE.md를 확인하세요.
- 내장된 로딩/에러/펜딩 상태를 사용하세요. 이를 로컬 상태로 절대 미러링하지 마세요.
- **쿼리 키 컨벤션**: 계층적 배열, 일반적인 것에서 구체적인 순서로.

```ts
// ✅ 좋은 예
["posts", postId]
["user", userId, "reviews"]

// ❌ 나쁜 예
["getPost"]
[`post-${postId}`]
```

### 클라이언트 상태 — 클라이언트 상태 관리 라이브러리

- UI 상태(모달, 사이드바)와 순수 클라이언트 전역 상태에 사용합니다. 구체적인 라이브러리는 CLAUDE.md를 확인하세요.
- 관심사당 하나의 스토어, `useXxxStore.ts`로 명명합니다.
- **안티패턴 (엄격히 금지)**: 서버 상태를 클라이언트 상태 스토어에 중복 저장하는 것. 쿼리 캐시가 곧 source of truth입니다.

---

## 6. 검증 및 타입

- 검증 스키마는 프로젝트가 지정한 스키마 검증 라이브러리를 사용합니다. 구체적인 라이브러리는 CLAUDE.md를 확인하세요.
- TS 타입은 스키마의 타입 추론 기능으로 도출하세요(예: zod의 `z.infer<typeof schema>`). 스키마를 미러링하는 타입을 손으로 작성하지 마세요.
- 스키마가 아닌 타입의 경우: declaration merging이 필요하지 않다면 `interface`보다 `type`을 선호하세요.
- `any`를 피하세요. `unknown`을 사용하고 좁혀 나가세요.

---

## 7. 일반 규칙

- **Import**: `@/*` path alias를 사용하세요. 깊은 상대 경로(`../../../`)는 사용하지 마세요.
- **재export를 위한 barrel 파일(`index.ts`)**은 DX를 실질적으로 개선하지 않는 한 사용하지 마세요.
- **Next.js API를 사용하기 전에 `node_modules/next/dist/docs/`를 읽으세요.** 학습 데이터가 최신이 아닐 수 있습니다.

---

## 8. 훅과 사이드 이펙트(Side Effects)

### 렌더링은 순수해야 합니다

렌더 함수 본문은 읽기 전용입니다. ref에 쓰거나, 외부 변수를 mutate하거나, 렌더 안에서 직접 API를 호출하지 마세요. 모든 사이드 이펙트는 이벤트 핸들러나 effect 안에 있어야 합니다.

### Effect는 외부 시스템과의 동기화를 위한 것입니다

다른 상태 변화에 반응해서 React 상태 업데이트를 연쇄시키기 위해 effect를 사용하지 마세요. 어떤 상태 변화에 반응해서 effect 안에서 `setState`를 쓰고 있다면, 이는 설계상의 나쁜 냄새(design smell)입니다. derived state, `useReducer`를 쓰거나, 같은 이벤트 핸들러 안에서 두 상태를 함께 업데이트해서 해결하세요.

❌ `useEffect(() => { setB(init); }, [a]);`
✅ `handler = () => { setA(val); setB(init); }`

### 문제를 이미 해결하는 커스텀 훅 구현을 먼저 확인하세요

우회책(예: stale closure를 피하기 위한 "latest ref")을 도입하기 전에, 호출하고 있는 훅이 이미 내부적으로 이를 처리하고 있는지 확인하세요. 훅이 소유한 해결책을 중복 구현하면 코드를 따라가기 어려워지고 미묘한 버그가 생깁니다.

---

## 9. 코드 수정 후 변경 요약

코드 변경을 완료한 후, **파일별로 무엇이 왜 바뀌었는지 설명**을 제공하세요.

### 포맷

- 수정된 파일마다 별도의 항목을 작성하세요.
- 각 항목에는 **무엇이 바뀌었는지**(before/after, 또는 추가/제거)와 **왜 바뀌었는지**(버그, 설계 결정, 죽은 코드 등)를 포함해야 합니다.
- 실제 diff에서 확인된 사실만 기술하세요. 추측이나 의도로 항목을 채우지 마세요.
- 새 파일의 경우, diff 대신 파일의 역할과 핵심 설계 결정을 요약하세요.

### 상세도

- 사소한 변경(타입 수정, 주석 수정)은 한 줄로 충분합니다.
- 로직 변경이나 구조적 리팩토링은 구체적인 before/after를 포함해야 합니다.
- 명확한 "이유"가 있는 버그 수정은 어떤 조건에서 무엇이 잘못되고 있었는지 설명해야 합니다.

### 타이밍

- 3개 이상의 파일을 수정하는 모든 작업 후, 또는 명시적으로 요청받았을 때 제공하세요.
- 사용자가 스테이징이나 커밋 전에 검토할 수 있도록 변경이 완료된 직후 바로 작성하세요.

---

## 10. 화면 명칭 참조표

UI 화면에 대해 논의할 때는 정식 명칭을 사용하세요. 모호함을 피하기 위해 양측 모두 동일한 이름을 사용해야 합니다.

프로젝트별 화면 명칭 참조표는 CLAUDE.md에 정의합니다. 표가 없다면 작업 전에 사용자에게 확인하세요.