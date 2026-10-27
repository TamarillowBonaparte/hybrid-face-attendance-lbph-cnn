// utils/apiUtils.js

import { getToken, isTokenExpired, forceLogout } from './auth';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();

  // Check token expiry before sending request
  if (token && isTokenExpired()) {
    forceLogout();
    throw new Error('Sesi telah berakhir, silakan login kembali');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Remove Content-Type if it's FormData to let browser set boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized — session expired or invalid token
    if (response.status === 401) {
      forceLogout();
      throw new Error('Sesi telah berakhir, silakan login kembali');
    }

    if (!response.ok) {
        let errorData = {};
        try { errorData = await response.json(); } catch(e) {}
        throw new Error(errorData.detail || `API request failed (${response.status})`);
    }
    
    if (response.status === 204) {
        return null;
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const apiGet = (endpoint) => apiRequest(endpoint, { method: 'GET' });
export const apiPost = (endpoint, data) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(data) });
export const apiPut = (endpoint, data) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(data) });
export const apiDelete = (endpoint) => apiRequest(endpoint, { method: 'DELETE' });
export const apiUpload = (endpoint, formData, method = 'POST') => apiRequest(endpoint, { method, body: formData });

// ===== AUTH =====
export const login = async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
    });
    if (!response.ok) {
        const error = await response.json().catch(()=>({}));
        throw new Error(error.detail || 'Login gagal');
    }
    return await response.json();
};

// ===== DASHBOARD =====
export const getDashboardData = () => apiGet('/dashboard/');

// ===== MATA KULIAH (backend: /matakuliah/) =====
export const getMataKuliahList = () => apiGet('/matakuliah/');
export const getMataKuliahById = (id) => apiGet(`/matakuliah/${id}`);
export const createMataKuliah = (data) => apiPost('/matakuliah/', data);
export const updateMataKuliah = (id, data) => apiPut(`/matakuliah/${id}`, data);
export const deleteMataKuliah = (id) => apiDelete(`/matakuliah/${id}`);

// ===== KELAS MATA KULIAH (composite via Jadwal / compat_routes) =====
export const getKelasMKList = () => apiGet('/kelas-mata-kuliah/');
export const getKelasMKById = (id) => apiGet(`/kelas-mata-kuliah/${id}`);
export const getKelasMKByDosen = (id_dosen) => apiGet(`/kelas-mata-kuliah/dosen/${id_dosen}`);
export const getKelasMKMe = () => apiGet('/kelas-mata-kuliah/me');
export const updateKelasMK = (id, data) => apiPut(`/kelas-mata-kuliah/${id}`, data);
export const deleteKelasMK = (id) => apiDelete(`/kelas-mata-kuliah/${id}`);

// ===== KELAS (standalone) =====
export const getKelasList = (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/kelas/${query ? '?' + query : ''}`);
};
export const getKelasById = (id) => apiGet(`/kelas/${id}`);
export const createKelas = (data) => apiPost('/kelas/', data);
export const updateKelas = (id, data) => apiPut(`/kelas/${id}`, data);
export const deleteKelas = (id) => apiDelete(`/kelas/${id}`);

// ===== DOSEN =====
export const getDosenList = () => apiGet('/dosen/');
export const getDosenById = (id) => apiGet(`/dosen/${id}`);
export const createDosen = (data) => apiPost('/dosen/', data);
export const updateDosen = (id, data) => apiPut(`/dosen/${id}`, data);
export const deleteDosen = (id) => apiDelete(`/dosen/${id}`);

// ===== MAHASISWA =====
export const getMahasiswaList = (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/mahasiswa/${query ? '?' + query : ''}`);
};
export const getMahasiswaById = (id) => apiGet(`/mahasiswa/${id}`);
export const createMahasiswa = (data) => apiPost('/mahasiswa/', data);
export const bulkCreateMahasiswa = (data) => apiPost('/mahasiswa/bulk', data);
export const updateMahasiswa = (id, data) => apiPut(`/mahasiswa/${id}`, data);
export const deleteMahasiswa = (id) => apiDelete(`/mahasiswa/${id}`);
export const bulkDeleteMahasiswa = (data) => apiPost('/mahasiswa/bulk-delete', data);

// ===== USER (composite - backend compat_routes) =====
export const getUserList = () => apiGet('/users/');
export const getUserById = (id) => apiGet(`/users/${id}`);
export const createUser = (data) => apiPost('/users/', data);
export const updateUser = (id, data) => apiPut(`/users/${id}`, data);
export const deleteUser = (id) => apiDelete(`/users/${id}`);

// ===== JADWAL KULIAH =====
export const getJadwalKuliahList = (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/jadwal/${query ? '?' + query : ''}`);
};
export const getJadwalKuliahById = (id) => apiGet(`/jadwal/${id}`);
export const createJadwalKuliah = (data) => apiPost('/jadwal/', data);
export const createJadwalFromMatakuliah = (data) => apiPost('/jadwal/from-matakuliah', data);
export const updateJadwalKuliah = (id, data) => apiPut(`/jadwal/${id}`, data);
export const deleteJadwalKuliah = (id) => apiDelete(`/jadwal/${id}`);


// ===== PERTEMUAN =====
export const getPertemuanList = (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/pertemuan/${query ? '?' + query : ''}`);
};
export const getPertemuanById = (id) => apiGet(`/pertemuan/${id}`);
export const createPertemuan = (data) => apiPost('/pertemuan/', data);
export const updatePertemuan = (id, data) => apiPut(`/pertemuan/${id}`, data);
export const deletePertemuan = (id) => apiDelete(`/pertemuan/${id}`);
export const mulaiPertemuan = (id, durasi = 15) => apiPost(`/pertemuan/${id}/mulai?durasi_menit=${durasi}`, {});
export const selesaiPertemuan = (id) => apiPost(`/pertemuan/${id}/selesai`, {});
export const batalkanPertemuan = (id) => apiPost(`/pertemuan/${id}/batalkan`, {});

