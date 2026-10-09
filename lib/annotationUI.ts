import { create } from "zustand";
export const useNotePanel = create<{
  openId: string | null;
  open: (id: string | null) => void;
}>((set) => ({ openId: null, open: (openId) => set({ openId }) }));
