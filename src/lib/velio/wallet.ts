export type PayoutSpeed = "instant" | "standard";

export type WalletTx = {
  id: string;
  title: string;
  amount: number;
  bucket: "available" | "pending" | "sent";
  at: string;
  note: string;
};

export type WalletState = {
  available: number;
  pending: number;
  bank: { clearing: string; account: string } | null;
  txs: WalletTx[];
};

export function emptyWallet(): WalletState {
  return { available: 0, pending: 0, bank: null, txs: [] };
}

/** Example saldo so a demo profile can try a withdrawal. Not a real ledger. */
export function demoWallet(): WalletState {
  return {
    available: 1860,
    pending: 640,
    bank: null,
    txs: [
      {
        id: "demo-pending",
        title: "Hemstädning · klart",
        amount: 640,
        bucket: "pending",
        at: "Idag",
        note: "Väntar. Blir tillgängligt 3 timmar efter avslutat jobb.",
      },
      {
        id: "demo-avail-1",
        title: "Fönsterputs · klart",
        amount: 490,
        bucket: "available",
        at: "Igår",
        note: "Redo att ta ut.",
      },
      {
        id: "demo-avail-2",
        title: "Flyttstäd · klart",
        amount: 1370,
        bucket: "available",
        at: "12 nov",
        note: "Redo att ta ut.",
      },
    ],
  };
}

export function payoutFee(speed: PayoutSpeed) {
  return speed === "instant" ? 15 : 0;
}
