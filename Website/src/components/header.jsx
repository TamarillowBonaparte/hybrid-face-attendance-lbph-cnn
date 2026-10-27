import {
  BookOpen,
  ChevronDown,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { getUser } from "../utils/auth";

export default function Header({
  onLogout,
  onToggleMobileSidebar,
  isMobileSidebarOpen,
}) {
  const [showProfile, setShowProfile] = useState(false);
  const [userData, setUserData] = useState(null);
  const dropdownRef = useRef(null);

  // Load user data from storage
  useEffect(() => {
    const user = getUser();
    if (user) {
      setUserData(user);
    }
  }, []);

  // Tutup dropdown kalau klik di luar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Left Side: Hamburger + Logo */}
          <div className="flex items-center space-x-3">
            {/* Hamburger Menu untuk Mobile */}
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isMobileSidebarOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>

            {/* Logo */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="E-learn Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                E-learn
              </h1>
              <p className="hidden sm:block text-sm text-gray-500">
                Platform Pembelajaran Online
              </p>
            </div>
          </div>

          {/* Right Side: User Profile */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Profil User */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center space-x-2 sm:space-x-3 p-1.5 sm:p-2 rounded-xl hover:bg-gray-100/50 transition-colors"
              >
                {(() => {
                  const displayName = userData?.name || userData?.nama || userData?.username || "User";
                  const displayShort = displayName !== "User" ? displayName.split(" ").slice(0, 2).join(" ") : "User";
                  return (
                    <>
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {displayName !== "User"
                            ? displayName
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()
                            : "U"}
                        </span>
                      </div>
                      <div className="hidden md:block text-left">
                        <p className="text-sm font-medium text-gray-900">
                          {displayShort}
                        </p>
                        <p className="text-xs text-gray-500">
                          {userData?.role === 'admin' ? 'Super Admin' :
                            userData?.role === 'dosen' ? 'Dosen' :
                              userData?.role === 'mahasiswa' ? 'Mahasiswa' :
                                userData?.role || 'Pengguna'}
                        </p>
                      </div>
                    </>
                  );
                })()}
                <ChevronDown className="h-4 w-4 text-gray-400 hidden sm:block" />
              </button>

              {/* Dropdown Menu */}
              {showProfile && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => {
                      setShowProfile(false);
                      onLogout && onLogout();
                    }}
                    className="flex items-center w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
