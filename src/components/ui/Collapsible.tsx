import { useId, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface CollapsibleProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: React.ReactNode | ((args: { open: boolean }) => React.ReactNode);
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function Collapsible({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  trigger,
  children,
  className,
  contentClassName,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const reduced = useReducedMotion();
  const contentId = useId();

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const triggerNode =
    typeof trigger === "function"
      ? (trigger as (args: { open: boolean }) => React.ReactNode)({ open })
      : trigger;

  return (
    <div className={className}>
      <div onClick={() => setOpen(!open)}>{triggerNode}</div>
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: reduced ? "none" : "grid-template-rows 200ms ease-out",
        }}
      >
        <div
          {...({ inert: !open ? "" : undefined } as any)}
          id={contentId}
          className={contentClassName}
          style={{ overflow: "hidden", minHeight: 0 }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default Collapsible;
