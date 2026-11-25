import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type Content,
  type FunctionDeclaration,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inisialisasi klien Gemini di sisi server agar kredensial tidak pernah terekspos ke browser
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Deklarasi tool / function calling MARVIS agar perintah pengguna benar-benar dieksekusi di UI
const marvisTools: FunctionDeclaration[] = [
  {
    name: 'ganti_tema',
    description:
      'Mengubah warna tema antarmuka MARVIS, avatar 3D, partikel, dan glow. Mendukung preset (biru, merah, hijau, ungu, emas, pink, cyan, oranye, neon, monokrom/hitam putih) atau warna bebas/kode hex.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        warna: {
          type: Type.STRING,
          description:
            'Nama warna (contoh: merah, biru, hijau, ungu, emas, pink, cyan, oranye, tosca, hitam putih, neon) atau kode hex seperti #ff5500.',
        },
        hex: {
          type: Type.STRING,
          description:
            'Kode warna hex 6 digit hasil konversi jika pengguna menyebut warna bebas (contoh: #14b8a6 untuk tosca).',
        },
      },
      required: ['warna'],
    },
  },
  {
    name: 'buka_jurnal',
    description:
      'Mencari dan membuka jurnal ilmiah dari OpenAlex/Crossref pada rentang tahun 2020 hingga 2026.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        kata_kunci: {
          type: Type.STRING,
          description: 'Topik atau kata kunci penelitian yang dicari.',
        },
        tahun_awal: {
          type: Type.INTEGER,
          description: 'Tahun publikasi awal antara 2020 sampai 2026.',
        },
        tahun_akhir: {
          type: Type.INTEGER,
          description: 'Tahun publikasi akhir antara 2020 sampai 2026.',
        },
      },
      required: ['kata_kunci'],
    },
  },
  {
    name: 'buka_widget',
    description: 'Menampilkan kembali widget dashboard yang sedang disembunyikan atau membuka tab terkait.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        nama_widget: {
          type: Type.STRING,
          description:
            'ID widget: greeting, ai-tools, shortcuts, avatar-chat, weather, insights, schedule, devices, trending, journal.',
        },
      },
      required: ['nama_widget'],
    },
  },
  {
    name: 'sembunyikan_widget',
    description: 'Menyembunyikan widget tertentu dari dashboard.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        nama_widget: {
          type: Type.STRING,
          description:
            'ID widget: greeting, ai-tools, shortcuts, weather, insights, schedule, devices, trending, journal.',
        },
      },
      required: ['nama_widget'],
    },
  },
  {
    name: 'reset_layout',
    description: 'Mengembalikan urutan dan visibilitas seluruh kartu widget dashboard ke posisi awal.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        konfirmasi: {
          type: Type.BOOLEAN,
          description: 'Set true untuk mengeksekusi reset layout.',
        },
      },
    },
  },
  {
    name: 'set_pengingat',
    description: 'Menambahkan pengingat penting ke daftar Jadwal Hari Ini.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        judul: {
          type: Type.STRING,
          description: 'Isi pengingat yang diminta pengguna.',
        },
        waktu: {
          type: Type.STRING,
          description: 'Waktu pengingat dalam format HH:MM (contoh: 15:30).',
        },
      },
      required: ['judul', 'waktu'],
    },
  },
  {
    name: 'tambah_jadwal',
    description: 'Menambahkan agenda baru ke widget Jadwal Hari Ini.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        judul: {
          type: Type.STRING,
          description: 'Nama kegiatan atau rapat.',
        },
        waktu: {
          type: Type.STRING,
          description: 'Jam pelaksanaan format HH:MM (contoh: 14:00).',
        },
        kategori: {
          type: Type.STRING,
          description: 'Kategori singkat seperti Rapat, Fokus, Kuliah, atau Pribadi.',
        },
      },
      required: ['judul', 'waktu'],
    },
  },
  {
    name: 'cek_cuaca',
    description: 'Memeriksa cuaca real-time untuk kota tertentu melalui Open-Meteo API.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        kota: {
          type: Type.STRING,
          description: 'Nama kota (contoh: Jakarta, Bandung, Surabaya, Yogyakarta).',
        },
      },
      required: ['kota'],
    },
  },
  {
    name: 'ubah_volume',
    description: 'Mengatur volume suara bicara MARVIS antara 0 sampai 100 persen.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        volume: {
          type: Type.NUMBER,
          description: 'Level volume 0 hingga 100.',
        },
      },
      required: ['volume'],
    },
  },
  {
    name: 'ubah_kecepatan_bicara',
    description: 'Mengatur kecepatan bicara TTS MARVIS antara 0.6 hingga 1.6.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        kecepatan: {
          type: Type.NUMBER,
          description: 'Rate bicara, default 1.0 (rentang 0.6 sampai 1.6).',
        },
      },
      required: ['kecepatan'],
    },
  },
  {
    name: 'ganti_suara',
    description: 'Mengganti profil suara TTS MARVIS berdasarkan nama atau preferensi (pria/wanita/default).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        preferensi: {
          type: Type.STRING,
          description: 'Nama suara atau preferensi seperti pria, berat, santai, atau nama voice browser.',
        },
      },
      required: ['preferensi'],
    },
  },
];

