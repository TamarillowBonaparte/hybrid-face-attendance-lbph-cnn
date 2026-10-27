import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "../layouts/dashboardlayout";
import { navigationItems } from "../navigation/navigation";
import {
  MapPin, Plus, Edit2, Trash2, CheckCircle, XCircle, Search,
  Navigation, AlertCircle, X, Save, Eye, ToggleLeft, ToggleRight,
} from "lucide-react";
import {
  getGeolokasiList, createGeolokasi, updateGeolokasi, deleteGeolokasi,
} from "../utils/apiUtils";
import {
  MapContainer, TileLayer, Marker, Circle, Popup, useMapEvents, useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom red marker for selected point
const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

// Component to fly map to position
function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo(position, 17); }, [position, map]);
  return null;
}

// Component to handle map clicks
function MapClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick(e.latlng) });
  return null;
}

const EMPTY_FORM = {
  nama_lokasi: "", deskripsi: "", latitude: "", longitude: "",
  radius_meter: 100, status: "aktif",
};

export default function KelolaGeolokasi() {
  const [activeNav, setActiveNav] = useState("kelola-geolokasi");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [notification, setNotification] = useState({ show: false, type: "", msg: "" });
  const [mapFlyTo, setMapFlyTo] = useState(null);
  const mapRef = useRef(null);

  const notify = useCallback((type, msg) => {
    setNotification({ show: true, type, msg });
    setTimeout(() => setNotification({ show: false, type: "", msg: "" }), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await getGeolokasiList()); }
    catch { notify("error", "Gagal memuat data lokasi"); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const filtered = list.filter(
    (g) => g.nama_lokasi.toLowerCase().includes(search.toLowerCase()) ||
      (g.deskripsi || "").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setForm(EMPTY_FORM); setIsEdit(false); setEditId(null); setShowModal(true);
    setMapFlyTo(null);
  };

  const openEdit = (g) => {
    setForm({
      nama_lokasi: g.nama_lokasi, deskripsi: g.deskripsi || "",
      latitude: g.latitude, longitude: g.longitude,
      radius_meter: g.radius_meter, status: g.status,
    });
    setIsEdit(true); setEditId(g.id_geolokasi); setShowModal(true);
    setMapFlyTo([parseFloat(g.latitude), parseFloat(g.longitude)]);
  };

  const handleMapClick = ({ lat, lng }) => {
    setForm((f) => ({ ...f, latitude: lat.toFixed(7), longitude: lng.toFixed(7) }));
  };

  const detectMyLocation = () => {
    if (!navigator.geolocation) { notify("error", "Browser tidak mendukung geolokasi"); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lat = coords.latitude.toFixed(7);
        const lng = coords.longitude.toFixed(7);
        setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
        setMapFlyTo([parseFloat(lat), parseFloat(lng)]);
      },
      () => notify("error", "Gagal mendeteksi lokasi. Pastikan GPS aktif.")
    );
  };

  const handleSave = async () => {
    if (!form.nama_lokasi || !form.latitude || !form.longitude) {
      notify("error", "Nama lokasi, latitude, dan longitude wajib diisi"); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        radius_meter: parseInt(form.radius_meter),
      };
      if (isEdit) { await updateGeolokasi(editId, payload); notify("success", "Lokasi berhasil diperbarui"); }
      else { await createGeolokasi(payload); notify("success", "Lokasi berhasil ditambahkan"); }
      setShowModal(false); load();
    } catch (e) { notify("error", e.message || "Gagal menyimpan lokasi"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGeolokasi(deleteTarget.id_geolokasi);
      notify("success", `Lokasi "${deleteTarget.nama_lokasi}" dihapus`);
      setDeleteTarget(null); load();
    } catch (e) { notify("error", e.message || "Gagal menghapus lokasi"); setDeleteTarget(null); }
  };

  const toggleStatus = async (g) => {
    try {
      const newStatus = g.status === "aktif" ? "nonaktif" : "aktif";
      await updateGeolokasi(g.id_geolokasi, { status: newStatus });
      notify("success", `Status lokasi diubah ke ${newStatus}`); load();
    } catch (e) { notify("error", "Gagal mengubah status"); }
  };

  const defaultCenter = [-6.2, 106.816];
  const formPos = form.latitude && form.longitude
    ? [parseFloat(form.latitude), parseFloat(form.longitude)] : null;

  return (
    <DashboardLayout navigationItems={navigationItems} activeNav={activeNav} setActiveNav={setActiveNav}>
      {/* Notification */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-[200] animate-slide-in">
          <div className={`px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 text-white ${notification.type === "success" ? "bg-emerald-500" : "bg-red-500"}`}>
            {notification.type === "success" ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            {notification.msg}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-200/50 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <MapPin className="text-indigo-600" /> Kelola Geolokasi Presensi
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                Tentukan lokasi dan radius area yang diizinkan untuk absensi mahasiswa
              </p>
            </div>
            <button onClick={openAdd}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold transition shadow-md hover:shadow-lg">
              <Plus className="h-5 w-5" /> Tambah Lokasi
            </button>
          </div>

          {/* Search */}
          <div className="relative mt-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama lokasi..." type="text"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Lokasi", val: list.length, color: "bg-indigo-50 text-indigo-700" },
            { label: "Aktif", val: list.filter(g => g.status === "aktif").length, color: "bg-emerald-50 text-emerald-700" },
            { label: "Nonaktif", val: list.filter(g => g.status === "nonaktif").length, color: "bg-gray-50 text-gray-500" },
            { label: "Rata-rata Radius", val: list.length ? `${Math.round(list.reduce((a, g) => a + g.radius_meter, 0) / list.length)} m` : "—", color: "bg-blue-50 text-blue-700" },
          ].map((s) => (
            <div key={s.label} className={`${s.color} rounded-xl p-4 border border-white/50`}>
              <div className="text-2xl font-bold">{s.val}</div>
              <div className="text-sm font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* List */}
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-200/50 p-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin h-10 w-10 rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <MapPin className="h-14 w-14 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Belum ada lokasi presensi</p>
              <p className="text-sm mt-1">Klik "Tambah Lokasi" untuk menambahkan lokasi pertama</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((g) => (
                <div key={g.id_geolokasi}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all group">
                  {/* Mini Map Preview */}
                  <div className="h-40 relative z-0">
                    <MapContainer
                      center={[parseFloat(g.latitude), parseFloat(g.longitude)]}
                      zoom={16} scrollWheelZoom={false} zoomControl={false}
                      style={{ height: "100%", width: "100%" }}
                      dragging={false} doubleClickZoom={false} attributionControl={false}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[parseFloat(g.latitude), parseFloat(g.longitude)]} />
                      <Circle
                        center={[parseFloat(g.latitude), parseFloat(g.longitude)]}
                        radius={g.radius_meter}
                        pathOptions={{ color: "#6366f1", fillColor: "#818cf8", fillOpacity: 0.2 }} />
                    </MapContainer>
                    {/* Status badge */}
                    <div className={`absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-xs font-bold ${g.status === "aktif" ? "bg-emerald-500 text-white" : "bg-gray-400 text-white"}`}>
                      {g.status}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 text-base">{g.nama_lokasi}</h3>
                    {g.deskripsi && <p className="text-gray-500 text-sm mt-0.5 line-clamp-1">{g.deskripsi}</p>}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="bg-gray-100 rounded px-2 py-0.5">📍 {parseFloat(g.latitude).toFixed(5)}, {parseFloat(g.longitude).toFixed(5)}</span>
                      <span className="bg-indigo-50 text-indigo-700 rounded px-2 py-0.5 font-semibold">⬤ {g.radius_meter} m</span>
                    </div>
                    {/* Actions */}
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => setViewTarget(g)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 py-1.5 rounded-lg text-xs font-semibold transition">
                        <Eye className="h-3.5 w-3.5" /> Lihat Peta
                      </button>
                      <button onClick={() => openEdit(g)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-1.5 rounded-lg text-xs font-semibold transition">
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button onClick={() => toggleStatus(g)}
                        className={`flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-semibold transition ${g.status === "aktif" ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
                        title={g.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}>
                        {g.status === "aktif" ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      </button>
                      <button onClick={() => setDeleteTarget(g)}
                        className="flex items-center justify-center px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <MapPin className="text-indigo-600" /> {isEdit ? "Edit Lokasi" : "Tambah Lokasi Baru"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Nama */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nama Lokasi <span className="text-red-500">*</span>
                </label>
                <input value={form.nama_lokasi} onChange={(e) => setForm({ ...form, nama_lokasi: e.target.value })}
                  placeholder="Contoh: Gedung A – Lantai 2" type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Deskripsi</label>
                <textarea value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                  placeholder="Keterangan tambahan (opsional)" rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none" />
              </div>

              {/* Koordinat */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Latitude <span className="text-red-500">*</span></label>
                  <input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    placeholder="-6.2000000" type="number" step="0.0000001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Longitude <span className="text-red-500">*</span></label>
                  <input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    placeholder="106.8160000" type="number" step="0.0000001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
              </div>

              {/* Detect Location */}
              <button onClick={detectMyLocation}
                className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-semibold transition border border-blue-200">
                <Navigation className="h-4 w-4" /> Gunakan Lokasi Saya Sekarang
              </button>

              {/* Radius */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Radius Presensi: <span className="text-indigo-600 font-bold">{form.radius_meter} meter</span>
                </label>
                <input type="range" min={10} max={1000} step={10}
                  value={form.radius_meter}
                  onChange={(e) => setForm({ ...form, radius_meter: parseInt(e.target.value) })}
                  className="w-full accent-indigo-600" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>10 m</span><span>500 m</span><span>1000 m</span>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm">
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </div>

              {/* Interactive Map */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🗺️ Pilih Lokasi di Peta <span className="text-gray-400 font-normal">(klik untuk menentukan titik)</span>
                </label>
                <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 280 }}>
                  <MapContainer
                    center={formPos || defaultCenter} zoom={15}
                    style={{ height: "100%", width: "100%" }}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
                    <MapClickHandler onClick={handleMapClick} />
                    {mapFlyTo && <FlyTo position={mapFlyTo} />}
                    {formPos && (
                      <>
                        <Marker position={formPos} icon={redIcon}>
                          <Popup>Titik Presensi</Popup>
                        </Marker>
                        <Circle center={formPos} radius={form.radius_meter}
                          pathOptions={{ color: "#6366f1", fillColor: "#818cf8", fillOpacity: 0.25 }} />
                      </>
                    )}
                  </MapContainer>
                </div>
                <p className="text-xs text-gray-400 mt-1 text-center">
                  Klik di peta untuk menentukan koordinat secara visual
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold transition">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold transition disabled:opacity-60">
                {saving ? <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Lokasi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Map Modal */}
      {viewTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <MapPin className="text-indigo-600 h-5 w-5" /> {viewTarget.nama_lokasi}
              </h3>
              <button onClick={() => setViewTarget(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div style={{ height: 380 }}>
              <MapContainer
                center={[parseFloat(viewTarget.latitude), parseFloat(viewTarget.longitude)]}
                zoom={17} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
                <Marker position={[parseFloat(viewTarget.latitude), parseFloat(viewTarget.longitude)]}>
                  <Popup>{viewTarget.nama_lokasi}<br />Radius: {viewTarget.radius_meter} m</Popup>
                </Marker>
                <Circle
                  center={[parseFloat(viewTarget.latitude), parseFloat(viewTarget.longitude)]}
                  radius={viewTarget.radius_meter}
                  pathOptions={{ color: "#6366f1", fillColor: "#818cf8", fillOpacity: 0.3 }} />
              </MapContainer>
            </div>
            <div className="p-4 bg-gray-50 grid grid-cols-3 gap-3 text-sm text-center">
              <div><span className="text-gray-500 block">Latitude</span><strong>{parseFloat(viewTarget.latitude).toFixed(6)}</strong></div>
              <div><span className="text-gray-500 block">Longitude</span><strong>{parseFloat(viewTarget.longitude).toFixed(6)}</strong></div>
              <div><span className="text-gray-500 block">Radius</span><strong>{viewTarget.radius_meter} m</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-center text-gray-900 mb-1">Hapus Lokasi?</h2>
            <p className="text-center text-gray-500 text-sm mb-4">
              Lokasi <strong>"{deleteTarget.nama_lokasi}"</strong> akan dihapus permanen.
              Pertemuan yang menggunakan lokasi ini harus diubah terlebih dahulu.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl font-semibold transition">
                Batal
              </button>
              <button onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl font-semibold transition">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
