import { useState } from "react";
import { useVelio } from "@/lib/velio/store";

export function LoginScreen() {
  const loginWithCursor = useVelio((state) => state.loginWithCursor);
  const authViewer = useVelio((state) => state.authViewer);
  const authSimulated = useVelio((state) => state.authSimulated);
  const authError = useVelio((state) => state.authError);
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    setBusy(true);
    try {
      await loginWithCursor();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white">
      <div className="pointer-events-none absolute -top-20 -left-16 size-64 rounded-full bg-[#f4eadc] blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-20 size-72 rounded-full bg-[#efe4d4] blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-8 size-48 rounded-full bg-[#f7f1e8] blur-3xl" />

      <div className="relative flex flex-1 flex-col justify-center px-6 pb-8">
        <p className="text-center font-serif text-[1.55rem] tracking-[0.32em] text-[#2a211c]">VELIO</p>
        <h1 className="mt-8 text-center font-serif text-[2.7rem] leading-none font-medium text-[#2a211c]">Logga in</h1>
        <p className="mx-auto mt-3 max-w-[17rem] text-center text-sm leading-snug text-[#6e6964]">
          Riktig inloggning via Cursor. Din profil sparas i Postgres (Neon).
        </p>

        <div className="mt-8 rounded-[1.7rem] border border-white/80 bg-white/45 p-5 shadow-[0_18px_50px_rgba(70,50,20,0.08)] backdrop-blur-xl">
          {authViewer ? (
            <div className="mb-4 rounded-2xl bg-white/80 px-4 py-3 text-center">
              <p className="text-xs tracking-wide text-[#8a847e] uppercase">Inloggad som</p>
              <p className="mt-1 font-semibold text-[#2a211c]">{authViewer.name || "Cursor-användare"}</p>
              {authViewer.email ? <p className="mt-0.5 text-sm text-[#6e6964]">{authViewer.email}</p> : null}
              {authSimulated ? (
                <p className="mt-2 text-xs text-[#8a847e]">Simulerad lokal användare (dev)</p>
              ) : null}
            </div>
          ) : (
            <p className="mb-4 text-center text-sm text-[#6e6964]">
              Publicera appen som privat eller team i Cursor för riktig inloggning.
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => void onContinue()}
            className="flex h-12 w-full items-center justify-center rounded-full bg-[#2a211c] text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Loggar in…" : authViewer ? "Fortsätt till VELIO" : "Försök igen"}
          </button>

          {authError ? <p className="mt-3 text-center text-sm text-red-700">{authError}</p> : null}
        </div>

        <p className="mx-auto mt-6 max-w-[18rem] text-center text-xs leading-relaxed text-[#8a847e]">
          Kontot kopplas till din Cursor-identitet. Bokningar och profil synkas till databasen.
        </p>
      </div>
    </div>
  );
}
