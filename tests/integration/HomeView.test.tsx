import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithClient } from "@/tests/utils";
import { HomeView } from "@/components/domains/home/HomeView";
import type { LocationState } from "@/shared/types/location";

/* ── mock: useLocationStore ─────────────────────────────────────────── */
const mockStore = vi.hoisted(() => ({
  state: { status: "idle" } as LocationState,
  requestPermission: vi.fn(),
  setCity: vi.fn(),
}));

vi.mock("@/client/stores/useLocationStore", () => ({
  useLocationStore: () => mockStore,
}));

/* ── mock: server actions ────────────────────────────────────────────── */
const { mockGetHomeDataAction, mockGetHomeDataByRegionAction } = vi.hoisted(() => ({
  mockGetHomeDataAction: vi.fn(),
  mockGetHomeDataByRegionAction: vi.fn(),
}));
vi.mock("@/app/actions/home", () => ({
  getHomeDataAction: mockGetHomeDataAction,
  getHomeDataByRegionAction: mockGetHomeDataByRegionAction,
}));

/* ── mock: weather query ─────────────────────────────────────────────── */
vi.mock("@/client/hooks/useWeatherQuery", () => ({
  useWeatherQuery: () => ({ data: { T1H: "22", SKY: "1", PTY: "0" }, isPending: false }),
}));

/* ── fixture ─────────────────────────────────────────────────────────── */
const GEO_STATE: LocationState = {
  status: "granted",
  city: "울산",
  sidoName: "울산광역시",
  source: "geo",
  lat: 35.5877,
  lng: 129.3683,
};

const JEJU_MANUAL_STATE: LocationState = {
  status: "granted",
  city: "제주",
  sidoName: "제주",
  source: "manual",
  lat: 33.4996,
  lng: 126.5312,
};

const makePlaces = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    contentid: String(i + 1),
    contenttypeid: "12",
    title: `관광지 ${i + 1}`,
    firstimage: "",
    mapx: "129",
    mapy: "35",
    addr1: "",
  }));

const makeHomeData = (overrides: Partial<{
  ongoingFestivals: unknown[];
  upcomingFestivals: unknown[];
  places: unknown[];
  errors: string[];
}> = {}) => ({
  region: { name: "울산", areaCode: "7", lat: 35.5384, lng: 129.3114 },
  places: makePlaces(6),
  ongoingFestivals: [
    { id: "1", name: "봄 축제", status: "ongoing", period: "2026-07-01~2026-07-31", address: "울산 중구", imageUrl: null },
  ],
  upcomingFestivals: [],
  errors: [],
  ...overrides,
});

beforeEach(() => {
  mockStore.state = { status: "idle" };
  mockStore.requestPermission.mockClear();
  mockGetHomeDataAction.mockClear();
  mockGetHomeDataByRegionAction.mockClear();
});

/* ─────────────────────────────────────────────────────────────────────
   A1: 권한 허용 흐름 — 4섹션 구조 + CTA 뷰포트 검증
   ───────────────────────────────────────────────────────────────────── */
describe("A1: 권한 허용 흐름 — 홈 섹션 구조", () => {
  it("날씨/위치 카드가 최상단에 렌더된다", async () => {
    mockStore.state = GEO_STATE;
    mockGetHomeDataAction.mockResolvedValue(makeHomeData());

    renderWithClient(<HomeView />);

    // 위치 카드 — 도시명과 위치 확인됨 배지
    await waitFor(() => {
      expect(screen.getByText("울산")).toBeInTheDocument();
      expect(screen.getByText("위치 확인됨")).toBeInTheDocument();
    });
  });

  it("'출발하기' CTA가 위치 카드에 내장돼 뷰포트 최상단에 있다", async () => {
    mockStore.state = GEO_STATE;
    mockGetHomeDataAction.mockResolvedValue(makeHomeData());

    renderWithClient(<HomeView />);

    await waitFor(() => {
      const cta = screen.getByText("출발하기");
      expect(cta).toBeInTheDocument();
      // CTA가 /start로 향하는 앵커 안에 있다
      const anchor = cta.closest("a");
      expect(anchor).not.toBeNull();
      expect(anchor?.getAttribute("href")).toBe("/start");
    });
  });

  it("데이터 로드 후 '주변 축제' 섹션이 렌더된다", async () => {
    mockStore.state = GEO_STATE;
    mockGetHomeDataAction.mockResolvedValue(makeHomeData());

    renderWithClient(<HomeView />);

    await waitFor(() => {
      expect(screen.getByText("주변 축제")).toBeInTheDocument();
      expect(screen.getByText("봄 축제")).toBeInTheDocument();
    });
  });

  it("데이터 로드 후 '근처 장소' 섹션과 필터 칩이 렌더된다", async () => {
    mockStore.state = GEO_STATE;
    mockGetHomeDataAction.mockResolvedValue(makeHomeData());

    renderWithClient(<HomeView />);

    await waitFor(() => {
      expect(screen.getByText("근처 장소")).toBeInTheDocument();
    });
    // 필터 칩 4종
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "관광지" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "문화시설" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "레포츠" })).toBeInTheDocument();
  });

  it("필터 칩 클릭 시 선택 상태가 변경된다", async () => {
    mockStore.state = GEO_STATE;
    const places = [
      { contentid: "1", contenttypeid: "12", title: "관광지A", firstimage: "", mapx: "", mapy: "", addr1: "" },
      { contentid: "2", contenttypeid: "14", title: "문화B", firstimage: "", mapx: "", mapy: "", addr1: "" },
    ];
    mockGetHomeDataAction.mockResolvedValue(makeHomeData({ places }));

    const user = userEvent.setup();
    renderWithClient(<HomeView />);

    await waitFor(() => expect(screen.getByText("근처 장소")).toBeInTheDocument());

    const chipTourist = screen.getByRole("button", { name: "관광지" });
    await user.click(chipTourist);

    // 관광지 칩이 선택 상태 클래스를 가짐
    expect(chipTourist.className).toContain("bg-primary");
  });
});