const MARVIS_SYSTEM_INSTRUCTION = `Kamu adalah MARVIS, asisten AI futuristik pribadi milik Alfath.
Kepribadian:
- Santai, gaul, cerdas, dan tetap sopan. Panggil pengguna dengan sebutan "bang".
- Paham bahasa Indonesia sehari-hari, bahasa gaul/slang, dan campuran Inggris-Indonesia.
- Untuk percakapan biasa atau mode suara, jawab ringkas dalam 1 sampai 3 kalimat yang padat, hangat, dan langsung ke inti — KECUALI pengguna meminta penjelasan detail, ringkasan jurnal, tulisan panjang, analisis, atau kode.
- Jika pengguna meminta aksi sistem (ganti tema warna, cari jurnal, cek cuaca, tambah jadwal, set pengingat, tampilkan/sembunyikan widget, reset layout, atur volume/kecepatan/suara), WAJIB panggil tool/function yang sesuai!
- Jika pengguna menyebut warna bebas (misalnya "tosca", "ungu pastel", "biru laut", atau "#ff5500"), isi argumen "hex" dengan kode hex 6 digit yang paling akurat.
- Jangan menulis markdown berlebihan yang mengganggu pembacaan suara jika pengguna sedang dalam mode suara. Hindari emoji berlebihan.`;

interface ChatMessageInput {
  role: 'user' | 'assistant';
  text: string;
}

interface ActionItem {
  name: string;
  args: Record<string, unknown>;
}

function buildActionConfirmation(actions: ActionItem[]): string {
  const parts: string[] = [];
  for (const act of actions) {
    const a = act.args ?? {};
    switch (act.name) {
      case 'ganti_tema':
        parts.push(`Siap bang, tema langsung diganti ke ${String(a.warna ?? 'pilihan baru')}.`);
        break;
      case 'buka_jurnal':
        parts.push(
          `Oke bang, aku lagi cari jurnal soal "${String(a.kata_kunci ?? '')}" tahun ${a.tahun_awal ?? 2020} sampai ${a.tahun_akhir ?? 2026}.`,
        );
        break;
      case 'cek_cuaca':
        parts.push(`Bentar bang, aku cek cuaca terbaru di ${String(a.kota ?? 'Jakarta')} sekarang.`);
        break;
      case 'tambah_jadwal':
        parts.push(
          `Beres bang, jadwal "${String(a.judul ?? 'Agenda')}" jam ${String(a.waktu ?? '')} udah masuk daftar hari ini.`,
        );
        break;
      case 'set_pengingat':
        parts.push(
          `Siap bang, pengingat "${String(a.judul ?? '')}" untuk jam ${String(a.waktu ?? '')} udah aku pasang.`,
        );
        break;
      case 'reset_layout':
        parts.push('Layout dashboard udah aku balikin rapi ke posisi awal, bang.');
        break;
      case 'buka_widget':
        parts.push(`Widget ${String(a.nama_widget ?? '')} udah aku munculin lagi, bang.`);
        break;
      case 'sembunyikan_widget':
        parts.push(`Widget ${String(a.nama_widget ?? '')} udah aku sembunyiin biar makin lega, bang.`);
        break;
      case 'ubah_volume':
        parts.push(`Volume suaraku udah diatur ke ${String(a.volume ?? 100)} persen, bang.`);
        break;
      case 'ubah_kecepatan_bicara':
        parts.push(`Kecepatan bicaraku udah diubah ke ${String(a.kecepatan ?? 1)}x, bang.`);
        break;
      case 'ganti_suara':
        parts.push(`Siap bang, profil suara udah aku sesuaikan.`);
        break;
      default:
        break;
    }
  }
  return parts.join(' ');
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'marvis-proxy' });
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const {
        message,
        history = [],
        voiceMode = false,
        contextHint = '',
      } = req.body as {
        message?: string;
        history?: ChatMessageInput[];
        voiceMode?: boolean;
        contextHint?: string;
      };

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'Pesan tidak boleh kosong, bang.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({
          error:
            'Kunci API AI di server belum terkonfigurasi. Pastikan GEMINI_API_KEY aktif di panel Secrets.',
        });
        return;
      }

      const trimmedHistory = Array.isArray(history) ? history.slice(-12) : [];
      const contents: Content[] = trimmedHistory.map((item) => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(item.text ?? '') }],
      }));

      const modeNote = voiceMode
        ? '\n[Catatan sistem: Mode suara aktif — jawab singkat 1-2 kalimat yang natural diucapkan.]'
        : '';
      const extraContext = contextHint ? `\n[Konteks dashboard saat ini: ${contextHint}]` : '';

      contents.push({
        role: 'user',
        parts: [{ text: `${message.trim()}${modeNote}${extraContext}` }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: MARVIS_SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: marvisTools }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const actions: ActionItem[] = (response.functionCalls ?? []).map((fc) => ({
        name: fc.name ?? '',
        args: (fc.args as Record<string, unknown>) ?? {},
      }));

      let replyText = (response.text ?? '').trim();
      if (!replyText && actions.length > 0) {
        replyText = buildActionConfirmation(actions);
      }
      if (!replyText) {
        replyText = 'Siap bang, ada lagi yang bisa aku bantu?';
      }

      res.json({
        reply: replyText,
        actions,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Terjadi gangguan pada layanan AI.';
      console.error('[MARVIS /api/chat error]', errMsg);
      const status =
        /429|RESOURCE_EXHAUSTED/i.test(errMsg)
          ? 429
          : /403|PERMISSION_DENIED|API_KEY/i.test(errMsg)
            ? 403
            : 500;
      res.status(status).json({
        error:
          status === 429
            ? 'Kuota permintaan AI sedang penuh, coba sebentar lagi ya bang.'
            : status === 403
              ? 'Akses kunci API AI ditolak. Periksa kembali kunci API di Settings > Secrets.'
              : 'Koneksi ke otak AI MARVIS sempat terganggu. Coba kirim ulang pesanmu, bang.',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`MARVIS server berjalan di http://localhost:${port}`);
  });
}

createApp();
