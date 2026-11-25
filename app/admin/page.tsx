"use client";

import { useEffect, useMemo, useState } from "react";
import { firebaseAuth } from "@/lib/firebase/client";
import { paymentsApiBase } from "@/lib/stripe/config";

type Tab = "hem" | "support" | "users" | "user" | "jobs" | "payments" | "reports" | "analytics" | "audit";

const demo = {
  alerts: [
    { id: "a1", severity: "critical", title: "Betalning misslyckades", body: "Hemstäd · Ada Kund · 500 kr", type: "payment_failed" },
    { id: "a2", severity: "critical", title: "Utbetalning misslyckades", body: "Lind Städ AB saknar konto", type: "payout_failed" },
    { id: "a3", severity: "warning", title: "Uppdrag som fastnat", body: "Betalt men inte markerat klart", type: "booking_stuck" },
    { id: "a4", severity: "info", title: "Support väntar", body: "Ada: Utföraren kom inte", type: "support_waiting" },
  ],
  users: [
    { uid: "ada", name: "Ada Kund", email: "ada@example.com", role: "Kund", status: "Aktiv", city: "Stockholm" },
    { uid: "lind", name: "Lind Städ AB", email: "lind@example.com", role: "Utförare", status: "Pausad", city: "Södermalm" },
  ],
  thread: [
    { from: "customer", text: "Utföraren kom inte till tiden." },
    { from: "admin", text: "Vi tittar på uppdraget och återkommer." },
  ],
  funnel: [
    { name: "Konto", value: 128 },
    { name: "Uppdrag", value: 46 },
    { name: "Accepterat", value: 22 },
    { name: "Startad", value: 18 },
    { name: "Betald", value: 14 },
  ],
  days: [12, 18, 9, 22, 16, 28, 24],
  categories: [
    { name: "Städning", count: 18 },
    { name: "El", count: 9 },
    { name: "Trädgård", count: 6 },
  ],
  audit: [
    { action: "payment.refund", target: "pi_demo", when: "Idag 09:14" },
    { action: "user.suspend", target: "lind", when: "Igår 16:02" },
  ],
};

const nav: { id: Tab; label: string }[] = [
  { id: "hem", label: "Hem" },
  { id: "support", label: "Support" },
  { id: "users", label: "Användare" },
  { id: "jobs", label: "Jobb" },
  { id: "payments", label: "Betalningar" },
  { id: "reports", label: "Rapporter" },
  { id: "analytics", label: "Analys" },
  { id: "audit", label: "Logg" },
];

