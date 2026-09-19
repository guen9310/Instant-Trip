"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientRead, HYDRATING } from "@/client/hooks/useClientRead";
import { fetchNearbyPoisAction } from "@/app/actions/course";
import { saveCourseCompletionAction } from "@/app/actions/completion";
import { redirectToSignIn } from "@/client/redirectToSignIn";
import { readStartedCourse, writeStartedCourse } from "@/client/startedCourseStorage";
import { buildCompletionPayload } from "@/shared/utils/completionPayload";
import { withTimeout } from "@/shared/utils/withTimeout";
import { COURSE_ACTION_TIMEOUT_MS } from "@/shared/constants/courseAction";
import type {
  JourneyPlace,
  NearbyCategory,
  NearbyPoi,
  ResumableCourse,
  StartedCourse,
} from "@/shared/types/course.types";

const COMPLETE_ERROR = "방문 완료를 저장하지 못했어요. 다시 시도해주세요.";

// DB 복원 데이터 → 진행 중 코스 저장 형식. 시작 시각은 모르므로 비워둔다 —
// 완료 저장 시 서버가 DB에 있는 시작 시각을 보존한다.
function fromResumable(r: ResumableCourse): StartedCourse {
  return {
    courseId: r.courseId,
    place: r.place,
    courseName: r.courseName,
    scale: r.scale,
    completionId: r.completionId,
    dbCourseId: r.courseId,
  };
}

// 검색 원점 — place.coord가 null인 구버전 페이로드는 저장해둔 유저 GPS로 대체
// (mapX = 경도, mapY = 위도, 카카오 좌표계)
function searchCoordOf(c: StartedCourse): { lat: number; lng: number } | null {
  return c.place.coord ?? (c.mapX != null && c.mapY != null ? { lat: c.mapY, lng: c.mapX } : null);
}

type CourseActiveState =
  | { status: "loading" }
  | {
      status: "ready";
      place: JourneyPlace;
      // 지도 마커용 좌표 — place.coord가 없는 구버전 페이로드는 검색 원점으로 대체(placeCoord 패턴,
      // CourseResultView와 동일). 둘 다 없으면 null → 호출부에서 지도 자체를 숨긴다.
      placeCoord: { lat: number; lng: number } | null;
      cat: NearbyCategory;
      setCat: (cat: NearbyCategory) => void;
      pois: NearbyPoi[];
      poisLoading: boolean;
      filteredPois: NearbyPoi[];
      selectedPoiId: string | null;
      selectPoi: (id: string | null) => void;
      handleComplete: () => void;
      completing: boolean;
      completeError: string | null;
    };

