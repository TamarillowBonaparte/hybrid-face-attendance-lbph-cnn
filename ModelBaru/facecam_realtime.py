"""
Realtime Facecam Testing Tool (Enhanced)
=========================================
Menampilkan facecam live dengan info lengkap:
- Identitas (NIM)
- Fused similarity %
- CNN score & LBPH score
- Quality score
- FPS & threshold
- Akurasi keseluruhan (frame counter)

Tekan 'q' untuk keluar, 's' untuk screenshot.
"""

import cv2
import time
import numpy as np
from datetime import datetime
from enhanced_system import EnhancedFaceRecognitionSystem


# ── Konfigurasi tampilan ─────────────────────────────────────────────────────
FONT       = cv2.FONT_HERSHEY_SIMPLEX
FONT_SMALL = 0.50
FONT_MED   = 0.62
THICK      = 2

GREEN  = (50, 205, 50)
RED    = (60, 60, 220)
WHITE  = (255, 255, 255)
BLACK  = (0, 0, 0)
GRAY   = (130, 130, 130)


def draw_panel(frame, lines, x, y, line_h=22, bg_alpha=0.6):
    """Draw semi-transparent info panel."""
    if not lines:
        return
    max_w = max(cv2.getTextSize(l, FONT, FONT_SMALL, 1)[0][0] for l in lines)
    pw = max_w + 16
    ph = len(lines) * line_h + 12
    overlay = frame.copy()
    cv2.rectangle(overlay, (x, y), (x + pw, y + ph), (20, 20, 20), -1)
    cv2.addWeighted(overlay, bg_alpha, frame, 1 - bg_alpha, 0, frame)
    for i, line in enumerate(lines):
        cv2.putText(frame, line,
                    (x + 8, y + 12 + (i + 1) * line_h),
                    FONT, FONT_SMALL, WHITE, 1, cv2.LINE_AA)


def draw_bar(frame, x, y, w, h, pct, color):
    """Draw horizontal progress bar (0.0-1.0)."""
    cv2.rectangle(frame, (x, y), (x + w, y + h), (50, 50, 50), -1)
    fill = int(w * max(0.0, min(1.0, pct)))
    if fill > 0:
        cv2.rectangle(frame, (x, y), (x + fill, y + h), color, -1)
    cv2.rectangle(frame, (x, y), (x + w, y + h), GRAY, 1)


