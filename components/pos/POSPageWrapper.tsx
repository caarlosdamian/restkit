"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import POSSessionStart from "./POSSessionStart";

interface POSPageWrapperProps {
  children: React.ReactNode;
  userRole?: string;
  employeeNumber?: string;
  userName?: string;
}

export default function POSPageWrapper({
  children,
  userRole,
  employeeNumber,
  userName,
}: POSPageWrapperProps) {
  const [posSession, setPOSSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);



  async function fetchSession() {
    try {
      const posEmployeeSession = window.localStorage.getItem("posEmployeeSession");
      if (!posEmployeeSession) {
        setLoading(false);
        return;
      }

      const session = JSON.parse(posEmployeeSession);
      console.log('=_+_+_+',session)
      const res = await fetch(`/api/pos-session/current?employeeNumber=${encodeURIComponent(session.employeeNumber)}`);
      if (res.ok) {
        const data = await res.json();
        setPOSSession(data.session);
      }
    } finally {
      setLoading(false);
    }
  }

    useEffect(() => {
      console.log('entrando')
    fetchSession();
  }, []);

  function handleSessionStarted() {
    fetchSession();
  }


  console.log('posSession',posSession)
  if (loading) {
    return <div className="p-6 text-center">Cargando...</div>;
  }

  // Show message if caja is closed and user is staff
  if (!posSession && userRole === "STAFF") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Clock size={48} className="mx-auto mb-4 text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Caja cerrada</h1>
          <p className="text-gray-600">Un gerente debe abrir la caja para comenzar a vender.</p>
        </div>
      </div>
    );
  }

  // Show session start form if caja is closed and user is manager
  if (!posSession && (userRole === "OWNER" || userRole === "ADMIN")) {
    return (
      <POSSessionStart
        employeeNumber={employeeNumber || "000"}
        employeeName={userName || "Gerente"}
        onSessionStarted={handleSessionStarted}
      />
    );
  }

  // Show normal content if session is open
  return <>{children}</>;
}
