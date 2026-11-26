import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="classmeet-theme min-h-screen bg-[#ffffff] text-[#0b1437]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex h-9 cursor-pointer items-center justify-center rounded-[8px] border border-[#8e9cd6] bg-[#ffffff] px-4 text-sm font-semibold text-[#2a55d6] transition-colors hover:bg-[#eaf0ff]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Beranda
          </button>

          <img
            src="/logo-issc.png"
            alt="Logo ISSC"
            className="h-8 w-auto object-contain"
          />
        </div>

        <div className="rounded-[10px] border border-[#cbd5f5] bg-[#ffffff] p-6 shadow-[0_1px_3px_rgba(13,43,227,0.1),0_4px_16px_rgba(13,43,227,0.08)] sm:p-8">
          <h1 className="mb-4 text-3xl font-bold text-[#0b1437]">Syarat &amp; Ketentuan</h1>
          <div className="space-y-4 text-sm leading-relaxed text-[#434d7e] sm:text-base">
            <p>
              Aplikasi ISSC Quiz Buzzer menyediakan sistem buzzer kuis real-time untuk sesi lomba
              cepat-cepatan dan kuis interaktif.
            </p>
            <p>
              <strong className="text-[#0b1437]">Privasi:</strong> Nama tim/peserta dan warna
              hanya disimpan di penyimpanan lokal peramban dan dikirim sementara ke room aktif.
            </p>
            <p>
              <strong className="text-[#0b1437]">Keadilan Real-Time:</strong> Server mencatat
              penekan pertama yang tiba saat buzzer terbuka dan mengunci tombol sampai Host mereset.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