def main():
    print("=" * 55)
    print("  Realtime Webcam Face Recognition (Post-Fix)")
    print("=" * 55)
    print("Menginisialisasi sistem...")

    system = EnhancedFaceRecognitionSystem()
    gallery_size = system.get_gallery_size()
    threshold    = system.calibrator.get_threshold()

    print(f"  Identitas di gallery : {gallery_size}")
    print(f"  Threshold            : {threshold:.4f}")
    print("  Tekan 'q' = keluar | 's' = screenshot")
    print("=" * 55)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Webcam tidak ditemukan / tidak bisa dibuka.")
        return

    fps_buf          = []
    last_t           = time.time()
    total_detect     = 0
    recognized_cnt   = 0
    unrecognized_cnt = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # ── FPS ──────────────────────────────────────────────────────────
        now = time.time()
        fps_buf.append(1.0 / max(now - last_t, 1e-6))
        if len(fps_buf) > 10:
            fps_buf.pop(0)
        fps    = sum(fps_buf) / len(fps_buf)
        last_t = now

        fH, fW = frame.shape[:2]

        # ── Deteksi & preprocess ─────────────────────────────────────────
        preproc = system.preprocessor.detect_and_preprocess(
            frame, for_enrollment=False)

        if preproc['face'] is not None and preproc.get('bbox') is not None:
            x, y, w, h = preproc['bbox']
            aligned = preproc['aligned_face']
            face_img = aligned if aligned is not None else preproc['face']
            quality    = preproc['quality']
            q_score    = quality['quality_score'] if quality else 0.5

            # ── Feature extraction ────────────────────────────────────────
            lbph, cnn = system._extract_features(face_img)
            lbph = lbph / (lbph.sum() + 1e-7)
            cnn  = cnn  / (np.linalg.norm(cnn) + 1e-7)

            # ── Gallery matching ──────────────────────────────────────────
            rec = system.gallery.recognize(
                cnn, lbph,
                quality_score=q_score,
                threshold=threshold,
                update_template=False
            )

            fused  = rec.similarity
            cnn_s  = getattr(rec, 'cnn_similarity',  fused)
            lbph_s = getattr(rec, 'lbph_similarity', fused)

            total_detect += 1
            if rec.is_recognized:
                recognized_cnt += 1
                color    = GREEN
                id_label = rec.nim
                pct_txt  = f"{fused*100:.1f}%"
            else:
                unrecognized_cnt += 1
                color = RED
                if rec.top_k_results:
                    top      = rec.top_k_results[0]
                    id_label = f"Unknown ~{top['nim']}"
                    pct_txt  = f"{top['fused']*100:.1f}%"
                else:
                    id_label = "Unknown"
                    pct_txt  = "0.0%"

            # ── Bounding box + header ─────────────────────────────────────
            cv2.rectangle(frame, (x, y), (x+w, y+h), color, THICK)
            (lw, _), _ = cv2.getTextSize(id_label, FONT, FONT_MED, THICK)
            hdr_y = max(0, y - 30)
            cv2.rectangle(frame, (x, hdr_y), (x + lw + 10, y), color, -1)
            cv2.putText(frame, id_label,
                        (x + 5, max(14, y - 8)),
                        FONT, FONT_MED, BLACK, THICK, cv2.LINE_AA)

            # ── Score bars bawah kotak ────────────────────────────────────
            bar_w  = min(w, 180)
            bar_x  = x
            bar_y0 = y + h + 6
            if bar_y0 + 50 < fH:
                labels = [
                    (f"Fused {fused*100:.0f}%",  fused,  color),
                    (f"CNN   {cnn_s*100:.0f}%",   cnn_s,  (0, 200, 255)),
                    (f"LBPH  {lbph_s*100:.0f}%",  lbph_s, (200, 160, 60)),
                ]
                for i, (lbl, val, col) in enumerate(labels):
                    by = bar_y0 + i * 16
                    if by + 12 < fH:
                        draw_bar(frame, bar_x, by, bar_w, 10, val, col)
                        cv2.putText(frame, lbl, (bar_x + bar_w + 6, by + 9),
                                    FONT, 0.42, col, 1, cv2.LINE_AA)

            # ── Detail panel kanan ────────────────────────────────────────
            px = min(x + w + 8, fW - 210)
            detail = [
                f"Status : {'DIKENAL' if rec.is_recognized else 'ASING'}",
                f"Fused  : {fused*100:.1f}%",
                f"CNN    : {cnn_s*100:.1f}%",
                f"LBPH   : {lbph_s*100:.1f}%",
                f"Quality: {q_score*100:.0f}%",
                f"Thresh : {threshold*100:.1f}%",
            ]
            draw_panel(frame, detail, px, y)

        # ── Header atas ───────────────────────────────────────────────────
        acc_pct = (recognized_cnt / total_detect * 100) if total_detect > 0 else 0.0
        header = [
            f"FPS     : {fps:.1f}",
            f"Gallery : {gallery_size} identitas",
            f"Terdeteksi: {total_detect}  Dikenal: {recognized_cnt}",
            f"Akurasi  : {acc_pct:.1f}%",
        ]
        draw_panel(frame, header, 8, 8)

        # ── Footer ───────────────────────────────────────────────────────
        cv2.putText(frame, "q=Keluar  s=Screenshot",
                    (8, fH - 8), FONT, FONT_SMALL, GRAY, 1, cv2.LINE_AA)

        cv2.imshow("Realtime Face Recognition [Post-Fix]", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('s'):
            ts    = datetime.now().strftime("%Y%m%d_%H%M%S")
            fname = f"screenshot_{ts}.jpg"
            cv2.imwrite(fname, frame)
            print(f"[Screenshot] {fname}")

    cap.release()
    cv2.destroyAllWindows()

    # ── Laporan akhir ─────────────────────────────────────────────────────────
    print("\n" + "=" * 55)
    print("  HASIL WEBCAM TEST")
    print("=" * 55)
    print(f"  Frame wajah terdeteksi : {total_detect}")
    print(f"  Dikenal                : {recognized_cnt}")
    print(f"  Tidak dikenal          : {unrecognized_cnt}")
    if total_detect > 0:
        print(f"  Akurasi (frame-level)  : {recognized_cnt/total_detect*100:.1f}%")
    print("=" * 55)


if __name__ == "__main__":
    main()

