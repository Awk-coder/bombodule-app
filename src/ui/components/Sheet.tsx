import type { ComponentChildren } from "preact";

export function Sheet({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: ComponentChildren;
}) {
  if (!open) return null;
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class={`sheet ${className ?? ""}`.trim()} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-handle" />
        {children}
      </div>
    </div>
  );
}
