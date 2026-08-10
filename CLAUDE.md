@AGENTS.md

# 이 프로젝트 전용 컨벤션

AGENTS.md는 여러 프로젝트에 걸쳐 재사용하는 공통 규칙입니다. 아래는 이 프로젝트("지금어때")에서만 적용되는 구체적인 선택입니다.

## 스택 선택

- **UI 킷 (AGENTS.md 4번)**: `commons/`의 기본 UI 컴포넌트는 **shadcn/ui**에서 설치합니다 (MUST). 처음부터 작성하기 전에 `npx shadcn@latest add <component>`로 사용 가능한지 먼저 확인하세요.
- **서버 상태 (AGENTS.md 5번)**: **TanStack Query**를 사용합니다.
- **클라이언트 상태 (AGENTS.md 5번)**: **Zustand**를 사용합니다.
- **검증/타입 (AGENTS.md 6번)**: **zod**를 사용합니다. TS 타입은 `z.infer<typeof schema>`로 도출하세요.

## GitHub 저장소 설정

- `guen9310/Instant-Trip` 저장소는 squash merge 커밋 메시지 소스가 `PR_BODY`(제목은 `PR_TITLE`)로 설정되어 있습니다 (2026-08-09 적용). 에이전트가 커밋마다 붙이는 `Co-Authored-By` trailer가 squash 시 커밋 개수만큼 중복되는 문제를 막기 위함 — 근거와 재설정 명령은 AGENTS.md 10번(PR) 참고.
- 이 설정은 GitHub 서버에 저장된 저장소 고유 값이라 로컬 git/gh 설정과 무관하며, 저장소를 옮기거나 새로 만들면 재적용해야 합니다.

## 화면 명칭 참조표

UI 화면에 대해 논의할 때는 아래의 정식 명칭을 사용하세요. 모호함을 피하기 위해 양측 모두 동일한 이름을 사용해야 합니다.

### Auth

| 정식 명칭 | 컴포넌트 | 경로 |
|---|---|---|
| 로그인 화면 | `SignInForm` | `/sign-in` |
| 이메일 인증 화면 | `VerifyForm` | `/sign-in/verify` |

### Onboarding

| 정식 명칭 | 컴포넌트 | 경로 |
|---|---|---|
| 온보딩 화면 | `OnboardingForm` | `/onboarding` |
| 온보딩 완료 화면 | `OnboardingDoneView` | `/onboarding/done` |

### Main Tabs

| 정식 명칭 | 컴포넌트 | 경로 |
|---|---|---|
| 홈 화면 | `HomeView` | `/` |
| 출발 설정 화면 | `StartView` | `/start` |
| 프로필 화면 | `ProfileView` | `/profile` |
| 설정 화면 | `SettingsView` | `/settings` |

### Course Flow

| 정식 명칭 | 컴포넌트 | 경로 |
|---|---|---|
| 코스 추천 화면 | `CourseResultView` | `/course/preview` |
| 코스 진행 화면 | `CourseActiveView` | `/course/active/[id]` |
| 코스 완료 화면 | `CourseDoneView` | `/course/done/[id]` |

주변 정보(`NearbyPanel`)는 별도 화면·오버레이가 아니라 코스 진행 화면 내에 인라인으로 병합된 펼치기 섹션입니다. 예전엔 드로어로 열리는 방식이었으나, 여는 동작 자체가 불필요한 액션이라 페이지에 직접 병합했습니다(`CourseActiveView.tsx` 참고).
