import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Layers,
  User,
  Zap,
  MoreHorizontal,
  Trophy,
  TrendingUp,
  Settings,
  X,
} from "lucide-react";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SPACE,
  SURFACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import { NAV_LABELS } from "@/lib/i18n";
import {
  HOME_PATH,
  ROUTINES_PATH,
  TRAIN_PATH,
  PROFILE_PATH,
  RANGES_PATH,
  PROGRESS_PATH,
} from "@/components/shell/navItems";

type NavItem = {
  id: string;
  path: string;
  label: string;
  ariaLabel: string;
  icon: typeof Home;
  primary?: boolean;
};

const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", path: HOME_PATH, label: NAV_LABELS.home, ariaLabel: NAV_LABELS.home, icon: Home },
  { id: "routines", path: ROUTINES_PATH, label: NAV_LABELS.routines, ariaLabel: NAV_LABELS.routines, icon: Layers },
  { id: "train", path: TRAIN_PATH, label: NAV_LABELS.train, ariaLabel: NAV_LABELS.train, icon: Zap, primary: true },
  { id: "profile", path: PROFILE_PATH, label: NAV_LABELS.profile, ariaLabel: NAV_LABELS.profile, icon: User },
];

const MORE_ITEMS = [
  { id: "ranges", path: RANGES_PATH, label: NAV_LABELS.ranges, icon: Trophy },
  { id: "progress", path: PROGRESS_PATH, label: NAV_LABELS.progress, icon: TrendingUp },
  { id: "settings", path: null as string | null, label: NAV_LABELS.settings, icon: Settings },
];

function isActivePath(pathname: string, itemPath: string) {
  return pathname === itemPath || pathname.startsWith(itemPath + "/");
}

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useActiveSession();
  const reducedMotion = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const pathname = location.pathname;
  const isMoreActive =
    pathname === RANGES_PATH ||
    pathname === PROGRESS_PATH ||
    pathname.startsWith("/developer") ||
    pathname.startsWith("/admin");

  // Lock body scroll while sheet open
  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  // Close on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Focus close button on open; restore focus on close
  useEffect(() => {
    if (moreOpen) {
      closeButtonRef.current?.focus();
    } else {
      moreButtonRef.current?.focus();
    }
  }, [moreOpen]);

  // Escape to close
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const go = (path: string) => {
    navigate(path);
    setMoreOpen(false);
  };

  const handleTrain = () => {
    if (session) {
      navigate(TRAIN_PATH);
    } else {
      navigate(ROUTINES_PATH);
    }
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 0,
          insetInline: 0,
          zIndex: Z_INDEX.nav ?? 40,
          pointerEvents: "none",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        className="md:hidden"
      >
        <nav
          aria-label={NAV_LABELS.home ? "Navegación principal" : "Navegación principal"}
          style={{ pointerEvents: "auto", marginInline: SPACE.md, marginBottom: SPACE.md }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              borderRadius: RADIUS.pill,
              border: `1px solid ${GLASS.border}`,
              background: GLASS.fill,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              padding: `${SPACE.xs} ${SPACE.sm}`,
            }}
          >
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.path);
              const Icon = item.icon;
              if (item.primary) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={handleTrain}
                    aria-label={session ? NAV_LABELS.continueTraining : NAV_LABELS.train}
                    style={{
                      position: "relative",
                      top: -20,
                      height: 56,
                      width: 56,
                      borderRadius: RADIUS.pill,
                      border: `2px solid ${SURFACE.base}`,
                      background: ACCENT.base,
                      color: TEXT.onAccent,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 8px 24px ${ACCENT.base}55`,
                      cursor: "pointer",
                    }}
                  >
                    <Zap size={24} aria-hidden="true" fill="currentColor" />
                  </button>
                );
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.path)}
                  aria-current={active ? "page" : undefined}
                  className="text-[10px]"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    minHeight: MOTION.minTouchTarget,
                    padding: `${SPACE.xs} ${SPACE.sm}`,
                    color: active ? ACCENT.base : TEXT.tertiary,
                    fontWeight: active ? 600 : 400,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <button
              ref={moreButtonRef}
              type="button"
               onClick={() => setMoreOpen(true)}
               aria-current={isMoreActive ? "page" : undefined}
               className="text-[10px]"
              aria-haspopup="dialog"
                aria-expanded={moreOpen}
                style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                minHeight: MOTION.minTouchTarget,
                padding: `${SPACE.xs} ${SPACE.sm}`,
                color: isMoreActive ? ACCENT.base : TEXT.tertiary,
                 fontWeight: isMoreActive ? 600 : 400,
                 background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <MoreHorizontal size={20} aria-hidden="true" />
              <span>{NAV_LABELS.more}</span>
            </button>
          </div>
        </nav>
      </div>

      {moreOpen && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: SCRIM.modal,
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              zIndex: Z_INDEX.modal ?? 50,
            }}
            className="md:hidden"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-nav-more-title"
            className="md:hidden"
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: (Z_INDEX.modal ?? 50) + 1,
              background: GLASS.fill,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderTopLeftRadius: RADIUS.sheet ?? 24,
              borderTopRightRadius: RADIUS.sheet ?? 24,
              border: `1px solid ${GLASS.border}`,
              padding: SPACE.lg,
              paddingBottom: `calc(${SPACE.lg} + env(safe-area-inset-bottom, 0px))`,
              transform: reducedMotion ? "none" : "translateY(0)",
              transition: reducedMotion ? "none" : `transform ${MOTION.normal} ${MOTION.easeOut}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.md }}>
              <h2 id="mobile-nav-more-title" style={{ margin: 0, fontSize: TYPE.title2.size, color: TEXT.primary }}>
                {NAV_LABELS.moreOptions}
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label={NAV_LABELS.close}
                style={{
                  minHeight: MOTION.minTouchTarget,
                  minWidth: MOTION.minTouchTarget,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: RADIUS.control,
                  background: "transparent",
                  border: `1px solid ${GLASS.border}`,
                  color: TEXT.tertiary,
                  cursor: "pointer",
                }}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: SPACE.md }}>
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.path) go(item.path);
                      else setMoreOpen(false);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: SPACE.xs,
                      minHeight: MOTION.minTouchTarget,
                      padding: SPACE.md,
                      borderRadius: RADIUS.control,
                      background: GLASS.fill,
                      border: `1px solid ${GLASS.border}`,
                      color: TEXT.primary,
                      cursor: "pointer",
                    }}
                  >
                    <Icon size={24} aria-hidden="true" color={ACCENT.base} />
                    <span style={{ fontSize: TYPE.caption.size }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
