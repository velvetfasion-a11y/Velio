"use client";

import { photoCredits } from "@/lib/velio/data";
import { asset } from "@/lib/velio/asset";

export default function CreditsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-lg bg-[#FAF8F5] px-5 py-8 text-[#1C1410]">
      <a href={asset("/")} className="text-sm font-semibold text-[#6B4226]">
        Tillbaka till VELIO
      </a>
      <h1 className="mt-4 font-serif text-4xl">Bildkällor</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#5c5148]">
        Kategoribilderna kommer från Pexels. Licensen tillåter fri användning, även kommersiellt, utan krav på att ange fotograf. Vi anger ändå fotograf, källa och licens. Bilden för Annat är en egen grafik i VELIOs färger.
      </p>
      <ul className="mt-6 space-y-4">
        {photoCredits.map((credit) => (
          <li key={credit.file} className="flex gap-3 rounded-2xl border border-[#e7e0d8] bg-white p-3">
            <img src={asset(`/velio/categories/${credit.thumb}`)} alt={credit.alt} className="size-16 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{credit.alt}</p>
              <p className="mt-1 text-sm">{credit.photographer}</p>
              <p className="mt-1 text-sm">
                <a href={credit.sourceUrl} className="text-[#6B4226] underline">
                  Pexels
                </a>
                {" · "}
                <a href={credit.licenseUrl} className="text-[#6B4226] underline">
                  {credit.license}
                </a>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
