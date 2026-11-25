import { FieldValue } from "firebase-admin/firestore";
import { applyCors } from "../../lib/cors.js";
import { adminAuth, adminDb, requireAdmin } from "../../lib/firebase.js";
import { writeAudit } from "../../lib/audit.js";
import { workerShareOre } from "../../lib/money.js";
import { scheduleOrTransfer } from "../../lib/payouts.js";
import { stripeClient } from "../../lib/stripe.js";

function parts(req) {
  const value = req.query.path;
  if (Array.isArray(value)) return value;
  return String(value || "").split("/").filter(Boolean);
}

function stamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

function publicUser(id, data, reveal) {
  const next = {
    uid: id,
    email: data.email || "",
    phone: data.phone || "",
    displayName: data.displayName || "",
    accountType: data.accountType || "private",
    orgNumber: data.orgNumber || "",
    status: data.status || "active",
    statusReason: data.statusReason || "",
    stripeAccountId: data.stripeAccountId || "",
    stripeOnboardingStatus: data.stripeOnboardingStatus || "",
    stripeAccountState: data.stripeAccountState || "",
    stripeRequirements: data.stripeRequirements || [],
    idVerified: data.idVerified === true,
    idMethod: data.idMethod || "",
    createdAt: stamp(data.createdAt),
  };
  if (reveal) next.nationalId = data.nationalId || "";
  return next;
}

