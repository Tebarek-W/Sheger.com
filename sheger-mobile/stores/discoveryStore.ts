import { create } from "zustand";

type DiscoveryStore = {
  categoryId: string | null;
  setCategoryId: (categoryId: string | null) => void;
};

export const useDiscoveryStore = create<DiscoveryStore>((set) => ({
  categoryId: null,
  setCategoryId: (categoryId) => set({ categoryId }),
}));
