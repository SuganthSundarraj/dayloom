"use client";
import { useId, useRef, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";

export default function Dialog({
  title,
  description,
  busy = false,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const descriptionId = useId();
  const content = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <div className="dialog-viewport">
          <DialogPrimitive.Content
            ref={content}
            className="dialog-content"
            aria-describedby={description ? descriptionId : undefined}
            onOpenAutoFocus={(event) => {
              previousFocus.current =
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null;
              const firstField = content.current?.querySelector<HTMLElement>(
                "input:not([type=checkbox]),textarea,select",
              );
              if (firstField) {
                event.preventDefault();
                firstField.focus();
              }
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (previousFocus.current?.isConnected)
                previousFocus.current.focus();
            }}
            onEscapeKeyDown={(event) => {
              if (busy) event.preventDefault();
            }}
            onPointerDownOutside={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            <div className="dialog-head">
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="dialog-close"
                  aria-label="Close dialog"
                  disabled={busy}
                >
                  <X size={20} />
                </button>
              </DialogPrimitive.Close>
            </div>
            {description && (
              <DialogPrimitive.Description
                id={descriptionId}
                className="dialog-description"
              >
                {description}
              </DialogPrimitive.Description>
            )}
            <div className="dialog-body">{children}</div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
