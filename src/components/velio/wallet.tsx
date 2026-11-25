import { useState } from "react";
import { Building2, ChevronRight, Clock, Wallet } from "lucide-react";
import { payoutFee, type PayoutSpeed } from "@/lib/velio/wallet";
import { useVelio } from "@/lib/velio/store";
import { ScreenHeader } from "@/components/velio/ui";
import { cn } from "@/lib/cn";

function kr(value: number) {
  return `${value.toLocaleString("sv-SE")} kr`;
}

export function WalletScreen() {
  const go = useVelio((state) => state.go);
  const wallet = useVelio((state) => state.wallet);
  const connectPayoutBank = useVelio((state) => state.connectPayoutBank);
  const requestPayout = useVelio((state) => state.requestPayout);
  const showToast = useVelio((state) => state.showToast);
  const [panel, setPanel] = useState<"home" | "bank" | "withdraw" | "receipt">("home");
  const [clearing, setClearing] = useState(wallet.bank?.clearing ?? "");
  const [account, setAccount] = useState(wallet.bank?.account ?? "");
  const [amount, setAmount] = useState("500");
  const [speed, setSpeed] = useState<PayoutSpeed>("standard");
  const [receipt, setReceipt] = useState<{ id: string; amount: number; fee: number; net: number; speed: PayoutSpeed } | null>(null);

  const fee = payoutFee(speed);
  const numeric = Number(amount.replace(/\D/g, "")) || 0;

  return (
    <div className="px-5 pt-4 pb-8">
      <ScreenHeader title="Utbetalningar" onBack={() => (panel === "home" ? go("profile") : setPanel("home"))} />
      <p className="text-xs font-semibold tracking-wide text-brown">DEMO</p>

      {panel === "home" ? (
        <>
          <p className="mt-3 text-sm text-muted">Tillgängligt att ta ut</p>
          <p className="font-serif text-5xl leading-none">{kr(wallet.available)}</p>
          <div className="mt-4 rounded-[1.3rem] border border-line bg-paper/80 p-4 backdrop-blur-xl">
            <p className="flex items-center gap-2 font-semibold">
              <Clock className="size-4" /> {kr(wallet.pending)} väntar
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Ett avslutat jobb ligger som väntande i tre timmar. Sedan flyttas beloppet till tillgängligt saldo och du kan ta ut det. De tre timmarna ger tid att rätta jobbet innan pengarna lämnar VELIO.
            </p>
          </div>
          <button type="button" onClick={() => setPanel("withdraw")} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brown text-base font-semibold text-paper">
            <Wallet className="size-5" /> Ta ut pengar
          </button>
          <button type="button" onClick={() => setPanel("bank")} className="mt-3 flex w-full items-center gap-3 rounded-[1.2rem] border border-line bg-paper px-4 py-3 text-left">
            <Building2 className="size-5 text-brown" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Bankkonto</span>
              <span className="block text-sm text-muted">{wallet.bank ? `${wallet.bank.clearing} · ${wallet.bank.account}` : "Inget konto kopplat"}</span>
            </span>
            <ChevronRight className="size-4 text-muted" />
          </button>
          <h2 className="mt-6 text-sm font-semibold tracking-wide text-muted">HISTORIK</h2>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[1.2rem] border border-line bg-paper">
            {wallet.txs.length ? (
              wallet.txs.map((tx) => (
                <li key={tx.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold">{tx.title}</p>
                    <p className={cn("font-semibold", tx.amount < 0 ? "text-ink" : "text-ok")}>
                      {tx.amount > 0 ? "+" : ""}
                      {kr(tx.amount)}
                    </p>
                  </div>
                  <p className="text-xs text-muted">
                    {tx.at} · {tx.bucket === "pending" ? "Väntar" : tx.bucket === "sent" ? "Uttag" : "Tillgängligt"}
                  </p>
                  <p className="mt-1 text-sm text-muted">{tx.note}</p>
                </li>
              ))
            ) : (
              <li className="px-4 py-4 text-sm text-muted">Ingen historik ännu. Ett demosaldo läggs in när du publicerar en företagsprofil.</li>
            )}
          </ul>
        </>
      ) : null}

      {panel === "bank" ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-muted">
            Platshållare för BankID eller en Tink-koppling. Clearingnummer och kontonummer sparas bara i den här webbläsaren och skickas inte till en bank.
          </p>
          <label className="block text-sm font-medium">
            Clearingnummer
            <input value={clearing} inputMode="numeric" placeholder="1234" onChange={(event) => setClearing(event.target.value.replace(/\D/g, "").slice(0, 4))} className="mt-1 h-14 w-full rounded-2xl border border-line px-4 text-lg font-normal outline-none" />
          </label>
          <label className="block text-sm font-medium">
            Kontonummer
            <input value={account} inputMode="numeric" placeholder="1234567" onChange={(event) => setAccount(event.target.value.replace(/\D/g, "").slice(0, 10))} className="mt-1 h-14 w-full rounded-2xl border border-line px-4 text-lg font-normal outline-none" />
          </label>
          <button
            type="button"
            onClick={() => {
              if (clearing.length !== 4 || account.length < 5) return showToast("Skriv clearing med 4 siffror och ett kontonummer");
              connectPayoutBank({ clearing, account });
              showToast("Kontot är sparat i demoläget");
              setPanel("home");
            }}
            className="h-14 w-full rounded-full bg-brown font-semibold text-paper"
          >
            Spara konto
          </button>
        </div>
      ) : null}

      {panel === "withdraw" ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted">Tillgängligt {kr(wallet.available)}. Väntande pengar kan inte tas ut förrän de tre timmarna har gått.</p>
          <label className="block text-sm font-medium">
            Belopp
            <input value={amount} inputMode="numeric" aria-label="Belopp att ta ut" onChange={(event) => setAmount(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1 h-14 w-full rounded-2xl border border-line px-4 text-lg font-normal outline-none" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSpeed("standard")} className={cn("rounded-2xl border px-3 py-3 text-left", speed === "standard" ? "border-brown bg-brown text-paper" : "border-line bg-paper")}>
              <span className="block font-semibold">1–2 bankdagar</span>
              <span className="mt-1 block text-sm opacity-80">Ingen avgift</span>
            </button>
            <button type="button" onClick={() => setSpeed("instant")} className={cn("rounded-2xl border px-3 py-3 text-left", speed === "instant" ? "border-brown bg-brown text-paper" : "border-line bg-paper")}>
              <span className="block font-semibold">Direkt</span>
              <span className="mt-1 block text-sm opacity-80">Avgift 15 kr</span>
            </button>
          </div>
          <p className="text-sm text-muted">
            Du tar ut {kr(numeric)}. Avgift {kr(fee)}. Till kontot: {kr(Math.max(0, numeric - fee))}.
            {wallet.bank ? ` Konto ${wallet.bank.clearing} · ${wallet.bank.account}.` : " Koppla ett konto först."}
          </p>
          <button
            type="button"
            onClick={() => {
              const result = requestPayout(numeric, speed);
              if (typeof result === "string") return showToast(result);
              setReceipt(result);
              setPanel("receipt");
            }}
            className="h-14 w-full rounded-full bg-brown font-semibold text-paper"
          >
            Bekräfta uttag
          </button>
        </div>
      ) : null}

      {panel === "receipt" && receipt ? (
        <div className="mt-4 rounded-[1.3rem] border border-line bg-paper p-4">
          <p className="text-xs font-semibold tracking-wide text-brown">KVITTO · DEMO</p>
          <h2 className="mt-2 font-serif text-3xl leading-none">Uttaget är skickat</h2>
          <p className="mt-2 text-sm text-muted">Ingen bank har tagit emot pengarna. Statusen visar hur ett riktigt uttag följs.</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Referens</dt><dd className="font-semibold">{receipt.id}</dd></div>
            <div className="flex justify-between"><dt>Belopp</dt><dd>{kr(receipt.amount)}</dd></div>
            <div className="flex justify-between"><dt>Avgift</dt><dd>{kr(receipt.fee)}</dd></div>
            <div className="flex justify-between"><dt>Till kontot</dt><dd className="font-semibold">{kr(receipt.net)}</dd></div>
            <div className="flex justify-between"><dt>Tempo</dt><dd>{receipt.speed === "instant" ? "Direkt" : "1–2 bankdagar"}</dd></div>
            <div className="flex justify-between"><dt>Status</dt><dd>På väg · demo</dd></div>
          </dl>
          <button type="button" onClick={() => setPanel("home")} className="mt-4 h-12 w-full rounded-full bg-brown font-semibold text-paper">
            Tillbaka till saldo
          </button>
        </div>
      ) : null}
    </div>
  );
}
