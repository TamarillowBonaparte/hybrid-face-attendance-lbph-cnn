import Header from "../components/header";
import Sidebar from "../components/sidebar";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { clearAuth } from "../utils/auth";

export default function DashboardLayout({
  children,
  navigationItems,
  activeNav,
  setActiveNav,
  onLogout,
}) {
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      clearAuth();
      window.location.href = "/login";
    }
  };

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header menerima onLogout dan mobile sidebar controls */}
      <Header
        onLogout={handleLogout}
        onToggleMobileSidebar={toggleMobileSidebar}
        isMobileSidebarOpen={isMobileSidebarOpen}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-[1600px]">
        <div className="flex gap-6">
          {/* Mobile Sidebar Overlay */}
          {isMobileSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={closeMobileSidebar}
            />
          )}

          {/* Sidebar - Fixed width, lebih kecil */}
          <div
            className={`
            fixed lg:relative lg:block
            inset-y-0 left-0 z-50 lg:z-0
            w-56 lg:w-48
            transform transition-transform duration-300 ease-in-out lg:transform-none
            ${isMobileSidebarOpen
                ? "translate-x-0"
                : "-translate-x-full lg:translate-x-0"
              }
          `}
          >
            <Sidebar
              navigationItems={navigationItems}
              activeNav={activeNav}
              setActiveNav={setActiveNav}
              onLogout={handleLogout}
              onCloseMobile={closeMobileSidebar}
            />
          </div>

          {/* Content Area - Flexible, mengambil sisa space */}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
