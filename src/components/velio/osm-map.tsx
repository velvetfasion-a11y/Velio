"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

/** Leaflet needs the browser — load OpenStreetMap map only on the client. */
export const CityMap = dynamic(
  () => import("@/components/velio/map").then((mod) => mod.CityMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-[16rem] place-items-center rounded-[1.5rem] border border-line bg-[#dfe8d8] text-sm text-muted">
        Laddar karta…
      </div>
    ),
  },
);

export type CityMapProps = ComponentProps<typeof CityMap>;
