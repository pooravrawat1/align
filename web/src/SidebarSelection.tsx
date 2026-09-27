import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function SidebarSelection({ page }: { page: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  const move = useRef<(animate: boolean) => void>(() => {});

  useGSAP((_context, contextSafe) => {
    const element = marker.current!;
    const sidebar = element.parentElement!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const update = contextSafe!((animate: boolean) => {
      const active = sidebar.querySelector<HTMLElement>("nav a.active");
      if (!active) { gsap.set(element, { opacity: 0 }); return; }
      const row = active.getBoundingClientRect(), container = sidebar.getBoundingClientRect();
      gsap.set(element, { width: row.width, height: row.height, opacity: 1 });
      gsap.to(element, {
        x: row.left - container.left - sidebar.clientLeft,
        y: row.top - container.top + sidebar.scrollTop - sidebar.clientTop,
        duration: animate && !reduced.matches ? 0.28 : 0,
        ease: "power3.out", overwrite: true,
      });
    });
    move.current = update;
    update(false);
    const resize = new ResizeObserver(() => update(false));
    resize.observe(sidebar);
    sidebar.querySelectorAll("nav").forEach(node => resize.observe(node));
    const preferenceChanged = () => update(false);
    reduced.addEventListener("change", preferenceChanged);
    return () => {
      resize.disconnect();
      reduced.removeEventListener("change", preferenceChanged);
      move.current = () => {};
    };
  }, { scope: marker });

  useEffect(() => { move.current(true); }, [page]);
  return <span ref={marker} className="sidebar-selection" aria-hidden="true" />;
}
