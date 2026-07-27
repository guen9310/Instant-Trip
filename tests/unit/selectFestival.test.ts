import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { generateCourseFromFestival } from "@/lib/pipeline/selectFestival";
import { fetchDetail } from "@/lib/pipeline/course";
import { getFestivalIntro } from "@/lib/tour/festivalDetail";
import { fetchNearbyFestivals } from "@/lib/pipeline/festival";
import type { GenerateCourseFromFestivalInput } from "@/lib/pipeline/selectFestival";

vi.mock("@/lib/pipeline/course", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/pipeline/course")>("@/lib/pipeline/course");
  return { ...actual, fetchDetail: vi.fn() };
});
vi.mock("@/lib/tour/festivalDetail", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/tour/festivalDetail")>(
      "@/lib/tour/festivalDetail",
    );
  return { ...actual, getFestivalIntro: vi.fn() };
});
vi.mock("@/lib/pipeline/festival", () => ({
  fetchNearbyFestivals: vi.fn().mockResolvedValue({ ongoing: [], upcoming: [] }),
}));

const mockedFetchDetail = fetchDetail as unknown as Mock;
const mockedGetFestivalIntro = getFestivalIntro as unknown as Mock;
void fetchNearbyFestivals; // 임포트만으로 vi.mock 대상 지정

function baseInput(
  overrides: Partial<GenerateCourseFromFestivalInput> = {},
): GenerateCourseFromFestivalInput {
  return {
    id: "2026-07-29_테스트축제",
    contentId: null,
    name: "테스트 축제",
    address: "서울특별시 종로구 세종대로 1",
    lat: 37.5663,
    lng: 126.9779,
    startDate: "2026-07-29",
    endDate: "2026-08-29",
    description: null,
    imageUrl: null,
    ...overrides,
  };
}

