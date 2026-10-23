/**
 * The design-system primitives.
 *
 * Barrel so a component imports `GlassCard` from one place, and so the dev
 * catalog can enumerate the set without reaching into four files.
 */

export { GlassCard, type GlassCardProps } from "./GlassCard";
export {
  GlassButton,
  GLASS_BUTTON_RECIPES,
  type GlassButtonProps,
  type GlassButtonVariant,
} from "./GlassButton";
export { Skeleton, type SkeletonProps } from "./Skeleton";