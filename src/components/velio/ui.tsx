import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { ArrowLeft, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { useVelio } from "@/lib/velio/store";

export function Btn({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "bank" }) {
  return (
    <button
      type={type}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-semibold transition active:scale-[0.99] disabled:opacity-40",
        variant === "primary" && "bg-ink text-paper",
        variant === "secondary" && "border border-line bg-paper text-ink",
        variant === "bank" && "bg-bank text-paper",
        className,
      )}
      {...props}
    />
  );
}

export function Avatar({ text, large = false }: { text: string; large?: boolean }) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center bg-soft font-semibold text-ink",
        large ? "size-20 rounded-3xl text-2xl" : "size-12 rounded-xl text-sm",
      )}
    >
      {text}
    </div>
  );
}

export function Stars({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} av 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn("size-3.5 text-ink", index < filled ? "fill-ink" : "fill-transparent")}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        className="w-full rounded-xl border border-line bg-paper px-3.5 py-3 text-base outline-none focus:border-ink"
        {...props}
      />
    </label>
  );
}

export function BackButton({ onClick, label = "Tillbaka" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-10 place-items-center rounded-full text-ink"
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}

export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      <BackButton onClick={onBack} />
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

export function FullScreen({
  title,
  onBack,
  children,
  footer,
}: {
  title?: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="sheet-in absolute inset-0 z-30 flex flex-col bg-paper">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <BackButton onClick={onBack} />
        {title ? <h2 className="font-display text-lg font-semibold">{title}</h2> : <span className="sr-only">Stäng</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer ? <div className="border-t border-line px-5 py-4">{footer}</div> : null}
    </div>
  );
}

export function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-ink/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="sheet-in max-h-[86%] overflow-y-auto rounded-t-3xl bg-paper px-5 pt-3 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" />
        <h2 className="mb-4 font-display text-xl font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useVelio((state) => state.toast);
  if (!toast) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-50 flex justify-center px-6">
      <div
        role="status"
        aria-live="polite"
        className="max-w-full rounded-xl bg-ink px-4 py-2.5 text-center text-sm text-paper shadow-lg"
      >
        {toast}
      </div>
    </div>
  );
}

export function MenuRow({
  icon,
  label,
  hint,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b border-line px-1 py-4 text-left text-base last:border-b-0",
        danger && "text-ink",
      )}
    >
      <span className="grid w-6 place-items-center text-ink">{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
      {hint ?? <span className="text-sm text-muted">›</span>}
    </button>
  );
}
