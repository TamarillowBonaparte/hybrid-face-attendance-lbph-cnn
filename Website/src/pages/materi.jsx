import DashboardLayout from "../layouts/dashboardlayout";
import { useState, useEffect } from "react";
import { navigationItems } from "../navigation/navigation";
import { Users, ArrowRight, AlertCircle, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../utils/apiUtils";

export default function Materi() {
  const [activeNav, setActiveNav] = useState("materi");
  const [kelasMKList, setKelasMKList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    console.log("🔵 Component Materi mounted");
    fetchKelasMK();
  }, []);

  const fetchKelasMK = async () => {
    console.log("🔵 fetchKelasMK started");
    try {
      setLoading(true);
      setError(null);
      
      console.log("🔵 Calling apiGet('/kelas-mata-kuliah/me')");
      const data = await apiGet('/kelas-mata-kuliah/me');
      
      console.log("✅ Data kelas mata kuliah received:", data);
      console.log("✅ Data type:", typeof data);
      console.log("✅ Is Array?:", Array.isArray(data));
      console.log("✅ Data length:", data?.length);
      
      // Ensure data is an array
      if (!Array.isArray(data)) {
        console.error("❌ Data is not an array:", data);
        setError("Invalid data format received from server");
        setKelasMKList([]);
        return;
      }
      
      // Filter only active courses (case-insensitive) - show all if no filter matches
      const activeData = data.filter(mk => mk.status && mk.status.toLowerCase() === 'aktif');
      console.log("✅ Active data length:", activeData.length);
      
      // If no active data, show all data instead
      setKelasMKList(activeData.length > 0 ? activeData : data);
      
    } catch (error) {
      console.error("❌ Error fetching kelas mata kuliah:", error);
      console.error("❌ Error message:", error.message);
      console.error("❌ Error stack:", error.stack);
      setError(error.message || "Failed to load data");
    } finally {
      console.log("🔵 fetchKelasMK finished, loading set to false");
      setLoading(false);
    }
  };

  console.log("🔵 Current state:", { loading, error, kelasMKList });

  if (loading) {
    console.log("🟡 Rendering loading state");
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-gray-600">Loading mata kuliah...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    console.log("🔴 Rendering error state:", error);
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800 mb-1">Error Loading Data</h3>
            <p className="text-red-600 text-sm">{error}</p>
            <button 
              onClick={fetchKelasMK}
              className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  console.log("🟢 Rendering main content, kelasMKList:", kelasMKList);

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
      <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <BookOpen className="text-blue-600" /> Pilih Mata Kuliah
          </h1>
        </div>

        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Total Mata Kuliah Aktif = {kelasMKList.length}
          </p>
        </div>

        {kelasMKList.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Belum ada mata kuliah yang Anda ampu</p>
            <button 
              onClick={fetchKelasMK}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition"
            >
              Refresh Data
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {kelasMKList.map((kelasMK, index) => {
              console.log(`🟢 Rendering kelas MK ${index}:`, kelasMK);
              return (
                <div
                  key={kelasMK.id_kelas_mk}
                  onClick={() => {
                    console.log("🔵 Kelas MK clicked:", kelasMK);
                    navigate(`/materi/kelas-mk/${kelasMK.id_kelas_mk}`);
                  }}
                  className="border border-gray-200 rounded-xl p-6 bg-white hover:shadow-lg transition cursor-pointer hover:border-blue-400 group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition">
                      {kelasMK.nama_mk}
                    </h2>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-600 text-sm">
                      <span className="font-medium">Kode:</span> {kelasMK.kode_mk}
                    </p>
                    <p className="text-gray-600 text-sm">
                      <span className="font-medium">Kelas:</span> {kelasMK.nama_kelas} ({kelasMK.prodi})
                    </p>
                    <p className="text-gray-600 text-sm">
                      <span className="font-medium">Tahun Ajaran:</span> {kelasMK.tahun_ajaran}
                    </p>
                    <p className="text-gray-600 text-sm">
                      <span className="font-medium">Semester:</span> {kelasMK.semester_aktif}
                    </p>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-gray-500">{kelasMK.sks} SKS</span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {kelasMK.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}