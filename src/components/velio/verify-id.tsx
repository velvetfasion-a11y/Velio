import { BankIdVerify } from "@/components/velio/bankid-verify";
import { useVelio } from "@/lib/velio/store";
import { ScreenHeader } from "@/components/velio/ui";

export function VerifyIdScreen() {
  const go = useVelio((state) => state.go);
  const idVerified = useVelio((state) => state.idVerified);
  return (
    <div className="px-5 pt-4 pb-8">
      <ScreenHeader title="Verifiera dig" />
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Identiteten behövs för VELIO Business. BankID öppnas här i appen, antingen på den här enheten eller med en QR-kod.
      </p>
      <BankIdVerify onVerified={() => go("profile")} />
      {idVerified ? (
        <button type="button" onClick={() => go("profile")} className="mt-4 h-12 w-full rounded-full bg-brown text-sm font-semibold text-paper">
          Tillbaka till profilen
        </button>
      ) : null}
    </div>
  );
}
