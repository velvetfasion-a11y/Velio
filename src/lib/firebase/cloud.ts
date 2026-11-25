import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  setDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/lib/firebase/client";
import { errorCode } from "@/lib/firebase/auth";
import { setCloudActive, setPreferCustomer, prefersCustomer } from "@/lib/firebase/session";
import {
  initialsOf,
  serviceById,
  services,
  setProviders,
  type Provider,
  type ServiceId,
} from "@/lib/velio/data";
import { useVelio, type ChatMsg, type PostedJob, type SavedAddress } from "@/lib/velio/store";

export type CloudOffer = {
  id: string;
  ownerId: string;
  jobId: string;
  jobOwnerId: string;
  amount: number;
  message: string;
  status: "pending" | "accepted" | "declined" | "withdrawn";
};

const EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const unsubs: Unsubscribe[] = [];
const messageUnsubs = new Map<string, Unsubscribe>();
const chatByPeer = new Map<string, { id: string; jobId?: string }>();
const jobBuffer = new Map<string, PostedJob>();
let openJobsReady = false;
let ownJobsReady = false;
let ownOrgNumber = "";

function db() {
  return firebaseDb();
}

function uidOrThrow() {
  const uid = firebaseAuth().currentUser?.uid;
  if (!uid) throw new Error("Du behöver vara inloggad.");
  return uid;
}

export function cloudErrorSv(error: unknown) {
  const code = errorCode(error);
  if (code === "permission-denied") return "Firestore nekade ändringen. Kontrollera att du är inloggad.";
  if (error instanceof Error && error.message) return error.message;
  return "Det gick inte att spara.";
}

function cleanName(value: string | null | undefined, fallback: string, max = 80) {
  const name = (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return name || fallback;
}

function cityLabel(area: string) {
  const head = area.split("·")[0]?.trim() ?? "";
  const parts = head.split(",").map((part) => part.trim()).filter(Boolean);
  const last = (parts[parts.length - 1] ?? head).replace(/\d+.*/, "").trim();
  return last.slice(0, 80);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function clock(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate() as Date;
    return date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  }
  return "";
}

function whenStamp(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).toLocaleString("sv-SE", { day: "numeric", month: "short" });
  }
  return "";
}

function serviceIdOf(value: string): ServiceId {
  return services.some((service) => service.id === value) ? (value as ServiceId) : services[0].id;
}

function parseOffers(text: string) {
  const offers: { name: string; hours: string; price: number }[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^(.+): från (\d+) kr(?: \((.+)\))?$/);
    if (!match) continue;
    offers.push({ name: match[1].trim(), price: Number(match[2]), hours: match[3]?.trim() ?? "" });
  }
  return offers;
}

function parseFtax(text: string): Provider["fTax"] | undefined {
  const line = text.split("\n").find((item) => item.toLowerCase().startsWith("f-skatt:"));
  if (!line) return undefined;
  if (/:\s*ja\b/i.test(line)) return "yes";
  if (/:\s*nej\b/i.test(line)) return "no";
  if (/osäker/i.test(line)) return "unsure";
  return undefined;
}

export function describeWorker(input: {
  desc: string;
  offers?: { name: string; hours: string; price: number }[];
  sellerKind?: "private" | "company";
  fTax?: "yes" | "no" | "unsure";
}) {
  const prices = (input.offers ?? [])
    .map((offer) => `${offer.name}: från ${offer.price} kr${offer.hours ? ` (${offer.hours})` : ""}`)
    .join("\n");
  const tax =
    input.sellerKind === "private"
      ? "Kunden kan behöva hantera skatt och RUT på ett annat sätt än mot ett företag. Texten är en platshållare, inte juridisk vägledning."
      : input.fTax
        ? `F-skatt: ${input.fTax === "yes" ? "ja, enligt dig" : input.fTax === "no" ? "nej" : "osäker"}. Inte kontrollerat mot Skatteverket.`
        : "";
  return [input.desc.trim(), prices ? `Priser\n${prices}` : "", tax].filter(Boolean).join("\n\n").slice(0, 4000);
}

