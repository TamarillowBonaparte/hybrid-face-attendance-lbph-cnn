// src/pages/detailMateri.jsx
import DashboardLayout from "../layouts/dashboardlayout";
import { useState, useEffect } from "react";
import { navigationItems } from "../navigation/navigation";
import { BookOpen, ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../utils/apiUtils";

export default function DetailMateri() {
  const [activeNav, setActiveNav] = useState("materi");
  const [kelasMKInfo, setKelasMKInfo] = useState(null);
  const [materiList, setMateriList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { id_kelas_mk } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("🔵 DetailMateri mounted, id_kelas_mk:", id_kelas_mk);
    fetchKelasMKDetail();
  }, [id_kelas_mk]);

  const fetchKelasMKDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("🔵 Fetching kelas mata kuliah detail:", id_kelas_mk);
      
      // Fetch kelas_mata_kuliah detail to get kode_mk and id_kelas
      const kelasMKData = await apiGet(`/kelas-mata-kuliah/${id_kelas_mk}`);
      console.log("✅ Kelas MK data:", kelasMKData);
      setKelasMKInfo(kelasMKData);
      
      // Fetch all materi using kode_mk + id_kelas (shared across multiple dosen)
      const { kode_mk, id_kelas } = kelasMKData;
      console.log("🔵 Fetching materi for kode_mk:", kode_mk, "id_kelas:", id_kelas);
      const materiData = await apiGet(`/materi?kode_mk=${kode_mk}&id_kelas=${id_kelas}`);
      console.log("✅ Materi data:", materiData);
      
      // Create weeks structure with actual materi count
      const weeks = Array.from({ length: 16 }, (_, i) => {
        const mingguNum = i + 1;
        const materiForWeek = materiData.filter(m => m.minggu === mingguNum);
        return {
          minggu: mingguNum,
          judul: `Minggu ${mingguNum}`,
          materi_count: materiForWeek.length
        };
      });
      setMateriList(weeks);
      
    } catch (error) {
      console.error("❌ Error fetching kelas mata kuliah:", error);
      setError(error.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800 mb-1">Error Loading Data</h3>
            <p className="text-red-600 text-sm">{error}</p>
            <div className="flex gap-2 mt-3">
              <button 
                onClick={fetchKelasMKDetail}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition"
              >
                Coba Lagi
              </button>
              <button 
                onClick={() => navigate("/materi")}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm transition"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
      <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <BookOpen className="text-blue-600" /> Materi Perkuliahan
            </h1>
            {kelasMKInfo && (
              <div className="mt-2">
                <p className="text-gray-600 text-sm">
                  <span className="font-semibold">{kelasMKInfo.nama_mk}</span> ({kelasMKInfo.kode_mk})
                </p>
                <p className="text-gray-500 text-xs">
                  {kelasMKInfo.nama_kelas} • {kelasMKInfo.prodi} • {kelasMKInfo.tahun_ajaran} • Semester {kelasMKInfo.semester_aktif}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate("/materi")}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 transition font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>
        </div>

        {/* Minggu List */}
        <div className="grid md:grid-cols-4 gap-4">
          {materiList.map((week) => (
            <div
              key={week.minggu}
              onClick={() => navigate(`/materi/${id_kelas_mk}/minggu/${week.minggu}`)}
              className="border border-gray-200 rounded-xl p-6 bg-white hover:shadow-lg transition cursor-pointer hover:border-blue-400 group"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition">
                  Minggu {week.minggu}
                </h3>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition" />
              </div>
              <p className="text-xs text-gray-500">
                {week.materi_count} materi tersedia
              </p>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}