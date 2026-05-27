import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LocationState } from "@/shared/types/location";
import { fetchCityAction } from "@/app/actions/geocode";

type LocationStore = {
  state: LocationState;
  requestPermission: () => void;
  setCity: (city: string) => void;
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
            const city = await fetchCityAction(
              pos.coords.latitude,
              pos.coords.longitude
            );
            set({ state: { status: "granted", city, source: "geo", lat: pos.coords.latitude, lng: pos.coords.longitude } });
          },
          (err) => {
            set({ state: { status: err.code === err.TIMEOUT ? "timeout" : "denied" } });
          },
          { timeout: 10000 }
        );
      },

      setCity: (city: string) => {
        set({ state: { status: "granted", city, source: "manual" } });
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
