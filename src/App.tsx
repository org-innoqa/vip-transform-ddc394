import { ArrowRight, CarFront, Clock3, ShieldCheck, Sparkles, Menu, X, Users, Luggage } from 'lucide-react'
import { useState } from 'react'

const services = [
  { title: 'Havalimanı transferi', text: 'Uçuşunuzu takip eder, terminalde karşılar ve yolculuğunuzu sakin bir başlangıca dönüştürürüz.', icon: Clock3 },
  { title: 'Şoförlü VIP kiralama', text: 'Saatlik, günlük veya şehirler arası planlar için deneyimli şoför ve seçkin araç konforu.', icon: CarFront },
  { title: 'Özel etkinlikler', text: 'Düğün, davet ve konvoylar için özenli karşılama, süslemeli araç ve kusursuz koordinasyon.', icon: Sparkles },
]

const fleet = [
  { name: 'Executive Van', meta: '6 yolcu · 6 bagaj', image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=85' },
  { name: 'Luxury Sedan', meta: '3 yolcu · 3 bagaj', image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85' },
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="VIP Transfer ana sayfa"><span>VIP</span> TRANSFER</a>
        <button className="menu-toggle" aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={menuOpen ? 'nav nav-open' : 'nav'} aria-label="Ana navigasyon">
          <a href="#hizmetler" onClick={() => setMenuOpen(false)}>Hizmetler</a>
          <a href="#filo" onClick={() => setMenuOpen(false)}>Filo</a>
          <a href="#neden-biz" onClick={() => setMenuOpen(false)}>Neden biz</a>
          <a href="#iletisim" onClick={() => setMenuOpen(false)}>İletişim</a>
          <a className="nav-cta" href="#rezervasyon" onClick={() => setMenuOpen(false)}>Teklif al <ArrowRight size={16} /></a>
        </nav>
      </header>

      <main id="top">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <p className="eyebrow">KATAR · ÖZEL ŞOFÖRLÜ ULAŞIM</p>
            <h1>Vardığınız andan itibaren, <em>ayrıcalıklı</em> bir yolculuk.</h1>
            <p className="hero-text">Havalimanından otele, toplantıdan özel davete. Zamanınıza saygı duyan, konforu standart kabul eden VIP transfer hizmeti.</p>
            <div className="hero-actions"><a className="button button-primary" href="#rezervasyon">Transfer planla <ArrowRight size={17} /></a><a className="text-link" href="#hizmetler">Hizmetleri keşfet</a></div>
          </div>
          <div className="hero-visual">
            <img src="https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1400&q=85" alt="Gece şehir ışıkları önünde lüks araç" />
            <div className="hero-note"><span className="note-dot" /> Her yolculukta kişisel ilgi</div>
          </div>
        </section>

        <section className="trust-strip section-wrap" aria-label="Hizmet güvenceleri">
          <div><ShieldCheck size={20} /><span>Güvenli ve deneyimli şoförler</span></div><div><Clock3 size={20} /><span>Zamanında karşılama</span></div><div><Sparkles size={20} /><span>Özenli, kişisel hizmet</span></div>
        </section>

        <section className="section-wrap section" id="hizmetler">
          <div className="section-heading"><div><p className="eyebrow">HİZMETLER</p><h2>Yolculuğunuzun<br /><em>ritmine</em> uyum.</h2></div><p>İş veya seyahat için Katar'da olduğunuzda, tüm detayları sizin yerinize düşünürüz.</p></div>
          <div className="service-grid">{services.map(({ title, text, icon: Icon }, index) => <article className={index === 1 ? 'service-card service-card-dark' : 'service-card'} key={title}><Icon size={22} /><span className="card-index">0{index + 1}</span><h3>{title}</h3><p>{text}</p><a href="#rezervasyon" aria-label={`${title} için teklif al`}>Teklif al <ArrowRight size={16} /></a></article>)}</div>
        </section>

        <section className="fleet-band" id="filo"><div className="section-wrap section"><div className="section-heading"><div><p className="eyebrow">FİLO</p><h2>Konforun<br /><em>doğru</em> karşılığı.</h2></div><p>Her araç, konfor ve güvenlik beklentilerinizi karşılamak için seçildi. Uygun araç önerisini rezervasyon akışında birlikte bulalım.</p></div><div className="fleet-grid">{fleet.map((car) => <article className="fleet-card" key={car.name}><img src={car.image} alt={`${car.name} lüks araç`} loading="lazy" /><div className="fleet-info"><div><h3>{car.name}</h3><p>{car.meta}</p></div><a href="#rezervasyon" aria-label={`${car.name} ile teklif al`}><ArrowRight size={20} /></a></div></article>)}</div></div></section>

        <section className="section-wrap section two-column" id="neden-biz"><div><p className="eyebrow">NEDEN BİZ</p><h2>Sadece bir araç değil, <em>iyi hissettiren</em> bir hizmet.</h2></div><div className="benefits"><div><Users size={21} /><h3>Size göre planlanır</h3><p>Güzergâhınız, bagajınız ve programınız için doğru araç ve akışı birlikte kurgularız.</p></div><div><Luggage size={21} /><h3>Detaylar bizde</h3><p>Karşılama tabelasından bekleme süresine kadar yolculuğun her adımı düşünülür.</p></div></div></section>

        <section className="booking section-wrap" id="rezervasyon"><div className="booking-inner"><p className="eyebrow">REZERVASYON</p><h2>Planınızı paylaşın,<br /><em>gerisini bize bırakın.</em></h2><p>Yakında dört adımlı rezervasyon akışımızla güzergâhınızı, aracınızı ve ihtiyaçlarınızı kolayca seçebileceksiniz.</p><a className="button button-light" href="#iletisim">Ön talep bırak <ArrowRight size={17} /></a></div></section>
      </main>

      <footer className="site-footer" id="iletisim"><div className="section-wrap footer-grid"><div><a className="wordmark" href="#top"><span>VIP</span> TRANSFER</a><p>Katar'da konforlu, güvenilir ve özenli ulaşım.</p></div><div><p className="eyebrow">İLETİŞİM</p><p>İletişim bilgileri yakında burada yer alacak.</p></div><div><p className="eyebrow">DİL</p><button className="language-button">TR · Türkçe <ArrowRight size={15} /></button></div></div><div className="section-wrap footer-bottom"><span>© 2026 VIP Transfer</span><span>Güvenli yolculuklar.</span></div></footer>
    </div>
  )
}

export default App
