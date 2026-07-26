import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";

export function usePremiumMotion<T extends HTMLElement>(rootRef: RefObject<T | null>, dependency: string) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      const items = root.querySelectorAll<HTMLElement>("[data-reveal]");
      gsap.fromTo(
        root,
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.34, ease: "power2.out", clearProps: "opacity,transform,visibility" },
      );
      if (items.length > 0) {
        gsap.fromTo(
          items,
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.46,
            stagger: 0.045,
            ease: "power3.out",
            clearProps: "opacity,transform,visibility",
          },
        );
      }
    }, root);
    return () => context.revert();
  }, [dependency, rootRef]);
}
