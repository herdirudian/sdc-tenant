import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck, Zap, BarChart3, Users, ReceiptText, Smartphone, Globe } from "lucide-react";

export function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Navigation */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Solusi Invoice" className="h-10 w-auto" />
            <span className="text-xl font-bold tracking-tight text-slate-900">Solusi Invoice</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <Link href="#features" className="hover:text-primary transition-colors">Fitur</Link>
            <Link href="#solutions" className="hover:text-primary transition-colors">Solusi</Link>
            <Link href="#about" className="hover:text-primary transition-colors">Tentang Kami</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-600">Masuk</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-primary hover:bg-primary/90 text-white px-6">Daftar Sekarang</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 lg:py-32 bg-slate-50">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <Badge variant="outline" className="mb-6 bg-white text-primary border-primary/20 px-4 py-1">
                Sistem Management Operasional (SaaS)
              </Badge>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
                Kelola Invoice & Keuangan Bisnis Anda <span className="text-primary">Lebih Cerdas</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto">
                Solusi transformasi digital untuk operasional bisnis yang lebih aman, terukur, dan efisien. Fokus pada pertumbuhan bisnis Anda, biarkan kami mengelola tagihannya.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg h-auto">
                    Mulai Uji Coba Gratis
                  </Button>
                </Link>
                <Link href="#features">
                  <Button size="lg" variant="outline" className="px-8 py-6 text-lg h-auto border-slate-200 text-slate-700">
                    Pelajari Fitur
                  </Button>
                </Link>
              </div>
              <div className="mt-12 flex items-center justify-center gap-6 text-sm text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Terdaftar PSE Kominfo
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Keamanan Terjamin
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Dukungan 24/7
                </div>
              </div>
            </div>
          </div>
          {/* Background shapes */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl"></div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Fitur Unggulan Solusi Invoice</h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Didesain khusus untuk memenuhi kebutuhan manajemen keuangan bisnis modern di Indonesia.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: <ReceiptText className="h-10 w-10 text-primary" />,
                  title: "Smart Invoicing",
                  desc: "Buat invoice profesional dengan dukungan multi-pajak (PPN, PPh 23) dan E-Faktur secara instan."
                },
                {
                  icon: <BarChart3 className="h-10 w-10 text-blue-600" />,
                  title: "Analisis Real-time",
                  desc: "Pantau arus kas, pendapatan, dan piutang melalui dashboard analitik yang interaktif."
                },
                {
                  icon: <Globe className="h-10 w-10 text-indigo-600" />,
                  title: "Multi-Tenant SaaS",
                  desc: "Kelola banyak cabang atau unit bisnis dalam satu platform dengan keamanan data terisolasi."
                },
                {
                  icon: <ShieldCheck className="h-10 w-10 text-green-600" />,
                  title: "Keamanan Standar PSE",
                  desc: "Data Anda aman bersama kami. Terdaftar resmi sebagai PSE di Kementerian Kominfo RI."
                },
                {
                  icon: <Smartphone className="h-10 w-10 text-orange-600" />,
                  title: "Notifikasi Otomatis",
                  desc: "Kirim invoice dan pengingat pembayaran otomatis via WhatsApp dan Email ke klien Anda."
                },
                {
                  icon: <Users className="h-10 w-10 text-purple-600" />,
                  title: "Kolaborasi Tim",
                  desc: "Atur hak akses anggota tim (Admin, Finance, Staff) sesuai tanggung jawab masing-masing."
                }
              ].map((f, i) => (
                <div key={i} className="p-8 rounded-2xl border border-slate-100 bg-slate-50/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
                  <div className="mb-6">{f.icon}</div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Info Section (PSE & NIB) */}
        <section className="py-20 bg-slate-900 text-white overflow-hidden relative">
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="lg:w-1/2">
                <h2 className="text-3xl md:text-4xl font-bold mb-6">Sertifikasi & Izin Resmi</h2>
                <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                  Memberdayakan bisnis melalui solusi teknologi inovatif. Kami membantu transformasi digital Anda dengan pengembangan perangkat lunak yang cerdas, aman, dan terukur.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">PSE</div>
                    <div>
                      <div className="text-sm text-slate-400">Penyelenggara Sistem Elektronik</div>
                      <div className="font-semibold text-white">No. Registrasi: 180426000279900010001</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">NIB</div>
                    <div>
                      <div className="text-sm text-slate-400">PT Solusi Digital Creative</div>
                      <div className="font-semibold text-white">NIB: 1804260002799</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:w-1/2 relative">
                <div className="relative z-10 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                  <img src="/img/dashboard-preview.png" alt="Dashboard Preview" className="w-full h-auto opacity-80" onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2070"} />
                </div>
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-primary relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10 text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">Siap Transformasi Bisnis Anda?</h2>
            <p className="text-white/80 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
              Bergabunglah dengan ratusan bisnis yang telah mengotomatiskan pengelolaan invoice mereka bersama Solusi Invoice.
            </p>
            <Link href="/register">
              <Button size="lg" className="bg-white text-primary hover:bg-slate-50 px-10 py-7 text-xl h-auto font-bold shadow-xl shadow-black/10">
                Daftar Gratis Sekarang
              </Button>
            </Link>
          </div>
          {/* Patterns */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "40px 40px" }}></div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 py-12 border-t border-slate-200">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <img src="/icon.png" alt="Solusi Invoice" className="h-8 w-auto grayscale contrast-125" />
            <span className="text-lg font-bold text-slate-900">Solusi Invoice</span>
          </div>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
            Platform manajemen operasional dan invoice SaaS terpercaya untuk pertumbuhan bisnis digital Anda.
          </p>
          <div className="text-slate-400 text-xs">
            © {new Date().getFullYear()} PT Solusi Digital Creative. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function Badge({ children, variant = "default", className = "" }: { children: React.ReactNode, variant?: "default" | "outline", className?: string }) {
  const variants = {
    default: "bg-primary text-white",
    outline: "border border-slate-200 text-slate-600"
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
