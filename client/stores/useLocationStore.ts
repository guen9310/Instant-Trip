import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LocationState } from "@/shared/types/location";
import { fetchCityAction } from "@/app/actions/geocode";

type LocationStore = {
  state: LocationState;
  requestPermission: () => Promise<void>;
  setCity: (city: string, sidoName?: string | null, lat?: number, lng?: number) => void;
  reset: () => void;
};

// "manual"은 사용자가 지역을 직접 고른 상태 — 자동 위치 확인 결과보다 항상 우선한다
// (아래 persist merge 주석과 같은 원칙).
const isManual = (state: LocationState) =>
  state.status === "granted" && state.source === "manual";

export const useLocationStore = create<LocationStore>()(
  persist(
    (set, get) => {
      // requestPermission은 Permissions API 조회와 getCurrentPosition(최대 10초)을
      // 기다리는 동안 제어를 놓는다. 그 사이 사용자가 "지역 직접 선택"으로 지역을
      // 고르면(setCity), 뒤늦게 도착한 위치 확인 결과가 그 선택을 덮어써 화면이
      // 다시 "위치 권한이 거부되었어요"로 되돌아간다. 비동기 경계를 넘어온 set은
      // 모두 이 함수를 거쳐 수동 선택을 밀어내지 않도록 한다.
      const setUnlessManual = (next: LocationState) => {
        if (isManual(get().state)) return;
        set({ state: next });
      };

      return {
        state: { status: "idle" },

        requestPermission: async () => {
          // 이미 수동 선택된 상태면 권한 팝업조차 띄우지 않는다.
          if (isManual(get().state)) return;

          if (!navigator?.geolocation) {
            setUnlessManual({ status: "unavailable" });
            return;
          }
          // Permissions API로 브라우저 차원의 거부 여부를 먼저 확인한다.
          // "denied"면 getCurrentPosition을 호출해도 팝업이 뜨지 않으므로 즉시 반환.
          if ("permissions" in navigator) {
            try {
              const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
              if (result.state === "denied") {
                setUnlessManual({ status: "system-denied" });
                return;
              }
            } catch {
              // Permissions API 미지원 환경 — 기존 흐름으로 진행
            }
          }
          setUnlessManual({ status: "requesting" });
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              // fetchCityAction은 실패해도 항상 폴백 값을 반환하도록 되어 있지만,
              // 예기치 못한 예외까지 여기서 잡아두지 않으면 이 Promise가 아무도
              // await하지 않는 콜백이라 status가 "requesting"에 영구히 멈춘다.
              try {
                const { displayName, sidoName } = await fetchCityAction(
                  pos.coords.latitude,
                  pos.coords.longitude
                );
                setUnlessManual({
                  status: "granted",
                  city: displayName,
                  sidoName,
                  source: "geo",
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                });
              } catch (err) {
                console.log("[location] 지오코딩 실패 — 좌표만으로 진행:", err);
                setUnlessManual({
                  status: "granted",
                  city: "현재 위치",
                  sidoName: null,
                  source: "geo",
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                });
              }
            },
            (err) => {
              setUnlessManual({ status: err.code === err.TIMEOUT ? "timeout" : "denied" });
            },
            { timeout: 10000 }
          );
        },

        setCity: (city: string, sidoName?: string | null, lat?: number, lng?: number) => {
          set({ state: { status: "granted", city, sidoName: sidoName ?? null, source: "manual", lat, lng } });
        },

        reset: () => {
          set({ state: { status: "idle" } });
        },
      };
    },
    {
      name: "location-store",
      partialize: (s) => ({ state: s.state }),
      // 새로고침 등으로 복원된 "geo" 위치는 그 사이 사용자가 이동했을 수 있으므로
      // "restored"로 표시해 재확인 전까지는 확정된 위치로 취급하지 않는다.
      // "manual"은 위치 이동과 무관한 선택이므로 그대로 유지한다.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { state?: LocationState } | undefined;
        if (!persisted?.state) return currentState;
        const restoredState: LocationState =
          persisted.state.status === "granted" && persisted.state.source === "geo"
            ? { ...persisted.state, source: "restored" }
            : persisted.state;
        return { ...currentState, state: restoredState };
      },
    }
  )
);