describe("generateCourseFromFestival", () => {
  beforeEach(() => {
    mockedFetchDetail.mockReset();
    mockedGetFestivalIntro.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("festivalPhase 판정 (날짜 비교)", () => {
    it("오늘(KST)이 시작일 이전이면 upcoming, isOpenNow는 false", async () => {
      vi.setSystemTime(new Date("2026-07-27T12:00:00+09:00"));
      const result = await generateCourseFromFestival(baseInput());
      if (!result.ok) throw new Error("expected ok:true");
      expect(result.mainPlace.festivalPhase).toBe("upcoming");
      expect(result.mainPlace.festivalStartLabel).toBe("07.29");
      expect(result.availability.isOpenNow).toBe(false);
    });

    it("오늘이 시작일~종료일 사이면 ongoing", async () => {
      vi.setSystemTime(new Date("2026-08-01T12:00:00+09:00"));
      const result = await generateCourseFromFestival(baseInput());
      if (!result.ok) throw new Error("expected ok:true");
      expect(result.mainPlace.festivalPhase).toBe("ongoing");
    });

    it("오늘이 시작일 당일이면 ongoing(경계값 포함)", async () => {
      vi.setSystemTime(new Date("2026-07-29T00:30:00+09:00"));
      const result = await generateCourseFromFestival(baseInput());
      if (!result.ok) throw new Error("expected ok:true");
      expect(result.mainPlace.festivalPhase).toBe("ongoing");
    });

    it("오늘이 종료일 이후면 ended", async () => {
      vi.setSystemTime(new Date("2026-09-01T12:00:00+09:00"));
      const result = await generateCourseFromFestival(baseInput());
      if (!result.ok) throw new Error("expected ok:true");
      expect(result.mainPlace.festivalPhase).toBe("ended");
    });
  });

  describe("공공데이터포털 단독 축제 (contentId 없음)", () => {
    it("detailCommon2/detailIntro2를 호출하지 않고 입력값만으로 조립한다", async () => {
      vi.setSystemTime(new Date("2026-08-01T12:00:00+09:00"));
      const result = await generateCourseFromFestival(
        baseInput({ description: "공공데이터포털 기본 소개" }),
      );

      expect(mockedFetchDetail).not.toHaveBeenCalled();
      expect(mockedGetFestivalIntro).not.toHaveBeenCalled();
      if (!result.ok) throw new Error("expected ok:true");
      expect(result.mainPlace.overview).toBe("공공데이터포털 기본 소개");
      expect(result.mainPlace.programInfo).toBeNull();
      expect(result.mainPlace.organizerUrl).toBeNull();
      expect(result.mainPlace.contentId).toBe("2026-07-29_테스트축제"); // id로 폴백
      expect(result.mainPlace.hours).toBe("07.29 ~ 08.29"); // playtime 없음
    });
  });

  describe("Tour API 매칭된 축제 (contentId 있음)", () => {
    it("overview(detailCommon2)가 program(detailIntro2)보다 소개글로 우선한다", async () => {
      vi.setSystemTime(new Date("2026-08-01T12:00:00+09:00"));
      mockedFetchDetail.mockResolvedValue({
        overview: "<p>서술형 소개글</p>",
        homepage: "",
      });
      mockedGetFestivalIntro.mockResolvedValue({
        program: "- 주요 프로그램 : 야시장",
        playtime: "",
        eventhomepage: "",
      });

      const result = await generateCourseFromFestival(
        baseInput({ contentId: "12345", description: "폴백 소개" }),
      );

      if (!result.ok) throw new Error("expected ok:true");
      expect(result.mainPlace.overview).toBe("서술형 소개글"); // HTML 태그 제거됨
      expect(result.mainPlace.programInfo?.main).toBe("야시장"); // program은 별도 보존
    });

    it("overview가 없으면 program으로, program도 없으면 description으로 폴백한다", async () => {
      vi.setSystemTime(new Date("2026-08-01T12:00:00+09:00"));
      mockedFetchDetail.mockResolvedValue({ overview: "", homepage: "" });
      mockedGetFestivalIntro.mockResolvedValue({
        program: "프로그램 텍스트",
        playtime: "",
        eventhomepage: "",
      });

      const result = await generateCourseFromFestival(
        baseInput({ contentId: "12345", description: "최후 폴백" }),
      );
      if (!result.ok) throw new Error("expected ok:true");
      expect(result.mainPlace.overview).toBe("프로그램 텍스트");
    });

    it("homepage(detailCommon2)를 eventhomepage(detailIntro2)보다 우선하고, 스킴이 없으면 http://를 붙인다", async () => {
      vi.setSystemTime(new Date("2026-08-01T12:00:00+09:00"));
      mockedFetchDetail.mockResolvedValue({ overview: "", homepage: "example-festival.kr" });
      mockedGetFestivalIntro.mockResolvedValue({
        program: "",
        playtime: "",
        eventhomepage: "https://event.example.com",
      });

      const result = await generateCourseFromFestival(baseInput({ contentId: "12345" }));
      if (!result.ok) throw new Error("expected ok:true");
      expect(result.mainPlace.organizerUrl).toBe("http://example-festival.kr");
    });

    it("homepage가 비어있으면 eventhomepage로 폴백한다", async () => {
      vi.setSystemTime(new Date("2026-08-01T12:00:00+09:00"));
      mockedFetchDetail.mockResolvedValue({ overview: "", homepage: "" });
      mockedGetFestivalIntro.mockResolvedValue({
        program: "",
        playtime: "",
        eventhomepage: "https://event.example.com",
      });

      const result = await generateCourseFromFestival(baseInput({ contentId: "12345" }));
      if (!result.ok) throw new Error("expected ok:true");
      expect(result.mainPlace.organizerUrl).toBe("https://event.example.com");
    });

    it("둘 다 없으면 organizerUrl은 null", async () => {
      vi.setSystemTime(new Date("2026-08-01T12:00:00+09:00"));
      mockedFetchDetail.mockResolvedValue({ overview: "", homepage: "" });
      mockedGetFestivalIntro.mockResolvedValue({ program: "", playtime: "", eventhomepage: "" });

      const result = await generateCourseFromFestival(baseInput({ contentId: "12345" }));
      if (!result.ok) throw new Error("expected ok:true");
      expect(result.mainPlace.organizerUrl).toBeNull();
    });

    describe("playtime 기반 당일 운영시간 판정", () => {
      it("날짜 범위 안이라도 playtime 시간대 밖이면 isOpenNow는 false", async () => {
        // 08:00 — playtime(18:00~22:00) 밖
        vi.setSystemTime(new Date("2026-08-01T08:00:00+09:00"));
        mockedFetchDetail.mockResolvedValue({ overview: "", homepage: "" });
        mockedGetFestivalIntro.mockResolvedValue({
          program: "",
          playtime: "18:00~22:00",
          eventhomepage: "",
        });

        const result = await generateCourseFromFestival(baseInput({ contentId: "12345" }));
        if (!result.ok) throw new Error("expected ok:true");
        expect(result.mainPlace.festivalPhase).toBe("ongoing");
        expect(result.availability.isOpenNow).toBe(false);
        expect(result.mainPlace.hours).toBe("07.29 ~ 08.29 · 18:00~22:00");
      });

      it("날짜 범위 + playtime 시간대 안이면 isOpenNow는 true", async () => {
        vi.setSystemTime(new Date("2026-08-01T19:00:00+09:00"));
        mockedFetchDetail.mockResolvedValue({ overview: "", homepage: "" });
        mockedGetFestivalIntro.mockResolvedValue({
          program: "",
          playtime: "18:00~22:00",
          eventhomepage: "",
        });

        const result = await generateCourseFromFestival(baseInput({ contentId: "12345" }));
        if (!result.ok) throw new Error("expected ok:true");
        expect(result.availability.isOpenNow).toBe(true);
      });

      it("playtime이 파싱 불가능한 형식이면 날짜 판정만으로 관대 처리한다", async () => {
        vi.setSystemTime(new Date("2026-08-01T03:00:00+09:00"));
        mockedFetchDetail.mockResolvedValue({ overview: "", homepage: "" });
        mockedGetFestivalIntro.mockResolvedValue({
          program: "",
          playtime: "상시 운영",
          eventhomepage: "",
        });

        const result = await generateCourseFromFestival(baseInput({ contentId: "12345" }));
        if (!result.ok) throw new Error("expected ok:true");
        expect(result.availability.isOpenNow).toBe(true); // 날짜만으로 판정 → ongoing이므로 true
      });
    });
  });

  describe("공통", () => {
    it("origin은 항상 selected이고 availabilityUncertain은 항상 false다", async () => {
      vi.setSystemTime(new Date("2026-08-01T12:00:00+09:00"));
      const result = await generateCourseFromFestival(baseInput());
      if (!result.ok) throw new Error("expected ok:true");
      expect(result.mainPlace.origin).toBe("selected");
      expect(result.mainPlace.availabilityUncertain).toBe(false);
    });

    it("내부 오류 발생 시 ok:false, code:UNKNOWN을 반환한다", async () => {
      vi.setSystemTime(new Date("2026-08-01T12:00:00+09:00"));
      mockedFetchDetail.mockRejectedValue(new Error("네트워크 오류"));
      mockedGetFestivalIntro.mockResolvedValue(null);

      const result = await generateCourseFromFestival(baseInput({ contentId: "12345" }));

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected ok:false");
      expect(result.code).toBe("UNKNOWN");
    });
  });
});
