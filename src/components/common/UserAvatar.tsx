import { Blobatar } from "@blobatar/react";
import "blobatar/motion.css";
import { ACCENT, GLASS, RADIUS } from "@/design/tokens";

export interface UserAvatarProps {
  name: string;
  size?: number;
  className?: string;
}

export function UserAvatar({ name, size = 64, className = "" }: UserAvatarProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: RADIUS.pill,
        overflow: "hidden",
        backgroundColor: GLASS.fillRaised,
        border: `1px solid ${GLASS.border}`,
        boxShadow: `0 0 16px ${ACCENT.glow}`,
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <Blobatar name={name} size={size} animate="hover" />
    </div>
  );
}
