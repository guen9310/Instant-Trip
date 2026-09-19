import type { StartedCourse } from "@/shared/types/course.types";

// 진행 중 코스(startedCourse)의 localStorage 접근을 한곳에 모은다.
// 미리보기용 pendingCourse와 키를 분리하고, 읽을 때는 항상 URL의 코스 ID와 대조해
// 다른 코스의 로컬 데이터가 현재 화면에 섞이지 않게 한다.
const STARTED_KEY = "startedCourse";
const PENDING_KEY = "pendingCourse";

function readRaw(): StartedCourse | null {
  try {
    const raw = localStorage.getItem(STARTED_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<StartedCourse>;
    if (!data.courseId || !data.place) return null;
    return data as StartedCourse;
  } catch {
    return null;
  }
}

// URL의 id는 새로 출발한 코스면 클라이언트 courseId, 프로필 "이어서"면 DB courses.id다 —
// 둘 중 하나라도 일치할 때만 같은 코스로 본다.
export function readStartedCourse(courseId: string): StartedCourse | null {
  const data = readRaw();
  if (!data) return null;
  return data.courseId === courseId || data.dbCourseId === courseId ? data : null;
}

export function writeStartedCourse(data: StartedCourse): void {
  localStorage.setItem(STARTED_KEY, JSON.stringify(data));
}

// 비동기 응답 반영용 — 요청 당시 코스(courseId)가 지금도 저장 대상일 때만 patch를 적용한다.
// 그사이 다른 코스로 바뀌었으면 아무것도 하지 않고 false를 돌려준다.
export function updateStartedCourse(
  courseId: string,
  patch: (current: StartedCourse) => Partial<StartedCourse> | null,
): boolean {
  const current = readRaw();
  if (!current || current.courseId !== courseId) return false;
  const next = patch(current);
  if (!next) return false;
  writeStartedCourse({ ...current, ...next });
  return true;
}

export function clearStartedCourse(): void {
  localStorage.removeItem(STARTED_KEY);
}

// 로그아웃 시 — 이 브라우저에 남은 사용자 소유 코스 데이터를 모두 지운다.
export function clearCourseStorage(): void {
  try {
    localStorage.removeItem(STARTED_KEY);
    localStorage.removeItem(PENDING_KEY);
  } catch {}
}
