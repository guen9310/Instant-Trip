import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LocationState } from "@/shared/types/location";
import { fetchCityAction } from "@/app/actions/geocode";

type LocationStore = {
  state: LocationState;
  requestPermission: () => void;
  setCity: (city: string, sidoName?: string | null, lat?: number, lng?: number) => void;
  reset: () => void;
};

export const useLocationStore = create<LocationStore>()(
  persist(
    (set) => ({
      state: { status: "idle" },

      requestPermission: () => {
        if (!navigator?.geolocation) {
          set({ state: { status: "unavailable" } });
          return;
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
