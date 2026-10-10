import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

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
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const activeTouchId = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setDragY(0);
      setIsDragging(false);
      activeTouchId.current = null;
    }
  }, [open]);

  if (!open) return null;

  const handleTouchStart = (e: TouchEvent) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (sheet.scrollTop > 2) return;
    const touch = e.touches[0];
    activeTouchId.current = touch.identifier;
    startY.current = touch.clientY;
    currentY.current = touch.clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (activeTouchId.current === null) return;
    const touch = Array.from(e.touches).find((t) => t.identifier === activeTouchId.current);
    if (!touch) return;
    const sheet = sheetRef.current;
    if (sheet && sheet.scrollTop > 2) {
      activeTouchId.current = null;
      setIsDragging(false);
      setDragY(0);
      return;
    }
    const dy = touch.clientY - startY.current;
    if (dy > 0) {
      currentY.current = touch.clientY;
      setIsDragging(true);
      setDragY(dy);
      if (e.cancelable) e.preventDefault();
    } else {
      setDragY(0);
      setIsDragging(false);
    }
  };

  const handleTouchEnd = () => {
    if (activeTouchId.current === null) return;
    activeTouchId.current = null;
    setIsDragging(false);
    const dy = currentY.current - startY.current;
    if (dy > 80) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <div
      class="sheet-backdrop"
      onClick={onClose}
      style={{
        opacity: dragY > 0 ? Math.max(0.15, 1 - dragY / 320) : undefined,
      }}
    >
      <div
        ref={sheetRef}
        class={`sheet ${className ?? ""}`.trim()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? "none" : "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)",
        }}
      >
        <div class="sheet-handle-zone">
          <div class="sheet-handle" />
        </div>
        {children}
      </div>
    </div>
  );
}