function businessToProvider(id: string, data: DocumentData): Provider {
  const names = stringList(data.services);
  const serviceIds = names
    .map((name) => services.find((service) => service.name === name)?.id)
    .filter((item): item is ServiceId => Boolean(item));
  const description = asString(data.description);
  const offers = parseOffers(description);
  const serviceArea = asString(data.serviceArea);
  const place = serviceArea.split("·")[0]?.trim() || serviceArea;
  const sellerKind: Provider["sellerKind"] = /privatperson/i.test(description) ? "private" : "company";
  const companyName = asString(data.companyName) || "VELIO";
  const price = offers.length ? Math.min(...offers.map((offer) => offer.price)) : 0;
  const own = id === firebaseAuth().currentUser?.uid;
  return {
    id,
    name: companyName,
    initials: initialsOf(companyName) || "V",
    serviceId: serviceIds[0] ?? services[0].id,
    serviceIds,
    title: sellerKind === "private" ? "Privatperson" : companyName,
    rating: 0,
    reviews: 0,
    etaMin: 0,
    price,
    area: cityLabel(place) || "Sverige",
    place,
    about: description,
    quote: "",
    reviewer: "",
    reviewAgo: "",
    slots: ["morning", "afternoon", "evening"],
    offers,
    areas: serviceArea ? [serviceArea] : [],
    companyName: sellerKind === "company" ? companyName : undefined,
    orgNumber: own && sellerKind === "company" ? ownOrgNumber || undefined : undefined,
    fTax: parseFtax(description),
    sellerKind,
    demo: true,
  };
}

function emitDirectory(list: Provider[]) {
  setProviders(list);
  const own = list.find((item) => item.id === firebaseAuth().currentUser?.uid);
  const state = useVelio.getState();
  useVelio.setState({
    directory: list,
    ...(own && !prefersCustomer()
      ? {
          accountMode: "business" as const,
          idVerified: false,
          idMethod: "demo",
          providerId: state.providerId ?? own.id,
          listing: state.listing ?? {
            serviceId: own.serviceId,
            serviceIds: own.serviceIds,
            title: own.title,
            desc: own.about,
            price: own.price,
            offers: own.offers,
            areas: own.areas,
            companyName: own.companyName,
            sellerKind: own.sellerKind,
            demo: true,
          },
        }
      : {}),
  });
}

function jobFromDoc(id: string, data: DocumentData): PostedJob {
  const schedule = data.schedule && typeof data.schedule === "object" ? (data.schedule as Record<string, unknown>) : {};
  const serviceId = serviceIdOf(asString(schedule.serviceId));
  return {
    id,
    serviceId,
    text: asString(data.description) || asString(data.title),
    when: asString(schedule.when),
    address: asString(data.locationLabel),
    rate: schedule.rate === "hour" ? "hour" : "fixed",
    price: asNumber(data.budget),
    ownerId: asString(data.ownerId),
    status: asString(data.status) || "open",
  };
}

function emitJobs() {
  if (!openJobsReady || !ownJobsReady) return;
  useVelio.setState({ posted: [...jobBuffer.values()] });
}

function offerFromDoc(id: string, data: DocumentData): CloudOffer {
  const status = asString(data.status);
  return {
    id,
    ownerId: asString(data.ownerId),
    jobId: asString(data.jobId),
    jobOwnerId: asString(data.jobOwnerId),
    amount: asNumber(data.amount),
    message: asString(data.message),
    status: status === "accepted" || status === "declined" || status === "withdrawn" ? status : "pending",
  };
}

function rememberChat(peer: string, id: string, jobId?: string) {
  if (peer) chatByPeer.set(peer, { id, jobId });
}

