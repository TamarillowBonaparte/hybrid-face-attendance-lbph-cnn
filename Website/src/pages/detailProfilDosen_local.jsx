import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/dashboardlayout";
import { navigationItems } from "../navigation/navigation";
import { 
  User, Mail, Phone, MapPin, Calendar, Award, 
  ArrowLeft, BookOpen, BarChart3, Users
} from "lucide-react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function DetailProfilDosen() {
  const { id_dosen } = useParams();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("kelola-dosen");
  const [activeTab, setActiveTab] = useState("profil");
  const [dosen, setDosen] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDosenDetail();
    fetchAssignments();
  }, [id_dosen]);

  const fetchDosenDetail = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/dosen/${id_dosen}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDosen(response.data);
    } catch (error) {
      console.error("Error fetching dosen:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/kelas-mata-kuliah/dosen/${id_dosen}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAssignments(response.data);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setAssignments([]);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-gray-600">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!dosen) {
    return (
      <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
        <div className="text-center py-12">
          <p className="text-gray-500">Data dosen tidak ditemukan</p>
          <button
            onClick={() => navigate('/kelola-dosen')}
            className="mt-4 text-blue-600 hover:underline"
          >
            Kembali ke Kelola Dosen
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => navigate('/kelola-dosen')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="h-5 w-5" />
          Kembali ke Kelola Dosen
        </button>

        {/* Header Card */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-lg">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
              <User className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">{dosen.nama_dosen}</h1>
              <p className="text-blue-100 text-lg">NIP: {dosen.nip}</p>
              <div className="flex gap-4 mt-3">
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                  {dosen.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                </span>
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                  {assignments.length} Assignment
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab("profil")}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition ${
                  activeTab === "profil"
                    ? "border-blue-600 text-blue-600 font-semibold"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <User className="h-5 w-5" /> Info Pribadi
              </button>
              <button
                onClick={() => setActiveTab("assignment")}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition ${
                  activeTab === "assignment"
                    ? "border-blue-600 text-blue-600 font-semibold"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <BookOpen className="h-5 w-5" /> Assignment ({assignments.length})
              </button>
              <button
                onClick={() => setActiveTab("statistik")}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition ${
                  activeTab === "statistik"
                    ? "border-blue-600 text-blue-600 font-semibold"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <BarChart3 className="h-5 w-5" /> Statistik
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "profil" && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Informasi Pribadi</h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {/* NIP */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Award className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">NIP</p>
                      <p className="font-semibold text-gray-900">{dosen.nip}</p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-semibold text-gray-900">{dosen.email_dosen || dosen.email || '-'}</p>
                    </div>
                  </div>

                  {/* No HP */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">No HP</p>
                      <p className="font-semibold text-gray-900">{dosen.no_hp || '-'}</p>
                    </div>
                  </div>

                  {/* Tempat, Tanggal Lahir */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Tempat, Tanggal Lahir</p>
                      <p className="font-semibold text-gray-900">
                        {dosen.tempat_lahir || '-'}, {formatDate(dosen.tanggal_lahir)}
                      </p>
                    </div>
                  </div>

                  {/* Jenis Kelamin */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-pink-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Jenis Kelamin</p>
                      <p className="font-semibold text-gray-900">
                        {dosen.jenis_kelamin === 'L' ? 'Laki-laki' : dosen.jenis_kelamin === 'P' ? 'Perempuan' : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Agama */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Award className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Agama</p>
                      <p className="font-semibold text-gray-900">{dosen.agama || '-'}</p>
                    </div>
                  </div>

                  {/* Alamat */}
                  <div className="md:col-span-2 flex items-start gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Alamat</p>
                      <p className="font-semibold text-gray-900">{dosen.alamat || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "assignment" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Daftar Assignment</h3>
                
                {assignments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Belum ada assignment</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id_kelas_mk}
                        className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 text-lg">
                              {assignment.nama_mk}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              Kode MK: {assignment.kode_mk}
                            </p>
                            <div className="flex items-center gap-4 mt-3 flex-wrap">
                              <span className="text-sm text-gray-700 flex items-center gap-1">
                                <Users className="h-4 w-4" /> {assignment.nama_kelas}
                              </span>
                              <span className="text-sm text-gray-700">
                                {assignment.prodi}
                              </span>
                              <span className="text-sm text-gray-700">
                                {assignment.tahun_ajaran}
                              </span>
                              <span className="text-sm text-gray-700">
                                Semester {assignment.semester_aktif}
                              </span>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            assignment.status === 'Aktif' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {assignment.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "statistik" && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Statistik</h3>
                
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-blue-600 font-medium">Total Mata Kuliah</p>
                      <BookOpen className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-3xl font-bold text-blue-900">{assignments.length}</p>
                  </div>

                  <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-green-600 font-medium">Assignment Aktif</p>
                      <BarChart3 className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold text-green-900">
                      {assignments.filter(a => a.status === 'Aktif').length}
                    </p>
                  </div>

                  <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-purple-600 font-medium">Total Kelas</p>
                      <Users className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="text-3xl font-bold text-purple-900">
                      {new Set(assignments.map(a => a.id_kelas)).size}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6 mt-6">
                  <h4 className="font-semibold text-gray-800 mb-3">Distribusi Mata Kuliah</h4>
                  <div className="space-y-2">
                    {assignments.map((assignment) => (
                      <div key={assignment.id_kelas_mk} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{assignment.nama_mk}</span>
                        <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                          {assignment.nama_kelas}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