export function useCourseActive(
  courseId: string,
  // URL의 코스와 일치하는 로컬 진행 중 코스(startedCourse)가 없을 때(다른 기기·저장소
  // 초기화, 진행 중 다른 코스로 교체 등) 화면을 복원할 서버 측 대비책. page.tsx가 미리 조회해 내려준다.
  dbFallback: ResumableCourse | null,
  // page.tsx가 getAuthState()로 미리 판정 — 세션이 서버에서 무효화된 경우에만 true.
  // dbFallback이 없을 때(로컬도 DB도 복원 못함) 이 값에 따라 /start로 조용히 보낼지,
  // 로그인 화면의 만료 배너로 보낼지를 가른다.
  sessionExpired: boolean,
): CourseActiveState {
  const router = useRouter();

  // URL의 코스 ID와 일치하는 진행 중 코스만 읽는다 — 다른 코스의 로컬 데이터가 남아 있어도
  // (다른 코스 미리보기·이전 계정 등) 이 화면에는 섞이지 않고 dbFallback으로 넘어간다.
  const local = useClientRead(() => readStartedCourse(courseId));
  const [cat, setCat] = useState<NearbyCategory>("all");
  const [pois, setPois] = useState<NearbyPoi[]>([]);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [selectedPoiId, selectPoi] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // 화면에 쓰는 유효 코스 — 저장소 읽기 결과에서 직접 도출하고, 없으면 dbFallback으로 대체한다.
  // 장소 표시와 주변 조회 좌표가 같은 데이터에서 나오게 해, DB로만 복원해도 주변 조회가 돈다.
  const effective: StartedCourse | null | undefined =
    local === HYDRATING
      ? undefined
      : (local ?? (dbFallback ? fromResumable(dbFallback) : null));
  const current: JourneyPlace | undefined = effective?.place;
  const searchCoord = effective ? searchCoordOf(effective) : null;

  useEffect(() => {
    if (local !== null) return; // 로딩 중이거나 이미 유효한 로컬 세션이 있음

    if (!dbFallback) {
      // 세션이 서버에서 무효화된 경우엔 "저장된 코스가 없어요" 취급으로 조용히
      // /start로 보내지 않고, CourseResultView·SettingsView와 동일하게 로그인 화면의
      // 만료 배너로 보낸다 — redirectToSignIn은 하드 네비게이션이라 컴포넌트 언마운트
      // 여부와 무관하게 항상 배너가 뜬다.
      if (sessionExpired) {
        redirectToSignIn("session_expired");
        return;
      }
      router.push("/start");
      return;
    }

    // DB에서 복원한 코스를 진행 중 코스 저장소에 반영 — 완료 화면이 같은 데이터를 읽고,
    // 완료 저장이 completionId/dbCourseId로 INSERT 대신 UPDATE 경로를 타게 한다.
    writeStartedCourse(fromResumable(dbFallback));
  }, [local, dbFallback, sessionExpired, router]);

  // 좌표를 문자열 키로 변환해 객체 참조 문제 없이 의존성 비교
  const coordKey = searchCoord ? `${searchCoord.lat},${searchCoord.lng}` : null;

  // 파생 상태 — 키가 있는데 아직 해당 키로 fetch하지 않은 경우 = 로딩 중
  const poisLoading = coordKey !== null && coordKey !== fetchedKey;

  useEffect(() => {
    if (!coordKey) return;
    const [lat, lng] = coordKey.split(",").map(Number);
    // withTimeout: 서버 액션 자체는 reject조차 안 되고 영원히 pending일 수 있어(진짜
    // 네트워크 hang — withTimeout.ts 참고) .catch()만으론 부족하다.
    withTimeout(fetchNearbyPoisAction(lat, lng), COURSE_ACTION_TIMEOUT_MS)
      .then((result) => {
        if (result.ok) {
          setPois(result.pois);
        }
        setFetchedKey(coordKey);
      })
      .catch((err) => {
        // reject(네트워크 단절 등)로 setFetchedKey를 못 부르면 poisLoading이
        // (coordKey !== fetchedKey) 영구히 true로 남아 주변 정보 섹션이 로딩
        // 상태에 고착된다 — 실패해도 반드시 fetchedKey는 갱신한다.
        console.error("[nearby] 주변 정보 조회 실패:", err);
        setFetchedKey(coordKey);
      });
  }, [coordKey]);

  if (!current) {
    return { status: "loading" };
  }

  const filteredPois = cat === "all" ? pois : pois.filter((p) => p.category === cat);

  // 방문 완료 — 완료 기록은 프로필의 근거라, 서버 저장 성공을 확인한 뒤에만 완료 화면으로
  // 넘어간다. 완료 화면은 후기만 덧붙이므로, 거기서 그냥 떠나도 완료 사실은 이미 남아 있다.
  const handleComplete = async () => {
    if (completing) return;
    // 저장소를 다시 읽는다 — 시작 응답이 늦게 도착해 붙인 DB ID까지 반영하기 위함.
    const latest = readStartedCourse(courseId) ?? effective ?? null;
    const completedAt = Date.now();
    const payload = buildCompletionPayload({
      pending: latest,
      status: "completed",
      startedAt: latest?.startedAt ?? null,
      completedAt,
    });
    // 기록할 추천 데이터 자체가 없는 구버전 페이로드 — 저장할 게 없으니 화면 흐름만 잇는다.
    if (!latest || !payload) {
      router.push(`/course/done/${courseId}`);
      return;
    }

    setCompleting(true);
    setCompleteError(null);
    try {
      const result = await withTimeout(saveCourseCompletionAction(payload), COURSE_ACTION_TIMEOUT_MS);
      if (!result.ok) {
        if (result.reason) {
          // 로컬 기록은 그대로 둔다 — 다시 로그인해 이어서 열면 같은 코스로 재시도할 수 있다.
          redirectToSignIn(result.reason === "invalid_session" ? "session_expired" : undefined);
          return;
        }
        setCompleting(false);
        setCompleteError(COMPLETE_ERROR);
        return;
      }
      writeStartedCourse({
        ...latest,
        completionId: result.completionId,
        dbCourseId: result.dbCourseId,
        completedAt,
      });
      router.push(`/course/done/${courseId}`);
    } catch (err) {
      console.error("[complete] 방문 완료 저장 실패:", err);
      setCompleting(false);
      setCompleteError(COMPLETE_ERROR);
    }
  };

  return {
    status: "ready",
    place: current,
    placeCoord: current.coord ?? searchCoord,
    cat,
    setCat,
    pois,
    poisLoading,
    filteredPois,
    selectedPoiId,
    selectPoi,
    handleComplete,
    completing,
    completeError,
  };
}