export async function ensureAccount(user: User) {
  const uid = user.uid;
  const displayName = cleanName(user.displayName, cleanName(user.email?.split("@")[0], "VELIO"));
  const email = user.email && EMAIL.test(user.email) ? user.email : "";
  const userRef = doc(db(), "users", uid);
  const profileRef = doc(db(), "profiles", uid);
  await runTransaction(db(), async (tx) => {
    const userSnap = await tx.get(userRef);
    const profileSnap = await tx.get(profileRef);
    if (!userSnap.exists()) {
      const payload: Record<string, unknown> = {
        uid,
        displayName,
        accountType: "private",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (email) payload.email = email;
      tx.set(userRef, payload);
    }
    if (!profileSnap.exists()) {
      tx.set(profileRef, {
        uid,
        displayName,
        published: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export function stopCloudSession() {
  for (const unsub of unsubs) unsub();
  unsubs.length = 0;
  for (const unsub of messageUnsubs.values()) unsub();
  messageUnsubs.clear();
  chatByPeer.clear();
  jobBuffer.clear();
  openJobsReady = false;
  ownJobsReady = false;
  ownOrgNumber = "";
  setCloudActive(false);
  setPreferCustomer(false);
}

export function startCloudSession(uid: string) {
  stopCloudSession();
  setCloudActive(true);
  setProviders([]);
  useVelio.setState({
    directory: [],
    posted: [],
    jobOffers: [],
    chats: {},
    peers: {},
    conversationByProvider: {},
    addresses: [],
    wallet: { available: 0, pending: 0, bank: null, txs: [] },
  });
  const database = db();

  unsubs.push(
    onSnapshot(doc(database, "users", uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      ownOrgNumber = asString(data.orgNumber);
      const state = useVelio.getState();
      useVelio.setState({
        profile: {
          name: cleanName(asString(data.displayName), state.profile.name || "VELIO"),
          email: asString(data.email) || state.profile.email,
          phone: asString(data.phone),
          avatar: state.profile.avatar,
        },
      });
    }),
  );

  const businesses = new Map<string, Provider>();
  const emitBusinesses = () => emitDirectory([...businesses.values()]);
  unsubs.push(
    onSnapshot(query(collection(database, "businesses"), where("published", "==", true)), (snap) => {
      for (const key of [...businesses.keys()]) {
        if (key !== uid) businesses.delete(key);
      }
      for (const item of snap.docs) businesses.set(item.id, businessToProvider(item.id, item.data()));
      emitBusinesses();
    }),
  );
  unsubs.push(
    onSnapshot(doc(database, "businesses", uid), (snap) => {
      if (!snap.exists() || snap.data().published !== true) {
        businesses.delete(uid);
      } else {
        businesses.set(uid, businessToProvider(uid, snap.data()));
      }
      emitBusinesses();
    }),
  );

  unsubs.push(
    onSnapshot(query(collection(database, "jobs"), where("status", "==", "open")), (snap) => {
      for (const [id, job] of jobBuffer) {
        if (job.ownerId !== uid) jobBuffer.delete(id);
      }
      for (const item of snap.docs) jobBuffer.set(item.id, jobFromDoc(item.id, item.data()));
      openJobsReady = true;
      emitJobs();
    }),
  );
  unsubs.push(
    onSnapshot(query(collection(database, "jobs"), where("ownerId", "==", uid)), (snap) => {
      for (const [id, job] of jobBuffer) {
        if (job.ownerId === uid) jobBuffer.delete(id);
      }
      for (const item of snap.docs) jobBuffer.set(item.id, jobFromDoc(item.id, item.data()));
      ownJobsReady = true;
      emitJobs();
    }),
  );

  const offers = new Map<string, CloudOffer>();
  const emitOffers = () => useVelio.setState({ jobOffers: [...offers.values()] });
  const takeOffers = (snap: { docs: { id: string; data: () => DocumentData }[] }, mine: "author" | "owner") => {
    for (const [id, offer] of offers) {
      if (mine === "author" && offer.ownerId === uid) offers.delete(id);
      if (mine === "owner" && offer.jobOwnerId === uid) offers.delete(id);
    }
    for (const item of snap.docs) offers.set(item.id, offerFromDoc(item.id, item.data()));
    emitOffers();
  };
  unsubs.push(onSnapshot(query(collection(database, "offers"), where("ownerId", "==", uid)), (snap) => takeOffers(snap, "author")));
  unsubs.push(
    onSnapshot(query(collection(database, "offers"), where("jobOwnerId", "==", uid)), (snap) => takeOffers(snap, "owner")),
  );

  unsubs.push(
    onSnapshot(query(collection(database, "addresses"), where("ownerId", "==", uid)), (snap) => {
      const addresses: SavedAddress[] = snap.docs.map((item) => {
        const data = item.data();
        const lat = typeof data.lat === "number" ? data.lat : undefined;
        const lng = typeof data.lng === "number" ? data.lng : undefined;
        return {
          id: item.id,
          label: asString(data.label) || "Hem",
          line: asString(data.formattedAddress),
          primary: data.isDefault === true,
          lat,
          lng,
        };
      });
      const state = useVelio.getState();
      const still = addresses.some((item) => item.id === state.activeAddressId);
      const nextActive = still
        ? state.activeAddressId
        : addresses.find((item) => item.primary)?.id ?? addresses[0]?.id ?? null;
      useVelio.setState({ addresses, activeAddressId: nextActive });
    }),
  );

  unsubs.push(
    onSnapshot(query(collection(database, "payouts"), where("ownerId", "==", uid)), (snap) => {
      useVelio.setState({
        wallet: {
          available: 0,
          pending: 0,
          bank: null,
          txs: snap.docs.map((item) => {
            const data = item.data();
            return {
              id: item.id,
              title: asString(data.title) || "Utbetalning",
              amount: asNumber(data.amount),
              bucket: "available" as const,
              at: whenStamp(data.createdAt) || "Sparad",
              note: "Läst från Firestore. Appen kan inte skapa utbetalningar.",
            };
          }),
        },
      });
    }),
  );

  unsubs.push(
    onSnapshot(query(collection(database, "chats"), where("participantIds", "array-contains", uid)), (snap) => {
      const live = new Set<string>();
      for (const item of snap.docs) {
        live.add(item.id);
        const data = item.data();
        const participants = stringList(data.participantIds);
        const peer = participants.find((person) => person !== uid) ?? "";
        const jobId = asString(data.jobId);
        rememberChat(peer, item.id, jobId || undefined);
        if (!messageUnsubs.has(item.id)) {
          const unsub = onSnapshot(
            query(collection(database, "chats", item.id, "messages"), orderBy("createdAt", "asc")),
            (messages) => {
              const thread: ChatMsg[] = messages.docs.map((message) => {
                const body = message.data();
                return {
                  id: message.id,
                  from: asString(body.senderId) === uid ? "me" : "them",
                  text: asString(body.text),
                  time: clock(body.createdAt),
                };
              });
              const state = useVelio.getState();
              const known = state.directory.find((provider) => provider.id === peer);
              useVelio.setState({
                chats: { ...state.chats, [peer]: thread },
                peers: {
                  ...state.peers,
                  [peer]: state.peers[peer] ?? {
                    id: peer,
                    name: known?.name || "Kontakt",
                    providerId: known ? peer : null,
                  },
                },
              });
            },
          );
          messageUnsubs.set(item.id, unsub);
        }
      }
      for (const [id, unsub] of messageUnsubs) {
        if (!live.has(id)) {
          unsub();
          messageUnsubs.delete(id);
        }
      }
    }),
  );
}

export async function saveAccountProfile(input: { name: string; email: string; phone: string }) {
  const uid = uidOrThrow();
  const displayName = cleanName(input.name, "VELIO");
  const email = input.email.trim();
  const phone = input.phone.trim().slice(0, 32);
  const userPatch: Record<string, unknown> = {
    displayName,
    phone,
    updatedAt: serverTimestamp(),
  };
  userPatch.email = email && EMAIL.test(email) ? email : deleteField();
  await updateDoc(doc(db(), "users", uid), userPatch);
  await updateDoc(doc(db(), "profiles", uid), {
    displayName,
    updatedAt: serverTimestamp(),
  });
}

export async function savePrivateIdentity(input: {
  accountType: "private" | "business";
  orgNumber?: string;
  nationalId?: string;
  phone?: string;
}) {
  const uid = uidOrThrow();
  const patch: Record<string, unknown> = {
    accountType: input.accountType,
    updatedAt: serverTimestamp(),
    orgNumber: input.accountType === "business" && input.orgNumber ? input.orgNumber.trim().slice(0, 32) : deleteField(),
    nationalId: input.accountType === "private" && input.nationalId ? input.nationalId.replace(/\D/g, "").slice(0, 32) : deleteField(),
  };
  if (input.phone) patch.phone = input.phone.trim().slice(0, 32);
  await updateDoc(doc(db(), "users", uid), patch);
}

export async function publishWorkerProfile(input: {
  displayName: string;
  companyName: string;
  description: string;
  services: string[];
  serviceArea: string;
  city: string;
  sellerKind: "private" | "company";
  orgNumber?: string;
  nationalId?: string;
}) {
  const uid = uidOrThrow();
  const displayName = cleanName(input.displayName, cleanName(input.companyName, "VELIO"));
  const companyName = cleanName(input.companyName, displayName, 120);
  const description = input.description.trim().slice(0, 4000);
  const serviceNames = input.services.map((item) => item.trim()).filter(Boolean).slice(0, 30);
  const serviceArea = input.serviceArea.trim().slice(0, 120);
  const city = cityLabel(input.city).slice(0, 80);
  const businessRef = doc(db(), "businesses", uid);
  const profileRef = doc(db(), "profiles", uid);
  const businessSnap = await getDoc(businessRef);
  const businessPatch: Record<string, unknown> = {
    companyName,
    published: true,
    updatedAt: serverTimestamp(),
  };
  if (description) businessPatch.description = description;
  if (serviceNames.length) businessPatch.services = serviceNames;
  if (serviceArea) businessPatch.serviceArea = serviceArea;
  if (!businessSnap.exists()) {
    await setDoc(businessRef, { uid, ...businessPatch, createdAt: serverTimestamp() });
  } else {
    await updateDoc(businessRef, businessPatch);
  }
  const profilePatch: Record<string, unknown> = {
    displayName,
    published: true,
    updatedAt: serverTimestamp(),
  };
  if (description) profilePatch.bio = description.slice(0, 2000);
  if (serviceNames.length) profilePatch.categories = serviceNames.slice(0, 20);
  if (city) profilePatch.city = city;
  const profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists()) {
    await setDoc(profileRef, { uid, ...profilePatch, createdAt: serverTimestamp() });
  } else {
    await updateDoc(profileRef, profilePatch);
  }
  await savePrivateIdentity({
    accountType: input.sellerKind === "company" ? "business" : "private",
    orgNumber: input.orgNumber,
    nationalId: input.nationalId,
  });
  setPreferCustomer(false);
}

export async function deleteWorkerProfile() {
  const uid = uidOrThrow();
  const businessRef = doc(db(), "businesses", uid);
  const snap = await getDoc(businessRef);
  if (snap.exists()) await deleteDoc(businessRef);
  const profileRef = doc(db(), "profiles", uid);
  const profile = await getDoc(profileRef);
  if (profile.exists()) {
    await updateDoc(profileRef, { published: false, updatedAt: serverTimestamp() });
  }
}

export async function createCloudJob(input: {
  serviceId: ServiceId;
  text: string;
  when: string;
  address: string;
  rate: "hour" | "fixed";
  price: number;
}) {
  const uid = uidOrThrow();
  const serviceName = serviceById(input.serviceId)?.name ?? "Uppdrag";
  const payload: Record<string, unknown> = {
    ownerId: uid,
    title: serviceName.slice(0, 120),
    category: serviceName.slice(0, 80),
    status: "open",
    schedule: {
      when: input.when.slice(0, 300),
      serviceId: input.serviceId,
      rate: input.rate,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const description = input.text.trim().slice(0, 8000);
  const locationLabel = input.address.trim().slice(0, 200);
  if (description) payload.description = description;
  if (locationLabel) payload.locationLabel = locationLabel;
  if (input.price > 0) payload.budget = input.price;
  const ref = await addDoc(collection(db(), "jobs"), payload);
  return ref.id;
}

export async function sendCloudOffer(input: { jobId: string; jobOwnerId: string; amount: number; message: string }) {
  const uid = uidOrThrow();
  if (input.jobOwnerId === uid) throw new Error("Du kan inte skicka en offert på ditt eget uppdrag.");
  const payload: Record<string, unknown> = {
    ownerId: uid,
    jobId: input.jobId.slice(0, 128),
    jobOwnerId: input.jobOwnerId,
    amount: Math.max(0, input.amount),
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const message = input.message.trim().slice(0, 4000);
  if (message) payload.message = message;
  const ref = await addDoc(collection(db(), "offers"), payload);
  return ref.id;
}

export async function setCloudOfferStatus(id: string, status: CloudOffer["status"]) {
  await updateDoc(doc(db(), "offers", id), { status, updatedAt: serverTimestamp() });
  if (status !== "accepted") return;
  const offerSnap = await getDoc(doc(db(), "offers", id));
  const jobId = asString(offerSnap.data()?.jobId);
  const jobOwnerId = asString(offerSnap.data()?.jobOwnerId);
  if (!jobId || jobOwnerId !== uidOrThrow()) return;
  await updateDoc(doc(db(), "jobs", jobId), { status: "assigned", updatedAt: serverTimestamp() });
}

export async function sendPeerMessage(peerUid: string, text: string, jobId?: string) {
  const uid = uidOrThrow();
  const body = text.trim().slice(0, 4000);
  if (!body || !peerUid || peerUid === uid) return;
  let chatId = chatByPeer.get(peerUid)?.id;
  if (!chatId) {
    const existing = await getDocs(query(collection(db(), "chats"), where("participantIds", "array-contains", uid)));
    const found = existing.docs.find((item) => stringList(item.data().participantIds).includes(peerUid));
    if (found) {
      chatId = found.id;
      rememberChat(peerUid, found.id, asString(found.data().jobId) || undefined);
    }
  }
  if (!chatId) {
    const payload: Record<string, unknown> = {
      participantIds: [uid, peerUid],
      createdAt: serverTimestamp(),
    };
    if (jobId && jobId.length >= 1 && jobId.length <= 128) payload.jobId = jobId;
    const created = await addDoc(collection(db(), "chats"), payload);
    chatId = created.id;
    rememberChat(peerUid, chatId, jobId);
  }
  await addDoc(collection(db(), "chats", chatId, "messages"), {
    senderId: uid,
    text: body,
    createdAt: serverTimestamp(),
  });
  try {
    await updateDoc(doc(db(), "chats", chatId), { updatedAt: serverTimestamp() });
  } catch {
    /* The message is already saved. A chat touch is optional. */
  }
}

function addressPayload(input: { label: string; line: string; lat?: number; lng?: number; isDefault: boolean }) {
  const payload: Record<string, unknown> = {
    label: input.label.trim().slice(0, 40) || "Hem",
    formattedAddress: input.line.trim().slice(0, 300),
    isDefault: input.isDefault,
    updatedAt: serverTimestamp(),
  };
  if (typeof input.lat === "number" && Number.isFinite(input.lat)) payload.lat = input.lat;
  else payload.lat = deleteField();
  if (typeof input.lng === "number" && Number.isFinite(input.lng)) payload.lng = input.lng;
  else payload.lng = deleteField();
  return payload;
}

export async function createCloudAddress(input: { label: string; line: string; lat?: number; lng?: number; isDefault: boolean }) {
  const uid = uidOrThrow();
  const payload: Record<string, unknown> = {
    ownerId: uid,
    label: input.label.trim().slice(0, 40) || "Hem",
    formattedAddress: input.line.trim().slice(0, 300),
    isDefault: input.isDefault,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (typeof input.lat === "number" && Number.isFinite(input.lat)) payload.lat = input.lat;
  if (typeof input.lng === "number" && Number.isFinite(input.lng)) payload.lng = input.lng;
  const ref = await addDoc(collection(db(), "addresses"), payload);
  return ref.id;
}

export async function updateCloudAddress(
  id: string,
  input: { label: string; line: string; lat?: number; lng?: number },
) {
  const current = useVelio.getState().addresses.find((item) => item.id === id);
  await updateDoc(doc(db(), "addresses", id), addressPayload({ ...input, isDefault: Boolean(current?.primary) }));
}

export async function deleteCloudAddress(id: string) {
  await deleteDoc(doc(db(), "addresses", id));
  const rest = useVelio.getState().addresses.filter((item) => item.id !== id);
  if (rest.length && !rest.some((item) => item.primary)) {
    await updateDoc(doc(db(), "addresses", rest[0].id), { isDefault: true, updatedAt: serverTimestamp() });
  }
}

export async function makeCloudDefaultAddress(id: string) {
  const uid = uidOrThrow();
  const snap = await getDocs(query(collection(db(), "addresses"), where("ownerId", "==", uid)));
  const batch = writeBatch(db());
  for (const item of snap.docs) {
    batch.update(item.ref, { isDefault: item.id === id, updatedAt: serverTimestamp() });
  }
  await batch.commit();
}

export async function deleteMyCloudData() {
  const uid = uidOrThrow();
  const database = db();
  const chats = await getDocs(query(collection(database, "chats"), where("participantIds", "array-contains", uid)));
  for (const chat of chats.docs) {
    const messages = await getDocs(collection(database, "chats", chat.id, "messages"));
    for (const message of messages.docs) {
      if (asString(message.data().senderId) === uid) {
        try {
          await deleteDoc(message.ref);
        } catch {
          /* A message the rules reject stays until the other person deletes it. */
        }
      }
    }
    try {
      await deleteDoc(chat.ref);
    } catch {
      /* Chat delete is in firestore.rules but not live until that file is deployed. */
    }
  }
  const offers = await getDocs(query(collection(database, "offers"), where("ownerId", "==", uid)));
  for (const item of offers.docs) await deleteDoc(item.ref);
  const jobs = await getDocs(query(collection(database, "jobs"), where("ownerId", "==", uid)));
  for (const item of jobs.docs) await deleteDoc(item.ref);
  const addresses = await getDocs(query(collection(database, "addresses"), where("ownerId", "==", uid)));
  for (const item of addresses.docs) await deleteDoc(item.ref);
  const businessRef = doc(database, "businesses", uid);
  if ((await getDoc(businessRef)).exists()) await deleteDoc(businessRef);
  const profileRef = doc(database, "profiles", uid);
  if ((await getDoc(profileRef)).exists()) await deleteDoc(profileRef);
  const userRef = doc(database, "users", uid);
  if ((await getDoc(userRef)).exists()) await deleteDoc(userRef);
  return chats.docs.map((item) => item.id);
}
