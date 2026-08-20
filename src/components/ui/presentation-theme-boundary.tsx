import { useState, type ReactNode } from "react";
import { PortalHostProvider } from "./portal-host";

/** Keeps presentation canvases and their shared overlays dark without changing the account preference. */
export function PresentationThemeBoundary({ children }: { children: ReactNode }) {
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null);

  return (
    <PortalHostProvider container={portalHost}>
      <div data-presentation-theme="dark" className="min-h-dvh">
        {children}
        <div ref={setPortalHost} id="presentation-portal-host" />
      </div>
    </PortalHostProvider>
  );
}
