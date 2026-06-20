/*
 * JIMMI Orb design philosophy: Monastic Tech Minimalism.
 * Accessibility should preserve the premium tactile feel while respecting motion sensitivity.
 */

import { useEffect, useState } from "react";

export function usePrefersReducedMotion(explicitValue?: boolean): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(Boolean(explicitValue));

  useEffect(() => {
    if (typeof explicitValue === "boolean") {
      setPrefersReducedMotion(explicitValue);
      return;
    }

    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);

    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [explicitValue]);

  return prefersReducedMotion;
}
