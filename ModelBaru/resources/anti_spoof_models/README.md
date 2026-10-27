# Anti-Spoof Models

Letakkan file .pth MiniFASNet di folder ini.

## File yang dibutuhkan

Download dari: https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/releases

| File | Deskripsi |
|------|-----------|
| 2.7_80x80_MiniFASNetV2.pth   | Model utama (ringan, ~1.6MB) — digunakan default |
| 4_0_0_80x80_MiniFASNetV1SE.pth | Model alternatif dengan SE attention |

## Setup

1. Clone SilentFaceAntiSpoofing di root proyek:
   git clone https://github.com/minivision-ai/Silent-Face-Anti-Spoofing SilentFaceAntiSpoofing

2. Download model files dan letakkan di folder ini (ModelBaru/resources/anti_spoof_models/)

3. Set 'enabled': True di ANTI_SPOOF_CONFIG dalam config.py

4. Gunakan AntiSpoofGuardedSystem sebagai pengganti EnhancedFaceRecognitionSystem:
   from anti_spoof_manager import AntiSpoofManager, AntiSpoofGuardedSystem
   system = AntiSpoofGuardedSystem.create()
