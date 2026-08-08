@AGENTS.md

# 이 프로젝트 전용 컨벤션

AGENTS.md는 여러 프로젝트에 걸쳐 재사용하는 공통 규칙입니다. 아래는 이 프로젝트("지금어때")에서만 적용되는 구체적인 선택입니다.

## 스택 선택

- **UI 킷 (AGENTS.md 4번)**: `commons/`의 기본 UI 컴포넌트는 **shadcn/ui**에서 설치합니다 (MUST). 처음부터 작성하기 전에 `npx shadcn@latest add <component>`로 사용 가능한지 먼저 확인하세요.
- **서버 상태 (AGENTS.md 5번)**: **TanStack Query**를 사용합니다.
- **클라이언트 상태 (AGENTS.md 5번)**: **Zustand**를 사용합니다.
- **검증/타입 (AGENTS.md 6번)**: **zod**를 사용합니다. TS 타입은 `z.infer<typeof schema>`로 도출하세요.

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

### Overlays / Sheets

| 정식 명칭 | 컴포넌트 | 진입 경로 |
|---|---|---|
| 주변 정보 시트 | `NearbyPanel` | 코스 진행 화면 → 주변 정보 보기 탭 |