// ===== PRESENSI =====
export const getPresensiList = (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/presensi/${query ? '?' + query : ''}`);
};
export const getPresensiById = (id) => apiGet(`/presensi/${id}`);
export const createPresensiManual = (data) => apiPost('/presensi/', data);
export const updatePresensi = (id, data) => apiPut(`/presensi/${id}`, data);
export const deletePresensi = (id) => apiDelete(`/presensi/${id}`);
export const absensiFaceRecognition = (data) => apiPost('/presensi/face-recognition', data);
export const getRekapPertemuan = (pertemuan_id) => apiGet(`/presensi/rekap/pertemuan/${pertemuan_id}`);
export const getRekapMahasiswa = (mahasiswa_id, jadwal_id) => apiGet(`/presensi/rekap/mahasiswa/${mahasiswa_id}/jadwal/${jadwal_id}`);

// ===== DATASET WAJAH =====
export const getDatasetWajahList = (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/dataset-wajah/${query ? '?' + query : ''}`);
};
export const uploadDatasetWajah = (mahasiswa_id, formData) => apiUpload(`/dataset-wajah/upload/${mahasiswa_id}`, formData);
export const getDatasetCount = (mahasiswa_id) => apiGet(`/dataset-wajah/mahasiswa/${mahasiswa_id}/count`);

// ===== REGISTRASI WAJAH =====
export const getRegistrasiList = () => apiGet('/registrasi-wajah/');
export const createRegistrasi = (data) => apiPost('/registrasi-wajah/', data);

// ===== LOG DETEKSI =====
export const getLogDeteksiList = () => apiGet('/log-deteksi/');
export const getStatistikLog = () => apiGet('/log-deteksi/statistik');

// ===== MASTER DATA =====
export const getProdiList = () => apiGet('/prodi/');
export const createProdi = (data) => apiPost('/prodi/', data);
export const updateProdi = (id, data) => apiPut(`/prodi/${id}`, data);
export const deleteProdi = (id) => apiDelete(`/prodi/${id}`);

export const getAngkatanList = () => apiGet('/angkatan/');
export const createAngkatan = (data) => apiPost('/angkatan/', data);
export const updateAngkatan = (id, data) => apiPut(`/angkatan/${id}`, data);
export const deleteAngkatan = (id) => apiDelete(`/angkatan/${id}`);

export const getGolonganList = () => apiGet('/golongan/');
export const createGolongan = (data) => apiPost('/golongan/', data);
export const updateGolongan = (id, data) => apiPut(`/golongan/${id}`, data);
export const deleteGolongan = (id) => apiDelete(`/golongan/${id}`);

// ===== PROFIL =====
export const getProfilSaya = () => apiGet('/auth/me');
export const updateProfilSaya = (data) => apiPut('/auth/me', data);
export const changePassword = (data) => apiPost('/auth/change-password', data);

// ===== PENAWARAN MATA KULIAH =====
export const getPenawaranMKList = (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/penawaran-matakuliah/${query ? '?' + query : ''}`);
};
export const getPenawaranMKById = (id) => apiGet(`/penawaran-matakuliah/${id}`);
export const createPenawaranMK = (data) => apiPost('/penawaran-matakuliah/', data);
export const updatePenawaranMK = (id, data) => apiPut(`/penawaran-matakuliah/${id}`, data);
export const deletePenawaranMK = (id) => apiDelete(`/penawaran-matakuliah/${id}`);

// ===== PENAWARAN KELAS =====
export const getKelasByPenawaran = (id_penawaran) => apiGet(`/penawaran-kelas/penawaran/${id_penawaran}`);
export const addKelasToPenawaran = (data) => {
  // Jika data berisi id_kelas langsung, gunakan endpoint from-kelas
  if (data.id_kelas) {
    return apiPost('/penawaran-kelas/from-kelas', { id_penawaran: data.id_penawaran, id_kelas: data.id_kelas });
  }
  return apiPost('/penawaran-kelas/', data);
};
export const removeKelasFromPenawaran = (kelas_id) => apiDelete(`/penawaran-kelas/${kelas_id}`);

// ===== PENGAJAR =====
export const getPengajarByPenawaran = (id_penawaran) => apiGet(`/pengajar/penawaran/${id_penawaran}`);
export const addPengajar = (data) => apiPost('/pengajar/', data);
export const updatePengajarRole = (pengajar_id, data) => apiPut(`/pengajar/${pengajar_id}`, data);
export const removePengajar = (pengajar_id) => apiDelete(`/pengajar/${pengajar_id}`);

// ===== PENGAJAR PERTEMUAN =====
export const getPengajarPertemuan = (id_pertemuan) => apiGet(`/pengajar-pertemuan/pertemuan/${id_pertemuan}`);
export const addPengajarPertemuan = (data) => apiPost('/pengajar-pertemuan/', data);
export const removePengajarPertemuan = (id) => apiDelete(`/pengajar-pertemuan/${id}`);

// ===== GEOLOKASI =====
export const getGeolokasiList = (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiGet(`/geolokasi/${query ? '?' + query : ''}`);
};
export const getGeolokasiById = (id) => apiGet(`/geolokasi/${id}`);
export const createGeolokasi = (data) => apiPost('/geolokasi/', data);
export const updateGeolokasi = (id, data) => apiPut(`/geolokasi/${id}`, data);
export const deleteGeolokasi = (id) => apiDelete(`/geolokasi/${id}`);