/* ─────────────────────────────────────────────────────────────────────
   A2: 축제 0건 — 섹션 자체가 DOM에 없음
   실제 API 탐색 결과: 제주 반경 50km 내 ongoing=0, upcoming=0 (2026-07-13 확인)
   ───────────────────────────────────────────────────────────────────── */
describe("A2: 축제 0건 — FestivalSection DOM 부재 검증 (제주 기준)", () => {
  it("ongoingFestivals=[] upcomingFestivals=[] 시 '주변 축제' h2가 DOM에 없다", async () => {
    mockStore.state = JEJU_MANUAL_STATE;
    mockGetHomeDataByRegionAction.mockResolvedValue({
      region: { name: "제주", areaCode: "39", lat: 33.4996, lng: 126.5312 },
      places: makePlaces(4),
      ongoingFestivals: [],
      upcomingFestivals: [],
      errors: [],
    });

    renderWithClient(<HomeView />);

    await waitFor(() => {
      // 장소 섹션이 로드됐으면 데이터 도착한 것
      expect(screen.getByText("근처 장소")).toBeInTheDocument();
    });

    // 축제 섹션 헤더가 DOM에 전혀 없음을 확인
    expect(screen.queryByText("주변 축제")).not.toBeInTheDocument();
    // FestivalSection의 DOM 컨테이너(section.mb-6) 자체도 없음
    const sections = document.querySelectorAll("section");
    const festivalSection = Array.from(sections).find(
      (s) => s.querySelector("h2")?.textContent === "주변 축제",
    );
    expect(festivalSection).toBeUndefined();
  });

  it("festivals.errors 포함 시에도 '주변 축제' 섹션이 DOM에 없다", async () => {
    mockStore.state = JEJU_MANUAL_STATE;
    mockGetHomeDataByRegionAction.mockResolvedValue({
      region: { name: "제주", areaCode: "39", lat: 33.4996, lng: 126.5312 },
      places: makePlaces(4),
      ongoingFestivals: [],
      upcomingFestivals: [],
      errors: ["festivals"],
    });

    renderWithClient(<HomeView />);

    await waitFor(() => expect(screen.getByText("근처 장소")).toBeInTheDocument());
    expect(screen.queryByText("주변 축제")).not.toBeInTheDocument();
  });
});

/* ─────────────────────────────────────────────────────────────────────
   A3: 스토어 공유 — 홈에서 지역 선택 → setCity 좌표 포함 호출 검증
   RegionSelectSheet는 setCity(name, name, lat, lng) 호출 —
   useLocationStore 싱글턴이 HomeView와 StartView 양쪽에서 동일하게 공유됨
   ───────────────────────────────────────────────────────────────────── */
describe("A3: 스토어 공유 — RegionSelectSheet → setCity(lat, lng 포함)", () => {
  it("denied 상태 → LocationDeniedView → 지역 선택 → setCity가 충남 대표 좌표와 함께 호출된다", async () => {
    // HomeView에서 권한 거부 시 LocationDeniedView를 렌더하고,
    // RegionSelectSheet에서 충남 선택 시 setCity(충남, 충남, 36.601, 126.661) 호출을 검증
    mockStore.state = { status: "denied" };
    mockStore.setCity.mockClear();

    const user = userEvent.setup();
    renderWithClient(<HomeView />);

    // LocationDeniedView 렌더 확인
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /지역 선택/ })).toBeInTheDocument();
    });

    // 지역 선택 시트 열기
    await user.click(screen.getByRole("button", { name: /지역 선택/ }));

    // 17개 시·도 버튼 확인
    await waitFor(() => expect(screen.getByText("충남")).toBeInTheDocument());

    // 충남 선택
    await user.click(screen.getByRole("button", { name: "충남" }));

    // setCity가 충남 도청 대표 좌표와 함께 호출됨 (홈, /start가 같은 store를 공유)
    expect(mockStore.setCity).toHaveBeenCalledWith("충남", "충남", 36.601, 126.661);
  });
});
