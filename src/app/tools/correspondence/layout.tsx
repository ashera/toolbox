import type { ReactNode } from "react";

// A route-scoped layout: it only wraps /tools/correspondence, so this warm
// off-white background applies to the Chaser page and nowhere else.
export default function ChaserLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-brand-soft/80 to-brand-soft/40">
      {children}
    </div>
  );
}