export default function AdminPage() {
  const [gate, setGate] = useState<"check" | "denied" | "demo" | "live">("check");
  const [liveAlerts, setLiveAlerts] = useState<{ id: string; title: string; body: string }[]>([]);
  const [tab, setTab] = useState<Tab>("hem");
  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get("demo") === "1";
    if (demo) {
      setGate("demo");
      return;
    }
    const stop = firebaseAuth().onAuthStateChanged(async (user) => {
      if (!user) {
        setGate("denied");
        return;
      }
      const base = paymentsApiBase();
      if (!base) {
        setGate("denied");
        return;
      }
      const token = await user.getIdToken();
      const response = await fetch(`${base}/api/admin/alerts?status=open`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        setGate("denied");
        return;
      }
      const body = (await response.json()) as { alerts?: { id: string; title: string; body: string; severity?: string }[] };
      setLiveAlerts(body.alerts || []);
      setGate("live");
    });
    return () => stop();
  }, []);
  const [query, setQuery] = useState("");
  const users = useMemo(
    () => demo.users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const max = Math.max(...demo.funnel.map((item) => item.value));

  if (gate === "check") {
    return <div className="grid min-h-dvh place-items-center bg-[#FAF8F5] font-serif text-2xl tracking-[0.22em]">VELIO</div>;
  }
  if (gate === "live") {
    return <LiveDesk alerts={liveAlerts} />;
  }
  if (gate === "denied") {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#FAF8F5] px-6 text-center">
        <div>
          <p className="font-serif text-2xl tracking-[0.22em]">VELIO</p>
          <h1 className="mt-4 text-[28px] font-semibold">Ingen behörighet</h1>
          <p className="mt-2 text-[14px] text-[#8A8178]">Den här sidan är bara för VELIO.</p>
          <button type="button" onClick={() => setGate("demo")} className="mt-6 h-11 rounded-full bg-[#1A1A1A] px-5 text-[14px] font-semibold text-white">
            Visa demo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#FAF8F5] text-[#1A1A1A]">
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="hidden w-52 shrink-0 border-r border-[#E6E1DB] px-4 py-6 md:block">
          <p className="font-serif text-[1.3rem] tracking-[0.22em]">VELIO</p>
          <p className="mt-1 text-[12px] text-[#8A8178]">Admin</p>
          <nav className="mt-8 space-y-1">
            {nav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`block w-full rounded-xl px-3 py-2 text-left text-[14px] ${tab === item.id || (tab === "user" && item.id === "users") ? "bg-[#1A1A1A] text-white" : "text-[#5C534C]"}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[28px] font-semibold tracking-[-0.03em]">{titleFor(tab)}</h1>
            <span className="rounded-full bg-[#F3EBE3] px-3 py-1 text-[12px] text-[#6B4226]">Demo</span>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto md:hidden">
            {nav.map((item) => (
              <button key={item.id} type="button" onClick={() => setTab(item.id)} className="shrink-0 rounded-full border border-[#E6E1DB] bg-white px-3 py-1.5 text-[13px]">
                {item.label}
              </button>
            ))}
          </div>
          {tab === "hem" ? <Home onOpen={() => setTab("support")} /> : null}
          {tab === "support" ? <Inbox /> : null}
          {tab === "users" ? (
            <section className="mt-6">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sök namn eller e-post" aria-label="Sök användare" className="h-11 w-full rounded-xl border border-[#E6E1DB] bg-white px-3 text-[15px] outline-none" />
              <div className="mt-4 space-y-2">
                {users.map((user) => (
                  <button key={user.uid} type="button" onClick={() => setTab("user")} className="flex w-full items-center justify-between rounded-2xl border border-[#E6E1DB] bg-white px-4 py-3 text-left">
                    <span>
                      <span className="block text-[15px] font-semibold">{user.name}</span>
                      <span className="text-[13px] text-[#8A8178]">{user.email} · {user.role}</span>
                    </span>
                    <span className="text-[13px]">{user.status}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          {tab === "user" ? <UserDetail onBack={() => setTab("users")} /> : null}
          {tab === "analytics" ? <Analytics max={max} /> : null}
          {tab === "jobs" ? <SimpleList rows={[["Hemstäd", "Tilldelat · betald"], ["Elbesiktning", "Öppen"]]} /> : null}
          {tab === "payments" ? <SimpleList rows={[["500 kr", "Avgift 50 kr · återbetala"], ["1 200 kr", "Utbetalning misslyckades · försök igen"]]} /> : null}
          {tab === "reports" ? <SimpleList rows={[["Utföraren kom inte", "Öppen · Ada Kund"]]} /> : null}
          {tab === "audit" ? <SimpleList rows={demo.audit.map((item) => [item.action, item.target + " · " + item.when])} /> : null}
        </main>
      </div>
    </div>
  );
}

function LiveDesk({ alerts }: { alerts: { id: string; title: string; body: string }[] }) {
  const [tab, setTab] = useState<Tab>("hem");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<{ uid: string; displayName: string; email: string; status: string }[]>([]);
  const [picked, setPicked] = useState<{ uid: string; displayName: string; email: string; status: string } | null>(null);
  const loadUsers = async (q: string) => {
    const base = paymentsApiBase();
    const user = firebaseAuth().currentUser;
    if (!base || !user) return;
    const token = await user.getIdToken();
    const response = await fetch(`${base}/api/admin/users?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const body = (await response.json()) as { users: { uid: string; displayName: string; email: string; status: string }[] };
    setUsers(body.users || []);
  };
  return (
    <div className="min-h-dvh bg-[#FAF8F5] text-[#1A1A1A]">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex items-center justify-between">
          <p className="font-serif text-[1.4rem] tracking-[0.22em]">VELIO</p>
          <div className="flex gap-2 text-[13px]">
            {nav.map((item) => (
              <button key={item.id} type="button" onClick={() => setTab(item.id)} className={tab === item.id ? "font-semibold" : "text-[#8A8178]"}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.03em]">{titleFor(tab)}</h1>
        {tab === "hem" ? (
          <div className="mt-4 space-y-2">
            {alerts.length === 0 ? <p className="text-[14px] text-[#8A8178]">Inget som behöver dig just nu.</p> : null}
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-[#E6E1DB] bg-white px-4 py-3">
                <p className="font-semibold">{alert.title}</p>
                <p className="text-[13px] text-[#8A8178]">{alert.body}</p>
              </div>
            ))}
          </div>
        ) : null}
        {tab === "users" ? (
          <div className="mt-4">
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadUsers(query); }} placeholder="Sök och tryck retur" aria-label="Sök användare" className="h-11 w-full rounded-xl border border-[#E6E1DB] px-3" />
            {users.map((user) => (
              <button key={user.uid} type="button" onClick={() => { setPicked(user); setTab("user"); }} className="mt-2 block w-full rounded-2xl border border-[#E6E1DB] bg-white px-4 py-3 text-left">
                <span className="font-semibold">{user.displayName || user.uid}</span>
                <span className="mt-1 block text-[13px] text-[#8A8178]">{user.email} · {user.status}</span>
              </button>
            ))}
          </div>
        ) : null}
        {tab === "user" && picked ? (
          <div className="mt-4">
            <h2 className="text-[32px] font-semibold">{picked.displayName || "Användare"}</h2>
            <p className="text-[14px] text-[#8A8178]">{picked.email}</p>
            <p className="mt-4 text-[14px]">Status {picked.status}. Personnummer är dolt.</p>
          </div>
        ) : null}
        {tab !== "hem" && tab !== "users" && tab !== "user" ? <p className="mt-4 text-[14px] text-[#8A8178]">Listan hämtas från VELIO.</p> : null}
      </div>
    </div>
  );
}

