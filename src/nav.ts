import { createContext, useContext } from 'react';

export type Tab = 'today' | 'habits' | 'progress' | 'settings';
export type Route = { name: 'habit'; id: string };
export interface Nav { push: (r: Route) => void; pop: () => void; goTab: (t: Tab) => void }
export const NavCtx = createContext<Nav>({ push: () => {}, pop: () => {}, goTab: () => {} });
export const useNav = () => useContext(NavCtx);
