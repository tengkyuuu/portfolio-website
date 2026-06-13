import type { ChangeEvent, ReactNode } from "react";

/** Shared form primitives for the admin. Word-document aesthetic, focus rings in Word-blue. */

type FieldProps = {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function Field({ label, hint, required, children, className = "" }: FieldProps) {
  return (
    <label className={"block " + className}>
      <span className="flex items-baseline gap-1.5 mb-1.5">
        <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {label}
        </span>
        {required && <span className="text-word-blue text-[10px]">*</span>}
        {hint && (
          <span className="font-ui text-[11px] text-ink-subtle italic ml-auto">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

type InputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "url" | "email";
  monospace?: boolean;
  disabled?: boolean;
  className?: string;
};

const baseInput =
  "w-full bg-paper border border-rule rounded-sm px-3 py-2 text-[14px] text-ink placeholder:text-ink-subtle outline-none transition-colors focus:border-word-blue focus:ring-2 focus:ring-word-blue/20 disabled:opacity-60 disabled:cursor-not-allowed";

export function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  monospace = false,
  disabled = false,
  className = "",
}: InputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={
        baseInput + (monospace ? " font-ui tabular-nums" : "") + " " + className
      }
    />
  );
}

type TextareaProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  serif?: boolean;
  className?: string;
};

export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  serif = false,
  className = "",
}: TextareaProps) {
  return (
    <textarea
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={
        baseInput +
        " leading-[1.6] resize-y" +
        (serif ? " font-doc text-[15px]" : "") +
        " " +
        className
      }
    />
  );
}

type SelectProps<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
};

export function Select<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: SelectProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={baseInput + " bg-paper " + className}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type ToggleProps = {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
};

export function Toggle({ checked, onChange, label, hint }: ToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group select-none">
      <span
        className={
          "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors " +
          (checked ? "bg-word-blue" : "bg-rule")
        }
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          className={
            "absolute top-0.5 left-0.5 inline-block h-4 w-4 rounded-full bg-paper shadow-sm transition-transform " +
            (checked ? "translate-x-4" : "translate-x-0")
          }
        />
      </span>
      <span className="flex flex-col">
        <span className="font-ui text-[13px] font-medium text-ink">{label}</span>
        {hint && <span className="font-ui text-[11px] text-ink-subtle">{hint}</span>}
      </span>
    </label>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
};

export function Button({
  children,
  onClick,
  variant = "secondary",
  icon,
  type = "button",
  disabled,
  className = "",
}: ButtonProps) {
  const styles: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary:
      "bg-word-blue text-white hover:bg-word-blue-dark active:scale-[0.98]",
    secondary:
      "bg-paper text-ink border border-rule hover:bg-ribbon-hover active:scale-[0.98]",
    ghost:
      "text-ink-muted hover:text-ink hover:bg-ribbon-hover",
    danger:
      "bg-paper text-red-600 border border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950 active:scale-[0.98]",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[13px] font-ui font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
        styles[variant] +
        " " +
        className
      }
    >
      {icon && (
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={
        "grid h-7 w-7 place-items-center rounded-sm text-ink-muted hover:bg-ribbon-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed " +
        (danger ? "hover:text-red-600 dark:hover:text-red-400" : "hover:text-ink")
      }
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
        {icon}
      </span>
    </button>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-paper border border-rule rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-6">
      {(title || description || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="font-doc text-[18px] font-bold text-ink leading-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="font-ui text-[12px] text-ink-subtle mt-0.5">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export function Row({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"grid grid-cols-1 sm:grid-cols-2 gap-4 " + className}>{children}</div>;
}

export function Divider({ label }: { label?: string }) {
  if (label) {
    return (
      <div className="flex items-center gap-3 my-5">
        <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-ink-subtle">
          {label}
        </span>
        <div className="flex-1 h-px bg-rule" />
      </div>
    );
  }
  return <div className="h-px bg-rule my-5" />;
}
