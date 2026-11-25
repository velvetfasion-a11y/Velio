import { useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { ArrowLeft, Camera, Pencil, Plus, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { initialsOf, publicDisplayName } from "@/lib/velio/data";
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

function readAvatarFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 480;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("Bilden kunde inte läsas"));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProfilePhoto({ large = false, prompt = false }: { large?: boolean; prompt?: boolean }) {
  const profile = useVelio((state) => state.profile);
  const setAvatar = useVelio((state) => state.setAvatar);
  const showToast = useVelio((state) => state.showToast);
  const inputRef = useRef<HTMLInputElement>(null);
  const initials = initialsOf(publicDisplayName(profile.name) || "V") || "V";
  const hasPhoto = Boolean(profile.avatar);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={hasPhoto ? "Byt profilbild" : "Lägg upp profilbild"}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "grid place-items-center overflow-hidden rounded-full bg-[#f3ece3] font-serif text-ink",
          large ? "size-[6.6rem] text-3xl ring-[3px] ring-white" : "size-14 text-lg",
        )}
      >
        {profile.avatar ? <img src={profile.avatar} alt="" className="h-full w-full object-cover" /> : prompt ? <Camera className={large ? "size-8" : "size-5"} /> : initials}
      </button>
      <span className="pointer-events-none absolute right-0 bottom-0 grid size-7 place-items-center rounded-full bg-white shadow">
        {prompt && !hasPhoto ? <Plus className="size-3.5" /> : <Pencil className="size-3.5" />}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void readAvatarFile(file)
            .then((avatar) => {
              setAvatar(avatar);
              showToast("Bilden är uppdaterad");
            })
            .catch(() => showToast("Bilden kunde inte läsas"));
        }}
      />
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

export function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      {onBack ? <BackButton onClick={onBack} /> : null}
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
