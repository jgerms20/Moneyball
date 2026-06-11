"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  years: number[];
  selected: number;
}

export function YearTabs({ years, selected }: Props) {
  return (
    <div className="flex gap-1 border-b border-line pb-0">
      {years.map((y) => {
        const isActive = y === selected;
        return (
          <Link
            key={y}
            href={`/timeline?year=${y}`}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              isActive
                ? "border-brass text-brass-bright"
                : "border-transparent text-muted hover:text-foreground hover:border-line",
            ].join(" ")}
          >
            {y}
          </Link>
        );
      })}
    </div>
  );
}
