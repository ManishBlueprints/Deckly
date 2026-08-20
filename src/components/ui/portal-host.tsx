/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from "react";

const PortalHostContext = createContext<HTMLElement | null>(null);

export function PortalHostProvider({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: React.ReactNode;
}) {
  return <PortalHostContext.Provider value={container}>{children}</PortalHostContext.Provider>;
}

export function usePortalHost() {
  return useContext(PortalHostContext);
}
