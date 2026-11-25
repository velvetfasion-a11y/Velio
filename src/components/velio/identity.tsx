import { useState } from "react";
import { Camera, Check, ChevronLeft, CreditCard, IdCard, ScanFace, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { documentLabel, kycAdapter, needsBack, type KycDocument } from "@/lib/velio/kyc";
import { useVelio } from "@/lib/velio/store";

type Step = "type" | "front" | "back" | "selfie" | "review" | "pending";

const kinds: { id: KycDocument; title: string; hint: string }[] = [
  { id: "passport", title: "Pass", hint: "Foto av sidan med bild och namn" },
  { id: "national-id", title: "Nationellt id-kort", hint: "Framsida och baksida" },
  { id: "driving-licence", title: "Svenskt körkort", hint: "Framsida och baksida" },
];

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function IdentityFlow({ onBack, onContinue }: { onBack: () => void; onContinue?: () => void }) {
  const markKycPending = useVelio((state) => state.markKycPending);
  const [step, setStep] = useState<Step>("type");
  const [kind, setKind] = useState<KycDocument | null>(null);
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const backStep = () => {
    setError(null);
    if (step === "type") onBack();
    else if (step === "front") setStep("type");
    else if (step === "back") setStep("front");
    else if (step === "selfie") setStep(kind && needsBack(kind) ? "back" : "front");
    else if (step === "review") setStep("selfie");
  };

  const submit = async () => {
    if (!kind || !front || !selfie) return;
    setBusy(true);
    setError(null);
    try {
      const result = await kycAdapter.submit({
        document: kind,
        front: true,
        back: Boolean(back),
        selfie: true,
      });
      markKycPending({ document: kind, reference: result.reference });
      setReference(result.reference);
      setFront(null);
      setBack(null);
      setSelfie(null);
      setStep("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte sparas lokalt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {step !== "pending" ? (
        <button type="button" onClick={backStep} className="mb-3 flex items-center gap-1 text-sm font-semibold text-brown">
          <ChevronLeft className="size-4" /> Tillbaka
        </button>
      ) : null}

      <p className="rounded-2xl border border-line bg-sand px-3 py-2 text-xs leading-snug text-ink">
        Platshållare. Bilderna lämnar inte den här telefonen och granskas inte. En leverantör som Onfido, Veriff, Freja eller ZignSec kan kopplas in senare.
      </p>

      {step === "type" ? (
        <div className="mt-4 space-y-2">
          <h2 className="ios-section text-xl">Vilken handling?</h2>
          {kinds.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setKind(item.id);
                setFront(null);
                setBack(null);
                setStep("front");
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-left"
            >
              {item.id === "driving-licence" ? <CreditCard className="size-5 text-brown" /> : <IdCard className="size-5 text-brown" />}
              <span>
                <span className="block font-semibold">{item.title}</span>
                <span className="block text-sm text-muted">{item.hint}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {step === "front" && kind ? (
        <CaptureStep
          title="Fotografera framsidan"
          hint={kind === "passport" ? "Sidan med foto och namn." : "Hela kortets framsida, utan blänk."}
          preview={front}
          capture="environment"
          onPick={setFront}
          onNext={() => setStep(needsBack(kind) ? "back" : "selfie")}
        />
      ) : null}

      {step === "back" && kind ? (
        <CaptureStep
          title="Fotografera baksidan"
          hint="Behövs för id-kort och körkort."
          preview={back}
          capture="environment"
          onPick={setBack}
          onNext={() => setStep("selfie")}
        />
      ) : null}

      {step === "selfie" ? (
        <CaptureStep
          title="Ta en selfie"
          hint="Ansiktet ska synas tydligt. Bilden jämförs inte på riktigt i den här versionen."
          preview={selfie}
          capture="user"
          onPick={setSelfie}
          onNext={() => setStep("review")}
        />
      ) : null}

      {step === "review" && kind ? (
        <div className="mt-4">
          <h2 className="ios-section text-xl">Kontrollera</h2>
          <p className="mt-1 text-sm text-muted">{documentLabel[kind]}. Bilderna skickas inte iväg.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Thumb label="Framsida" src={front} />
            {needsBack(kind) ? <Thumb label="Baksida" src={back} /> : null}
            <Thumb label="Selfie" src={selfie} />
          </div>
          {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="mt-4 h-12 w-full rounded-full bg-brown text-base font-semibold text-paper disabled:opacity-50"
          >
            {busy ? "Sparar lokalt…" : "Skicka till granskning"}
          </button>
        </div>
      ) : null}

      {step === "pending" && kind ? (
        <div className="mt-5">
          <div className="grid size-16 place-items-center rounded-full bg-sand text-brown">
            <ScanFace className="size-8" />
          </div>
          <h2 className="ios-section mt-4 text-2xl">Granskas</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {documentLabel[kind]} är sparad bara i den här webbläsaren, som en platshållare. Ingen bild har laddats upp och ingen har granskat den.
          </p>
          {reference ? <p className="mt-2 text-xs text-muted">Referens {reference}</p> : null}
          <div className="mt-4 rounded-2xl border border-dashed border-line bg-paper px-4 py-3">
            <p className="text-xs font-semibold tracking-wide text-muted">SÅ SER BRICKAN UT NÄR DEN ÄR KLAR</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-ok/15 px-2.5 py-1 text-sm font-semibold text-ok">
              <ShieldCheck className="size-4" /> Verifierad
            </span>
            <p className="mt-2 text-sm text-muted">Den brickan visas inte på din profil förrän en riktig granskning godkänts. Nu står det Granskas.</p>
          </div>
          <button type="button" onClick={onContinue ?? onBack} className="mt-4 h-12 w-full rounded-full bg-brown font-semibold text-paper">
            {onContinue ? "Fortsätt i demoläge" : "Tillbaka"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CaptureStep({
  title,
  hint,
  preview,
  capture,
  onPick,
  onNext,
}: {
  title: string;
  hint: string;
  preview: string | null;
  capture: "environment" | "user";
  onPick: (value: string) => void;
  onNext: () => void;
}) {
  const take = async (file: File | undefined) => {
    if (!file) return;
    onPick(await readFile(file));
  };
  return (
    <div className="mt-4">
      <h2 className="ios-section text-xl">{title}</h2>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      <div className="mt-3 grid aspect-[4/3] place-items-center overflow-hidden rounded-[1.3rem] border border-line bg-sand">
        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <Camera className="size-8 text-brown" />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="flex h-12 cursor-pointer items-center justify-center rounded-full bg-brown text-sm font-semibold text-paper">
          Kamera
          <input
            type="file"
            accept="image/*"
            capture={capture}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void take(file);
            }}
          />
        </label>
        <label className="flex h-12 cursor-pointer items-center justify-center rounded-full border border-line bg-paper text-sm font-semibold">
          Ladda upp
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void take(file);
            }}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={!preview}
        onClick={onNext}
        className="mt-3 h-12 w-full rounded-full border border-line bg-paper font-semibold disabled:opacity-40"
      >
        Nästa
      </button>
    </div>
  );
}

function Thumb({ label, src }: { label: string; src: string | null }) {
  return (
    <div>
      <div className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-sand">
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <Check className="size-4 text-muted" />}
      </div>
      <p className={cn("mt-1 text-center text-[11px]", src ? "text-ink" : "text-muted")}>{label}</p>
    </div>
  );
}
