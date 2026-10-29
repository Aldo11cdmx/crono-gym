import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";

export function ProtectedRoute({ children, requiredRoles }: { children: React.ReactNode; requiredRoles?: string[] }) {
  const { ready, user, hasAnyRole } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <div style={{ padding: 24 }}>Cargando...</div>;
  }
  if (!user) {
    const returnTo = encodeURIComponent(location.pathname);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  if (requiredRoles && requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    return <div style={{ padding: 24 }}>No tienes permiso para ver esta página.</div>;
  }
  return <>{children}</>;
}
