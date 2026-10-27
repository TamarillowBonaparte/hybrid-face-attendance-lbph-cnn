import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  BookOpen,
  CheckCircle,
  Calendar,
  TrendingUp,
  Clock,
  Eye,
  ChevronRight,
  BarChart3,
  Sparkles,
  Search,
} from "lucide-react";
import DashboardLayout from "../layouts/dashboardlayout";
import { navigationItems } from "../navigation/navigation";
import { getDashboardData } from "../utils/apiUtils";
import { getToken, getUser, clearAuth } from "../utils/auth";
import "./Dashboard.css";

const Dashboard = () => {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [userInfo, setUserInfo] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate('/login');
      return;
    }

    const user = getUser();
    setUserInfo(user);
    loadDashboardData();
  }, [navigate]);

  const loadDashboardData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const data = await getDashboardData();
      setDashboardData(data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setDashboardData({
        stats: {
          total_kelas_mk: 0,
          total_mahasiswa: 0,
          total_materi: 0,
          presensi_hari_ini: 0,
        },
        recent_presensi: [],
      });
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    window.location.href = '/login';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  if (loading || !userInfo) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner">
            <Sparkles className="spinner-icon" />
          </div>
          <p className="loading-text">Memuat Dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = dashboardData ? [
    {
      title: "Total Kelas MK",
      value: dashboardData.stats.total_kelas_mk.toString(),
      icon: BookOpen,
      color: "blue",
      trend: null,
    },
    {
      title: "Total Mahasiswa",
      value: dashboardData.stats.total_mahasiswa.toString(),
      icon: Users,
      color: "green",
      trend: null,
    },
    {
      title: "Presensi Hari Ini",
      value: dashboardData.stats.presensi_hari_ini.toString(),
      icon: CheckCircle,
      color: "orange",
      trend: dashboardData.stats.presensi_hari_ini > 0 ? 'up' : null,
    },
    {
      title: "Rata-rata Kehadiran",
      value: dashboardData.stats.total_mahasiswa > 0
        ? Math.round((dashboardData.stats.presensi_hari_ini / dashboardData.stats.total_mahasiswa) * 100) + '%'
        : '0%',
      icon: BarChart3,
      color: "purple",
      trend: null,
    }
  ] : [];

  const filteredPresensi = dashboardData?.recent_presensi.filter(presensi => {
    const query = searchQuery.toLowerCase();
    const formattedDate = formatDate(presensi.tanggal).toLowerCase();
    const persentaseHadir = presensi.total_mhs > 0 
      ? Math.round((presensi.hadir / presensi.total_mhs) * 100)
      : 0;
    
    const matchSearch = (
      presensi.nama_mk.toLowerCase().includes(query) ||
      presensi.kelas.toLowerCase().includes(query) ||
      presensi.pertemuan_ke.toString().includes(query) ||
      formattedDate.includes(query) ||
      presensi.hadir.toString().includes(query) ||
      presensi.alfa.toString().includes(query) ||
      `${presensi.hadir}/${presensi.total_mhs}`.includes(query) ||
      `${persentaseHadir}%`.includes(query) ||
      persentaseHadir.toString().includes(query)
    );

    let matchStatus = true;
    if (statusFilter === "Sempurna") {
      matchStatus = presensi.alfa === 0;
    } else if (statusFilter === "Ada Alfa") {
      matchStatus = presensi.alfa > 0;
    } else if (statusFilter === "< 75%") {
      matchStatus = persentaseHadir < 75;
    }

    return matchSearch && matchStatus;
  }) || [];

  return (
    <DashboardLayout
      navigationItems={navigationItems}
      activeNav={activeNav}
      setActiveNav={setActiveNav}
      onLogout={handleLogout}
    >
      <div className="dashboard-container">
        {/* Welcome Hero Section */}
        <section className="welcome-section">
          <div className="welcome-content">
            <div className="welcome-text">
              <div className="greeting-badge">
                <span className="greeting-dot"></span>
                <span>{getGreeting()}</span>
              </div>
              <h1 className="welcome-title">
                {userInfo?.name || userInfo?.nama || userInfo?.username || 'User'}
              </h1>
              <p className="welcome-subtitle">
                Dashboard E-Learning
              </p>
            </div>
            <div className="welcome-icon">
              <div className="welcome-icon-circle">
                <TrendingUp className="welcome-icon-img" />
              </div>
            </div>
          </div>
          <div className="welcome-decoration">
            <div className="decoration-circle decoration-1"></div>
            <div className="decoration-circle decoration-2"></div>
          </div>
        </section>

        {/* Stats Bento Grid */}
        <section className="stats-grid">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className={`stat-card stat-card-${stat.color}`}
              >
                <div className="stat-content">
                  <div className="stat-info">
                    <p className="stat-title">{stat.title}</p>
                    <p className="stat-value">{stat.value}</p>
                    {stat.trend && (
                      <div className={`stat-trend ${stat.trend === 'up' ? 'trend-up' : 'trend-down'}`}>
                        <TrendingUp className="trend-icon" />
                        <span>{stat.trend === 'up' ? 'Naik' : 'Turun'}</span>
                      </div>
                    )}
                  </div>
                  <div className="stat-icon-wrapper">
                    <Icon className="stat-icon-img" />
                  </div>
                </div>
                <div className="stat-shine"></div>
              </div>
            );
          })}
        </section>

        {/* Recent Presensi Bento Grid */}
        <section className="bento-grid">
          {/* Recent Presensi Table - Large Card */}
          <div className="bento-card bento-card-large">
            <div className="card-header">
              <div className="card-header-left">
                <div className="card-icon-wrapper card-icon-blue">
                  <Calendar className="card-icon" />
                </div>
                <div>
                  <h2 className="card-title">Presensi Terbaru</h2>
                  <p className="card-subtitle">5 presensi terakhir yang dibuat</p>
                </div>
              </div>
              <div className="card-header-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select 
                  className="dashboard-search-input" 
                  style={{ width: 'auto', paddingLeft: '0.875rem' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="Semua">Semua Status</option>
                  <option value="Sempurna">Hadir Sempurna</option>
                  <option value="Ada Alfa">Ada Alfa</option>
                  <option value="< 75%">Kehadiran &lt; 75%</option>
                </select>
                <div className="dashboard-search">
                  <Search className="dashboard-search-icon" />
                  <input
                    type="text"
                    className="dashboard-search-input"
                    placeholder="Cari matkul, kelas, tanggal, dll..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  className="card-action-btn"
                  onClick={() => navigate("/presensi?tab=riwayat")}
                >
                  <span>Lihat Semua</span>
                  <ChevronRight className="btn-icon" />
                </button>
              </div>
            </div>

            {filteredPresensi.length > 0 ? (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mata Kuliah</th>
                      <th>Kelas</th>
                      <th>Minggu</th>
                      <th>Tanggal</th>
                      <th>Hadir</th>
                      <th>Alfa</th>
                      <th>Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPresensi.map((presensi, index) => {
                      const persentaseHadir = presensi.total_mhs > 0
                        ? Math.round((presensi.hadir / presensi.total_mhs) * 100)
                        : 0;

                      return (
                        <tr key={index} className="table-row">
                          <td>
                            <div className="cell-primary">{presensi.nama_mk}</div>
                          </td>
                          <td>
                            <span className="badge badge-outline">{presensi.kelas}</span>
                          </td>
                          <td className="text-center">
                            <span className="week-badge">{presensi.pertemuan_ke}</span>
                          </td>
                          <td className="text-center text-muted">
                            {formatDate(presensi.tanggal)}
                          </td>
                          <td className="text-center">
                            <span className="status-badge status-success">
                              {presensi.hadir}/{presensi.total_mhs}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className="status-badge status-danger">
                              {presensi.alfa}
                            </span>
                          </td>
                          <td>
                            <div className="attendance-cell">
                              <div className="progress-bar">
                                <div
                                  className={`progress-fill ${
                                    persentaseHadir >= 75 ? 'progress-high' :
                                    persentaseHadir >= 50 ? 'progress-medium' : 'progress-low'
                                  }`}
                                  style={{ width: `${persentaseHadir}%` }}
                                ></div>
                              </div>
                              <span className="progress-text">{persentaseHadir}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon-wrapper">
                  <Calendar className="empty-icon" />
                </div>
                <h3 className="empty-title">Belum Ada Presensi</h3>
                <p className="empty-text">
                  Generate presensi pertama Anda untuk mulai tracking kehadiran
                </p>
                <button className="empty-action-btn">
                  <span>Buat Presensi Baru</span>
                  <ChevronRight className="btn-icon" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Stats Card */}
          <div className="bento-card">
            <div className="card-header">
              <div className="card-header-left">
                <div className="card-icon-wrapper card-icon-purple">
                  <BarChart3 className="card-icon" />
                </div>
                <div>
                  <h2 className="card-title">Statistik Cepat</h2>
                  <p className="card-subtitle">Ringkasan mingguan</p>
                </div>
              </div>
            </div>

            <div className="quick-stats">
              <div className="quick-stat-item">
                <div className="quick-stat-header">
                  <Clock className="quick-stat-icon" />
                  <span className="quick-stat-label">Rata-rata Durasi</span>
                </div>
                <p className="quick-stat-value">15 menit</p>
              </div>

              <div className="quick-stat-divider"></div>

              <div className="quick-stat-item">
                <div className="quick-stat-header">
                  <Eye className="quick-stat-icon" />
                  <span className="quick-stat-label">Total View</span>
                </div>
                <p className="quick-stat-value">1,234</p>
              </div>
            </div>

            <div className="mini-chart">
              <div className="mini-chart-header">
                <span className="mini-chart-label">Tren Mingguan</span>
                <span className="mini-chart-badge">+12%</span>
              </div>
              <div className="mini-chart-bars">
                <div className="chart-bar" style={{ height: '40%' }}></div>
                <div className="chart-bar" style={{ height: '60%' }}></div>
                <div className="chart-bar" style={{ height: '45%' }}></div>
                <div className="chart-bar" style={{ height: '80%' }}></div>
                <div className="chart-bar" style={{ height: '70%' }}></div>
                <div className="chart-bar" style={{ height: '90%' }}></div>
                <div className="chart-bar chart-bar-active" style={{ height: '100%' }}></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
