// --- KONFIGURASI ---
// URL Web App GAS Anda sudah terpasang di bawah ini
const GAS_URL_SCANNER = "https://script.google.com/macros/s/AKfycbw7Bt6wod-wkfzepfVUGkCswt1JBUDmMc_vhMwwSjUkD0OflKLt-dFatwzwi_cbIcDi/exec";

// --- REFERENSI ELEMEN DOM ---
const btnStartScan = document.getElementById('btnStartScan');
const btnStopScan = document.getElementById('btnStopScan');
const scanResultCard = document.getElementById('scanResult');
const resultText = document.getElementById('resultText');
const audioSuccess = document.getElementById('audioSuccess');
const inputBawaan = document.getElementById('inputBawaan'); // Tambahan referensi untuk dropdown bawaan

// --- VARIABEL SCANNER ---
let html5QrCode;
let isScanning = false;
let isProcessing = false; // Flag untuk mencegah scan beruntun (spam)

// --- FUNGSI NOTIFIKASI TOAST (Khusus Scanner) ---
function showScannerToast(message, type) {
    const toastEl = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMessage');
    
    toastMsg.textContent = message;
    toastEl.className = 'toast'; 
    toastEl.classList.add('show', type); 

    setTimeout(() => {
        toastEl.classList.remove('show');
    }, 4000);
}

// --- INISIALISASI SCANNER ---
// Menggunakan div dengan id="reader" dari HTML
html5QrCode = new Html5Qrcode("reader");

// --- EVENT LISTENER TOMBOL KAMERA ---
btnStartScan.addEventListener('click', () => {
    // Memulai kamera belakang (environment) secara default
    html5QrCode.start(
        { facingMode: "environment" }, 
        {
            fps: 10,    // Memindai 10 frame per detik
            qrbox: { width: 250, height: 250 } // Area kotak scan
        },
        onScanSuccess,
        onScanFailure
    ).then(() => {
        isScanning = true;
        btnStartScan.classList.add('hidden');
        btnStopScan.classList.remove('hidden');
    }).catch((err) => {
        console.error("Gagal memulai kamera", err);
        showScannerToast('Gagal mengakses kamera. Pastikan izin kamera diberikan.', 'error');
    });
});

btnStopScan.addEventListener('click', stopScanning);

function stopScanning() {
    if (isScanning) {
        html5QrCode.stop().then(() => {
            isScanning = false;
            btnStartScan.classList.remove('hidden');
            btnStopScan.classList.add('hidden');
            
            // Reset tampilan hasil
            setTimeout(() => {
                scanResultCard.classList.add('hidden');
            }, 1000);
        }).catch((err) => {
            console.error("Gagal menghentikan kamera", err);
        });
    }
}

// --- LOGIKA KETIKA QR BERHASIL DISCAN ---
async function onScanSuccess(decodedText, decodedResult) {
    // Jika sistem sedang memproses scan sebelumnya, abaikan frame ini
    if (isProcessing) return;
    
    isProcessing = true; // Kunci proses (Cooldown)
    
    try {
        // 1. Putar Suara Notifikasi MP3
        // Gunakan .catch untuk menghindari error browser autoplay policy
        audioSuccess.play().catch(e => console.log("Audio tertahan oleh browser:", e));

        // 2. Parsing Data QR Code (Karena di backend kita menyimpannya sebagai JSON)
        const studentData = JSON.parse(decodedText);
        
        // AMBIL DATA BAWAAN (Misting / Tumbler)
        const bawaanSiswa = inputBawaan ? inputBawaan.value : "-";

        // 3. Tampilkan UI Loading Sementara
        scanResultCard.classList.remove('hidden');
        resultText.innerHTML = `Mencatat kehadiran untuk: <b>${studentData.nama}</b>... <span class="spinner" style="border-top-color: var(--primary); display:inline-block; vertical-align:middle; width:15px; height:15px;"></span>`;

        // 4. Siapkan Data untuk dikirim ke Google Sheets
        const payload = {
            action: "scan",
            nisn: studentData.nisn,
            nama: studentData.nama,
            kelas: studentData.kelas,
            gmail: studentData.gmail,
            bawaan: bawaanSiswa // Data ini sekarang ikut terkirim ke backend
        };

        // 5. Fetch API ke Backend
        const response = await fetch(GAS_URL_SCANNER, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            }
        });

        const result = await response.json();

        // 6. Tanggapan dari Server
        if (result.status === 'success') {
            showScannerToast(`Berhasil mencatat ${studentData.nama}`, 'success');
            // Update UI agar menampilkan barang bawaan
            resultText.innerHTML = `✅ <b>${studentData.nama}</b> (${studentData.kelas})<br><span style="color:var(--text-light); font-size:12px;">Bawaan: ${bawaanSiswa}</span>`;
        } else {
            // Ini akan muncul jika terdeteksi scan ke-2 kalinya di hari yang sama
            showScannerToast('Gagal: ' + result.message, 'error');
            resultText.innerHTML = `❌ <b>${studentData.nama}</b><br><span style="color:var(--error); font-size:13px;">${result.message}</span>`;
        }

    } catch (error) {
        console.error('Scan Error:', error);
        
        // Deteksi jika QR Code yang discan bukan format JSON dari sistem kita
        if (error instanceof SyntaxError) {
            showScannerToast('QR Code tidak valid atau bukan dari sistem ini!', 'error');
            resultText.innerHTML = `❌ Format QR Code salah.`;
        } else {
            showScannerToast('Terjadi kesalahan jaringan atau server.', 'error');
        }
    } finally {
        // Cooldown 3 detik sebelum kamera bisa menerima pemindaian baru
        // Mencegah 1 QR code terinput puluhan kali ke Spreadsheet
        setTimeout(() => {
            isProcessing = false;
        }, 3000);
    }
}

// --- LOGIKA KETIKA FRAME TIDAK MENEMUKAN QR ---
function onScanFailure(error) {
    // Fungsi ini terpanggil terus menerus setiap frame saat kamera nyala dan belum menemukan QR
    // Dibiarkan kosong agar console tidak penuh dengan log error
}
