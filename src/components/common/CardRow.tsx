import type { ReactNode } from "react";

/** Horizontal, touch-scrollable row of cards with keyboard-accessible scrolling. */
export function CardRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      role="list"
      aria-label={label}
      tabIndex={0}
      className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 focus-visible:outline-gold md:-mx-8 md:px-8"
    >
      {Array.isArray(children)
        ? children.map((c, i) => (
            <div key={i} role="listitem" className="snap-start">
              {c}
            </div>
          ))
        : <div role="listitem" className="snap-start">{children}</div>}
    </div>
  );
}
