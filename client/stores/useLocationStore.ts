import { create } from "zustand";
import type { LocationState } from "@/shared/types/location";

async function resolveCityFromCoords(lat: number, lon: number): Promise<string> {
  console.log("[location] coords:", { lat, lon });
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "Accept-Language": "ko" } }
    );
    const data = await res.json();
    console.log("[location] nominatim raw:", data.address);
    const city =
      data.address?.city ||
      data.address?.county ||
      data.address?.state ||
      "현재 위치";
    console.log("[location] resolved city:", city);
    return city;
  } catch (err) {
    console.error("[location] nominatim fetch failed:", err);
    return "현재 위치";
  }
}

type LocationStore = {
  state: LocationState;
  requestPermission: () => void;
  setCity: (city: string) => void;
  reset: () => void;
};

export const useLocationStore = create<LocationStore>((set) => ({
  state: { status: "idle" },

  requestPermission: () => {
    if (!navigator?.geolocation) {
      set({ state: { status: "unavailable" } });
      return;
    }
    set({ state: { status: "requesting" } });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const city = await resolveCityFromCoords(
          pos.coords.latitude,
          pos.coords.longitude
        );
        set({ state: { status: "granted", city, source: "geo" } });
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
}));