function titleFor(tab: Tab) {
  if (tab === "hem") return "Idag";
  if (tab === "support") return "Support";
  if (tab === "users" || tab === "user") return "Användare";
  if (tab === "analytics") return "Analys";
  if (tab === "jobs") return "Jobb";
  if (tab === "payments") return "Betalningar";
  if (tab === "reports") return "Rapporter";
  return "Logg";
}

function Home({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="mt-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["14", "Betalade"],
          ["7 000 kr", "Omsättning"],
          ["1", "Öppna ärenden"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-2xl border border-[#E6E1DB] bg-white px-4 py-4">
            <p className="text-[22px] font-semibold tracking-[-0.03em]">{value}</p>
            <p className="mt-1 text-[12px] text-[#8A8178]">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {demo.alerts.map((alert) => (
          <button key={alert.id} type="button" onClick={onOpen} className="flex w-full items-start gap-3 rounded-2xl border border-[#E6E1DB] bg-white px-4 py-3 text-left">
            <span className={`mt-1 size-2 shrink-0 rounded-full ${alert.severity === "info" ? "bg-[#6B4226]" : "bg-[#1A1A1A]"}`} />
            <span>
              <span className="block text-[15px] font-semibold">{alert.title}</span>
              <span className="text-[13px] text-[#8A8178]">{alert.body}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Inbox() {
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-[240px_1fr]">
      <button type="button" className="rounded-2xl border border-[#1A1A1A] bg-white px-4 py-3 text-left">
        <p className="text-[15px] font-semibold">Ada Kund</p>
        <p className="text-[13px] text-[#8A8178]">Utföraren kom inte</p>
      </button>
      <div className="rounded-2xl border border-[#E6E1DB] bg-white p-4">
        {demo.thread.map((message) => (
          <p key={message.text} className={`mb-3 max-w-[80%] rounded-2xl px-3 py-2 text-[14px] ${message.from === "admin" ? "ml-auto bg-[#1A1A1A] text-white" : "bg-[#FAF8F5]"}`}>
            {message.text}
          </p>
        ))}
        <p className="mt-4 text-[12px] text-[#8A8178]">Kopplat till Hemstäd · 500 kr</p>
      </div>
    </section>
  );
}

function UserDetail({ onBack }: { onBack: () => void }) {
  return (
    <section className="mt-6 max-w-xl">
      <button type="button" onClick={onBack} className="text-[13px] text-[#6B4226]">Tillbaka</button>
      <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.03em]">Ada Kund</h2>
      <p className="text-[14px] text-[#8A8178]">ada@example.com · Kund · Stockholm</p>
      <div className="mt-6 rounded-2xl border border-[#E6E1DB] bg-white">
        {[
          ["Status", "Aktiv"],
          ["Konto", "Privat"],
          ["Betalt", "500 kr"],
          ["Personnummer", "Dolt"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between border-t border-[#EFEBE6] px-4 py-3 first:border-t-0">
            <span className="text-[14px] text-[#8A8178]">{label}</span>
            <span className="text-[14px]">{value}</span>
          </div>
        ))}
      </div>
      <button type="button" className="mt-4 h-11 rounded-full border border-[#1A1A1A] px-4 text-[14px] font-semibold">Pausa konto</button>
    </section>
  );
}

function Analytics({ max }: { max: number }) {
  return (
    <section className="mt-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["24", "Idag"],
          ["128", "30 dagar"],
          ["7 000 kr", "Omsättning"],
          ["700 kr", "Avgift 10 %"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-2xl border border-[#E6E1DB] bg-white px-4 py-4">
            <p className="text-[22px] font-semibold tracking-[-0.03em]">{value}</p>
            <p className="mt-1 text-[12px] text-[#8A8178]">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-[#E6E1DB] bg-white p-4">
        <p className="text-[13px] text-[#8A8178]">Tratt</p>
        <div className="mt-4 space-y-3">
          {demo.funnel.map((step) => (
            <div key={step.name}>
              <div className="flex justify-between text-[13px]">
                <span>{step.name}</span>
                <span>{step.value}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-[#F3EBE3]">
                <div className="h-2 rounded-full bg-[#1A1A1A]" style={{ width: `${(step.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-[#E6E1DB] bg-white p-4">
        <p className="text-[13px] text-[#8A8178]">Omsättning, sju dagar</p>
        <svg viewBox="0 0 280 80" className="mt-3 h-24 w-full">
          <polyline fill="none" stroke="#6B4226" strokeWidth="2" points={demo.days.map((value, index) => `${index * 40 + 10},${70 - value * 2}`).join(" ")} />
        </svg>
        <div className="mt-2 flex gap-4 text-[13px] text-[#5C534C]">
          {demo.categories.map((item) => (
            <span key={item.name}>{item.name} {item.count}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function SimpleList({ rows }: { rows: string[][] }) {
  return (
    <div className="mt-6 space-y-2">
      {rows.map((row) => (
        <div key={row.join()} className="flex items-center justify-between rounded-2xl border border-[#E6E1DB] bg-white px-4 py-3">
          <span className="text-[15px] font-semibold">{row[0]}</span>
          <span className="text-[13px] text-[#8A8178]">{row[1]}</span>
        </div>
      ))}
    </div>
  );
}