async function listJobs(db) {
  try {
    const snap = await db.collection("jobs").orderBy("updatedAt", "desc").limit(60).get();
    return snap.docs;
  } catch {
    const snap = await db.collection("jobs").limit(60).get();
    return snap.docs;
  }
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  try {
    const admin = await requireAdmin(req);
    const db = adminDb();
    const path = parts(req);
    const [root, id, action] = path;

    if (req.method === "GET" && root === "alerts") {
      const snap = await db.collection("alerts").limit(80).get();
      const status = String(req.query.status || "open");
      const alerts = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data(), createdAt: stamp(doc.data().createdAt) }))
        .filter((item) => !status || item.status === status)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      return res.status(200).json({ alerts });
    }

    if (req.method === "POST" && root === "alerts" && id && action === "ack") {
      const status = req.body?.status === "resolved" ? "resolved" : "acked";
      await db.collection("alerts").doc(id).set({ status, resolvedAt: FieldValue.serverTimestamp() }, { merge: true });
      await writeAudit(db, admin.uid, "alert.ack", "alert", id, { status });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "GET" && root === "users" && !id) {
      const q = String(req.query.q || "").trim().toLowerCase();
      const snap = await db.collection("users").limit(80).get();
      const users = snap.docs
        .map((doc) => publicUser(doc.id, doc.data(), false))
        .filter((user) => {
          if (!q) return true;
          return [user.uid, user.email, user.phone, user.displayName, user.orgNumber, user.stripeAccountId]
            .join(" ")
            .toLowerCase()
            .includes(q);
        });
      return res.status(200).json({ users });
    }

    if (req.method === "GET" && root === "users" && id && !action) {
      const userSnap = await db.collection("users").doc(id).get();
      if (!userSnap.exists) return res.status(404).json({ error: "Användaren finns inte" });
      const reveal = req.query.reveal === "1";
      if (reveal) await writeAudit(db, admin.uid, "user.reveal_national_id", "user", id, {});
      const [profile, business, jobs, offers, reports, threads] = await Promise.all([
        db.collection("profiles").doc(id).get(),
        db.collection("businesses").doc(id).get(),
        db.collection("jobs").where("ownerId", "==", id).limit(20).get(),
        db.collection("offers").where("ownerId", "==", id).limit(20).get(),
        db.collection("reports").where("targetId", "==", id).limit(20).get(),
        db.collection("supportThreads").where("customerId", "==", id).limit(20).get(),
      ]);
      return res.status(200).json({
        user: publicUser(id, userSnap.data(), reveal),
        profile: profile.exists ? profile.data() : null,
        business: business.exists ? business.data() : null,
        jobs: jobs.docs.map((doc) => ({ id: doc.id, title: doc.data().title, status: doc.data().status, paymentStatus: doc.data().paymentStatus || "" })),
        offers: offers.docs.map((doc) => ({ id: doc.id, amount: doc.data().amount, status: doc.data().status })),
        reports: reports.docs.map((doc) => ({ id: doc.id, reason: doc.data().reason, status: doc.data().status })),
        threads: threads.docs.map((doc) => ({ id: doc.id, topic: doc.data().topic || "", status: doc.data().status })),
      });
    }

    if (req.method === "POST" && root === "users" && id && action === "suspend") {
      const mode = req.body?.mode === "block" ? "blocked" : "suspended";
      const reason = String(req.body?.reason || "").trim().slice(0, 500);
      if (!reason) return res.status(400).json({ error: "Skriv en anledning" });
      await db.collection("users").doc(id).set(
        { status: mode, statusReason: reason, disabledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      await db.collection("profiles").doc(id).set({ published: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const business = await db.collection("businesses").doc(id).get();
      if (business.exists) await business.ref.set({ published: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (mode === "blocked") await adminAuth().updateUser(id, { disabled: true });
      await writeAudit(db, admin.uid, mode === "blocked" ? "user.block" : "user.suspend", "user", id, { reason, mode });
      return res.status(200).json({ ok: true, status: mode });
    }

    if (req.method === "POST" && root === "users" && id && action === "unsuspend") {
      await db.collection("users").doc(id).set({ status: "active", statusReason: "", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await adminAuth().updateUser(id, { disabled: false }).catch(() => undefined);
      await writeAudit(db, admin.uid, "user.unsuspend", "user", id, {});
      return res.status(200).json({ ok: true });
    }

    if (req.method === "GET" && root === "jobs" && !id) {
      const docs = await listJobs(db);
      const jobs = docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: stamp(doc.data().createdAt), paidAt: stamp(doc.data().paidAt) }));
      return res.status(200).json({ jobs });
    }

    if (req.method === "GET" && root === "jobs" && id && action === "chat") {
      const job = await db.collection("jobs").doc(id).get();
      if (!job.exists) return res.status(404).json({ error: "Uppdraget finns inte" });
      const chats = await db.collection("chats").where("jobId", "==", id).limit(1).get();
      const chat = chats.docs[0];
      const messages = chat ? await chat.ref.collection("messages").orderBy("createdAt", "asc").limit(50).get() : null;
      await writeAudit(db, admin.uid, "chat.access", "job", id, { chatId: chat?.id || "" });
      return res.status(200).json({
        messages: messages ? messages.docs.map((doc) => ({ id: doc.id, senderId: doc.data().senderId, text: doc.data().text, createdAt: stamp(doc.data().createdAt) })) : [],
      });
    }

    if (req.method === "GET" && root === "jobs" && id && !action) {
      const job = await db.collection("jobs").doc(id).get();
      if (!job.exists) return res.status(404).json({ error: "Uppdraget finns inte" });
      const offers = await db.collection("offers").where("jobId", "==", id).limit(20).get();
      return res.status(200).json({
        job: { id, ...job.data(), createdAt: stamp(job.data().createdAt) },
        offers: offers.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      });
    }

    if (req.method === "POST" && root === "jobs" && id && action === "cancel") {
      const reason = String(req.body?.reason || "").trim().slice(0, 500);
      if (!reason) return res.status(400).json({ error: "Skriv en anledning" });
      const ref = db.collection("jobs").doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: "Uppdraget finns inte" });
      const job = snap.data();
      let refunded = false;
      if (req.body?.refund !== false && job.paymentStatus === "succeeded" && job.paymentIntentId) {
        await refundPayment(db, admin.uid, job.paymentIntentId, { amountOre: job.amountOre, reason, jobId: id });
        refunded = true;
      }
      await ref.set(
        {
          status: "cancelled",
          cancelledBy: "admin",
          cancelReason: reason,
          cancelledAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await writeAudit(db, admin.uid, "job.cancel", "job", id, { reason, refunded });
      return res.status(200).json({ ok: true, refunded });
    }

    if (req.method === "POST" && root === "jobs" && id && action === "retry-payout") {
      const result = await scheduleOrTransfer(id);
      await writeAudit(db, admin.uid, "payout.retry", "job", id, { payoutStatus: result.payoutStatus || "" });
      return res.status(200).json(result);
    }

    if (req.method === "GET" && root === "payments") {
      const docs = await listJobs(db);
      const payments = docs
        .filter((doc) => doc.data().paymentIntentId)
        .map((doc) => {
          const data = doc.data();
          return {
            jobId: doc.id,
            title: data.title || "",
            ownerId: data.ownerId || "",
            workerId: data.workerId || "",
            amountOre: data.amountOre || 0,
            feeOre: data.feeOre || 0,
            workOre: data.workOre || 0,
            refundedOre: data.refundedOre || 0,
            paymentStatus: data.paymentStatus || "",
            payoutStatus: data.payoutStatus || "",
            paymentIntentId: data.paymentIntentId,
            transferId: data.transferId || "",
          };
        });
      return res.status(200).json({ payments });
    }

    if (req.method === "POST" && root === "payments" && id && action === "refund") {
      const result = await refundPayment(db, admin.uid, id, req.body || {});
      return res.status(200).json(result);
    }

    if (req.method === "GET" && root === "support" && !id) {
      const snap = await db.collection("supportThreads").limit(40).get();
      const threads = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data(), updatedAt: stamp(doc.data().updatedAt) }))
        .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      return res.status(200).json({ threads });
    }

    if (req.method === "GET" && root === "support" && id && !action) {
      const thread = await db.collection("supportThreads").doc(id).get();
      if (!thread.exists) return res.status(404).json({ error: "Tråden finns inte" });
      const messages = await thread.ref.collection("messages").orderBy("createdAt", "asc").limit(80).get();
      return res.status(200).json({
        thread: { id, ...thread.data() },
        messages: messages.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: stamp(doc.data().createdAt) })),
      });
    }

    if (req.method === "POST" && root === "support" && id && action === "messages") {
      const text = String(req.body?.text || "").trim().slice(0, 4000);
      if (!text) return res.status(400).json({ error: "Skriv ett svar" });
      const ref = db.collection("supportThreads").doc(id);
      await ref.collection("messages").add({
        senderId: admin.uid,
        senderRole: "admin",
        text,
        createdAt: FieldValue.serverTimestamp(),
      });
      await ref.set({ lastMessageAt: FieldValue.serverTimestamp(), lastMessagePreview: text.slice(0, 140), updatedAt: FieldValue.serverTimestamp(), status: "pending" }, { merge: true });
      await writeAudit(db, admin.uid, "support.reply", "support", id, { length: text.length });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "POST" && root === "support" && id && action === "close") {
      await db.collection("supportThreads").doc(id).set({ status: "closed", closedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await writeAudit(db, admin.uid, "support.close", "support", id, {});
      return res.status(200).json({ ok: true });
    }

    if (req.method === "GET" && root === "reports") {
      const snap = await db.collection("reports").limit(40).get();
      const reports = snap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: stamp(doc.data().createdAt) }));
      return res.status(200).json({ reports });
    }

    if (req.method === "POST" && root === "reports" && id && action === "resolve") {
      const status = req.body?.status === "dismissed" ? "dismissed" : "resolved";
      const note = String(req.body?.note || "").trim().slice(0, 500);
      await db.collection("reports").doc(id).set({ status, resolutionNote: note, resolvedBy: admin.uid, resolvedAt: FieldValue.serverTimestamp() }, { merge: true });
      await writeAudit(db, admin.uid, "report.resolve", "report", id, { status });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "GET" && root === "analytics") {
      return res.status(200).json(await analytics(db));
    }

    if (req.method === "GET" && root === "audit") {
      const snap = await db.collection("auditLogs").orderBy("createdAt", "desc").limit(40).get().catch(async () => db.collection("auditLogs").limit(40).get());
      const logs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: stamp(doc.data().createdAt) }));
      return res.status(200).json({ logs });
    }

    return res.status(404).json({ error: "Okänd adminväg" });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Något gick fel" });
  }
}

