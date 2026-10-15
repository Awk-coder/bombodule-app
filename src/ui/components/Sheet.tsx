import type { ComponentChildren, JSX } from "preact";
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
  const [rendered, setRendered] = useState(open);
  const [isClosing, setIsClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const activeTouchId = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const lastChildren = useRef(children);

  if (open && children) {
    lastChildren.current = children;
  }

  const isTest = !!import.meta.env.VITEST;

  const startCloseAnimation = () => {
    if (isClosing) return;
    if (isTest) {
      onClose();
      setRendered(false);
      return;
    }
    setIsClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      onClose();
      setRendered(false);
      setIsClosing(false);
    }, 200);
  };

  useEffect(() => {
    if (open) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setRendered(true);
      setIsClosing(false);
      setDragY(0);
      setIsDragging(false);
    } else if (rendered && !isClosing) {
      if (isTest) {
        setRendered(false);
      } else {
        setIsClosing(true);
        if (closeTimer.current) clearTimeout(closeTimer.current);
        closeTimer.current = window.setTimeout(() => {
          setRendered(false);
          setIsClosing(false);
        }, 200);
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        startCloseAnimation();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isClosing]);

  useEffect(() => {
    if (open) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  if (!open && !rendered) return null;

  const handleTouchStart = (e: TouchEvent) => {
    if (isClosing) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (sheet.scrollTop > 2) return;
    const touch = e.touches[0];
    activeTouchId.current = touch.identifier;
    startY.current = touch.clientY;
    currentY.current = touch.clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isClosing || activeTouchId.current === null) return;
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
      startCloseAnimation();
    } else {
      setDragY(0);
    }
  };

  const handleBackdropClick = (e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      startCloseAnimation();
    }
  };

  const displayChildren = open ? children : lastChildren.current;

  return (
    <div
      class={`sheet-backdrop ${isClosing ? "closing" : ""}`.trim()}
      onClick={handleBackdropClick}
      style={{
        opacity: isClosing ? 0 : dragY > 0 ? Math.max(0.15, 1 - dragY / 320) : undefined,
      }}
    >
      <div
        ref={sheetRef}
        class={`sheet ${isClosing ? "closing" : ""} ${className ?? ""}`.trim()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: isClosing ? "translateY(100%)" : dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging
            ? "none"
            : isClosing
            ? "transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1)"
            : "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)",
        }}
      >
        <div class="sheet-handle-zone">
          <div class="sheet-handle" />
        </div>
        {displayChildren}
      </div>
    </div>
  );
}
