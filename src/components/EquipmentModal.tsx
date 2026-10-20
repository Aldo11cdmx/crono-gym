import { useState } from "react";
import { X } from "lucide-react";
import { equipmentMap } from "@/data/equipmentMap";
import { ACCENT, GLASS, RADIUS, SCRIM, SOLID, SURFACE_ROLE, TEXT, TYPE, Z_INDEX } from "@/design/tokens";

export interface EquipmentModalProps {
  equipmentId: string | null;
  onClose: () => void;
}

export function EquipmentModal({ equipmentId, onClose }: EquipmentModalProps) {
  if (!equipmentId) {
    onClose();
    return null;
  }
  const equipment = equipmentMap[equipmentId];
  if (!equipment) {
    onClose();
    return null;
  }
  const [viewIndex, setViewIndex] = useState(0);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        backgroundColor: SCRIM.modal,
        zIndex: Z_INDEX.modal,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col gap-4 overflow-y-auto p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: SURFACE_ROLE.popover,
          border: `1px solid ${GLASS.border}`,
          borderRadius: RADIUS.sheet,
          boxShadow: GLASS.shadow,
          maxHeight: "80vh",
        }}
      >
        {/* Drag handle */}
        <div
          className="mx-auto h-1.5 w-12 rounded-full"
          style={{ backgroundColor: GLASS.border }}
        />
        <div className="flex items-center justify-between">
          <h2 style={{ color: TEXT.primary }} className="text-xl font-semibold">
            {equipment.name}
          </h2>
          <div className="flex items-center gap-2">
            <span
              style={{
                fontSize: TYPE.caption.size,
                fontFamily: TYPE.mono.font,
                color: TEXT.secondary,
              }}
            >
              {equipment.id}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-xl p-1.5"
              style={{ color: TEXT.tertiary }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          className="relative mb-4 aspect-video w-full overflow-hidden rounded-xl"
          style={{ backgroundColor: SURFACE_ROLE.well }}
        >
          {equipment.views[viewIndex] ? (
            <img
              src={equipment.views[viewIndex].src}
              alt={`${equipment.name} vista ${equipment.views[viewIndex].id}`}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ color: TEXT.tertiary }}
            >
              Imagen no disponible
            </div>
          )}
          <div
            className="absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[10px]"
            style={{ backgroundColor: SOLID.card, color: TEXT.secondary }}
          >
            Vista {viewIndex + 1}
          </div>
        </div>

        {equipment.views.length > 1 && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setViewIndex((prev) => (prev + 1) % equipment.views.length)}
              disabled={viewIndex === equipment.views.length - 1}
              className="rounded-xl px-4 py-2"
              style={{
                backgroundColor: ACCENT.muted,
                color: TEXT.onAccent,
                fontSize: TYPE.caption.size,
              }}
            >
              Siguiente vista
            </button>
          </div>
        )}
      </div>
    </div>
  );
}