async function refundPayment(db, actorUid, paymentIntentId, body) {
  const reason = String(body.reason || "").trim().slice(0, 500);
  if (!reason) {
    const error = new Error("Skriv en anledning");
    error.status = 400;
    throw error;
  }
  const stripe = stripeClient();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const jobId = body.jobId || intent.metadata?.jobId;
  if (!jobId) {
    const error = new Error("Betalningen saknar uppdrag");
    error.status = 400;
    throw error;
  }
  const ref = db.collection("jobs").doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) {
    const error = new Error("Uppdraget finns inte");
    error.status = 404;
    throw error;
  }
  const job = snap.data();
  const captured = job.amountOre || intent.amount_received || intent.amount;
  const already = job.refundedOre || 0;
  const amount = Math.min(Number(body.amountOre || captured - already), captured - already);
  if (!amount || amount < 1) {
    const error = new Error("Inget kvar att återbetala");
    error.status = 409;
    throw error;
  }
  if (job.transferId) {
    const reverse = Math.min(workerShareOre(amount), workerShareOre(captured));
    await stripe.transfers.createReversal(job.transferId, { amount: reverse });
  }
  const refund = await stripe.refunds.create({ payment_intent: paymentIntentId, amount });
  const refundedOre = already + amount;
  await ref.set(
    {
      refundedOre,
      paymentStatus: refundedOre >= captured ? "refunded" : "partially_refunded",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await writeAudit(db, actorUid, "payment.refund", "payment", paymentIntentId, { jobId, amountOre: amount, refundId: refund.id });
  return { ok: true, refundId: refund.id, refundedOre };
}

async function analytics(db) {
  const [users, jobs, events] = await Promise.all([
    db.collection("users").limit(300).get(),
    db.collection("jobs").limit(300).get(),
    db.collection("analyticsEvents").limit(300).get().catch(() => ({ docs: [] })),
  ]);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const inRange = (value, days) => {
    const at = value && typeof value.toMillis === "function" ? value.toMillis() : 0;
    return at && now - at <= days * day;
  };
  const paid = jobs.docs.filter((doc) => doc.data().paymentStatus === "succeeded" && (doc.data().refundedOre || 0) < (doc.data().amountOre || 1));
  const gmv = paid.reduce((sum, doc) => sum + Math.max(0, (doc.data().amountOre || 0) - (doc.data().refundedOre || 0)), 0);
  const fee = paid.reduce((sum, doc) => sum + (doc.data().feeOre || 0), 0);
  const sessions = events.docs.filter((doc) => doc.data().name === "session_start");
  const dauIds = new Set(sessions.filter((doc) => inRange(doc.data().createdAt, 1)).map((doc) => doc.data().uid));
  const mauIds = new Set(sessions.filter((doc) => inRange(doc.data().createdAt, 30)).map((doc) => doc.data().uid));
  const categories = {};
  for (const doc of jobs.docs) {
    const name = doc.data().category || "Övrigt";
    categories[name] = (categories[name] || 0) + 1;
  }
  return {
    dau: dauIds.size,
    mau: mauIds.size,
    signups30: users.docs.filter((doc) => inRange(doc.data().createdAt, 30)).length,
    jobsPosted30: jobs.docs.filter((doc) => inRange(doc.data().createdAt, 30)).length,
    assigned: jobs.docs.filter((doc) => doc.data().status === "assigned" || doc.data().status === "completed").length,
    paid: paid.length,
    completed: jobs.docs.filter((doc) => doc.data().status === "completed").length,
    cancelled: jobs.docs.filter((doc) => doc.data().status === "cancelled").length,
    gmvOre: gmv,
    feeOre: fee,
    categories: Object.entries(categories)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
  };
}
