import { useEffect, useRef, useState } from "react";

export function useRestTimer(endsAt: number) {
  const [remaining, setRemaining] = useState(() => Math.max(0, endsAt - Date.now()));
  const finishedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      const left = Math.max(0, endsAt - Date.now());
      setRemaining(left);
      if (left <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        window.clearInterval(id);
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [endsAt]);

  return remaining;
}
