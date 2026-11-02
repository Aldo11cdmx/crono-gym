import { useState } from "react";

interface Props {
  onFinish: () => Promise<void>;
}

export function FinishWorkoutButton({ onFinish }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onFinish();
    } catch (err) {
      console.error("Error al finalizar sesión:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isSubmitting}
      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold rounded-xl transition-colors"
    >
      {isSubmitting ? "Guardando..." : "Terminar Rutina"}
    </button>
  );
}
