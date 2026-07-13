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

export const useLocationStore = create<LocationStore>()(
  persist(
    (set) => ({
      state: { status: "idle" },

      requestPermission: async () => {
        if (!navigator?.geolocation) {
          set({ state: { status: "unavailable" } });
          return;
        }
        // Permissions API로 브라우저 차원의 거부 여부를 먼저 확인한다.
        // "denied"면 getCurrentPosition을 호출해도 팝업이 뜨지 않으므로 즉시 반환.
        if ("permissions" in navigator) {
          try {
            const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
            if (result.state === "denied") {
              set({ state: { status: "system-denied" } });
              return;
            }
          } catch {
            // Permissions API 미지원 환경 — 기존 흐름으로 진행
          }
        }
        set({ state: { status: "requesting" } });
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { displayName, sidoName } = await fetchCityAction(
              pos.coords.latitude,
              pos.coords.longitude
            );
            set({
              state: {
                status: "granted",
                city: displayName,
                sidoName,
                source: "geo",
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              },
            });
          },
          (err) => {
            set({ state: { status: err.code === err.TIMEOUT ? "timeout" : "denied" } });
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
    }),
    {
      name: "location-store",
      partialize: (s) => ({ state: s.state }),
    }
  )
);
