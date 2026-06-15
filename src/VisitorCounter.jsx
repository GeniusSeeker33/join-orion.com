import React, { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { supabase } from "./lib/supabaseClient";

// Cache counts per page for the lifetime of the loaded app so a single visit
// is only ever tallied once — this also neutralizes React StrictMode's
// double-invoked effects in development.
const sessionCounts = {};

export default function VisitorCounter({ page, className = "" }) {
  const [count, setCount] = useState(
    typeof sessionCounts[page] === "number" && sessionCounts[page] >= 0
      ? sessionCounts[page]
      : null
  );

  useEffect(() => {
    let cancelled = false;

    // Already counted (or counting) this page during this session — reuse it.
    if (sessionCounts[page] != null) {
      if (sessionCounts[page] >= 0) setCount(sessionCounts[page]);
      return;
    }

    // Claim the slot synchronously so a second effect invocation can't double-bump.
    sessionCounts[page] = -1;

    (async () => {
      const { data, error } = await supabase.rpc("bump_visitor_count", { page_key: page });
      if (error) {
        console.error("Visitor count error:", error);
        sessionCounts[page] = null; // allow a retry on next mount
        return;
      }
      const next = Number(data);
      sessionCounts[page] = next;
      if (!cancelled) setCount(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [page]);

  if (count == null) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Eye className="h-3.5 w-3.5 text-amber-300" />
      {count.toLocaleString()} visits
    </span>
  );
}
