export type DayHours = { on: boolean; from: string; to: string };

export type WorkSchedule = {
  /** Weekday indexes, Monday = 0 … Sunday = 6. */
  days: number[];
  from: string;
  to: string;
  /** Overrides for a real local calendar day, keyed YYYY-MM-DD. */
  dates: Record<string, DayHours>;
};

const KEY = "velio-schedule-v1";

export const defaultSchedule = (): WorkSchedule => ({
  days: [0, 1, 2, 3, 4],
  from: "08:00",
  to: "17:00",
  dates: {},
});

/** Local calendar day, independent of UTC. */
export function localDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function sameLocalDay(a: Date, b: Date) {
  return localDateKey(a) === localDateKey(b);
}

/** Monday of the local week that contains `now`, plus `offset` weeks. */
export function mondayOf(now: Date, offset = 0) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = day.getDay();
  const delta = (weekday === 0 ? -6 : 1 - weekday) + offset * 7;
  day.setDate(day.getDate() + delta);
  return day;
}

export function weekDates(now: Date, offset = 0) {
  const monday = mondayOf(now, offset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    return date;
  });
}

export function loadSchedule(): WorkSchedule {
  if (typeof window === "undefined") return defaultSchedule();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSchedule();
    const parsed = JSON.parse(raw) as Partial<WorkSchedule>;
    const days = Array.isArray(parsed.days) ? parsed.days.filter((day) => day >= 0 && day <= 6) : defaultSchedule().days;
    return {
      days: days.length ? days : defaultSchedule().days,
      from: typeof parsed.from === "string" ? parsed.from : "08:00",
      to: typeof parsed.to === "string" ? parsed.to : "17:00",
      dates: parsed.dates && typeof parsed.dates === "object" ? parsed.dates : {},
    };
  } catch {
    return defaultSchedule();
  }
}

export function saveSchedule(schedule: WorkSchedule) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(schedule));
}

export function saveWeekTemplate(days: number[], from: string, to: string) {
  const current = loadSchedule();
  saveSchedule({ ...current, days, from, to });
}

/** Hours for one real local date: a saved day wins, otherwise the weekly template. */
export function hoursOn(schedule: WorkSchedule, date: Date): DayHours {
  const saved = schedule.dates[localDateKey(date)];
  if (saved && typeof saved.on === "boolean" && saved.from && saved.to) return saved;
  const index = (date.getDay() + 6) % 7;
  return { on: schedule.days.includes(index), from: schedule.from, to: schedule.to };
}

export function withDateHours(schedule: WorkSchedule, date: Date, hours: DayHours): WorkSchedule {
  return { ...schedule, dates: { ...schedule.dates, [localDateKey(date)]: hours } };
}
