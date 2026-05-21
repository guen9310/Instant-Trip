import { create } from "zustand";

type LocationStore = {
  city: string | null;
  setCity: (city: string | null) => void;
};

export const useLocationStore = create<LocationStore>((set) => ({
  city: null,
  setCity: (city) => set({ city }),
}));
