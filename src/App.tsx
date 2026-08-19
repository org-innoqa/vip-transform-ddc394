import { ArrowRight, CarFront, Check, ChevronDown, Clock3, Globe2, Luggage, Menu, MessageCircle, Phone, Plane, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { getTranslation, type Language } from './lib/i18n'

type Service = { title: string; slug: string; text: string; icon: typeof Clock3 }
type FleetItem = { name: string; meta: string; equipment: string; image: string }

const services: Service[] = [
  { title: 'Havalimanı transferi', slug: 'havalimani-transferi', text: 'Uçuş takibi, karşılama tabelası ve cömert bekleme süresiyle terminalden itibaren sakin bir başlangıç.', icon: Plane },
  { title: 'Şoförlü VIP kiralama', slug: 'soforlu-vip-kiralama', text: 'Saatlik, günlük veya şehirler arası programlarınız için deneyimli şoför ve seçkin araç konforu.', icon: CarFront },
  { title: 'Düğün ve özel etkinlik', slug: 'ozel-etkinlik', text: 'Süslemeli araç, konvoy ve gelin arabası koordinasyonuyla özel gününüzün her anına özen.', icon: Sparkles },
  { title: 'Kurumsal transfer', slug: 'kurumsal-transfer', text: 'Aylık anlaşma, faturalı operasyon ve yöneticileriniz için güvenilir, dakik ulaşım planı.', icon: Users },
]

const fleet: FleetItem[] = [
  { name: 'Executive Van', meta: '6 yolcu · 6 bagaj', equipment: 'Geniş kabin · Wi-Fi · Su ikramı', image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=85' },
  { name: 'Luxury Sedan', meta: '3 yolcu · 3 bagaj', equipment: 'Deri koltuk · Klima · Gizlilik camı', image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85' },
  { name: 'Premium SUV', meta: '5 yolcu · 5 bagaj', equipment: 'Yüksek sürüş · Deri kabin · Şarj ünitesi', image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=85' },
]

function App() {
  const [path, setPath] = useState(window.location.pathname || '/')
  const [menuOpen, setMenuOpen] = useState(false)
  const [language, setLanguage] = useState<Language>(() => (window.localStorage.getItem('vip-language') as Language) || 'tr')
  const [selectedVehicle, setSelectedVehicle] = useState<string | undefined>(() => new URLSearchParams(window.location.search).get('vehicle') || undefined)
  const t = getTranslation(language)

  useEffect(() => {
    const onPop = () => { setPath(window.location.pathname || '/'); setSelectedVehicle(new URLSearchParams(window.location.search).get('vehicle') || undefined) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'; window.localStorage.setItem('vip-language', language); window.scrollTo({ top: 0, behavior: 'smooth' }) }, [path, language])

  const navigate = (to: string) => { window.history.pushState({}, '', to); setPath(to.split('?')[0]); setSelectedVehicle(new URLSearchParams(to.split('?')[1] || '').get('vehicle') || undefined); setMenuOpen(false) }
  const isHome = path === '/'
  return <div className="site-shell">
    <Header path={path} menuOpen={menuOpen} setMenuOpen={setMenuOpen} navigate={navigate} language={language} setLanguage={setLanguage} />
    <main>{isHome ? <Home navigate={navigate} /> : <Page path={path} navigate={navigate} selectedVehicle={selectedVehicle} />}</main>
    <Footer navigate={navigate} language={language} />
    <div className="mobile-bar"><a href="/iletisim" onClick={(e) => { e.preventDefault(); navigate('/iletisim') }}><Phone size={18} />{t.actions.call}</a><a href="/iletisim" onClick={(e) => { e.preventDefault(); navigate('/iletisim') }}><MessageCircle size={18} />{t.actions.whatsapp}</a></div>
  </div>
}

function Header({ path, menuOpen, setMenuOpen, navigate, language, setLanguage }: { path: string; menuOpen: boolean; setMenuOpen: (v: boolean) => void; navigate: (to: string) => void; language: Language; setLanguage: (v: Language) => void }) {
  const t = getTranslation(language)
  const navItems = [[t.nav.services, '/hizmetler'], [t.nav.fleet, '/filo'], [t.nav.corporate, '/kurumsal'], [t.nav.about, '/hakkimizda'], [t.nav.faq, '/sss'], [t.nav.contact, '/iletisim'], [t.nav.booking, '/rezervasyon']]
  return <header className="site-header"><button className="wordmark" onClick={() => navigate('/')} aria-label={t.labels.home}><span>VIP</span> TRANSFER</button><button className="menu-toggle" aria-label={menuOpen ? t.labels.menuClose : t.labels.menuOpen} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button><nav id="primary-navigation" className={menuOpen ? 'nav nav-open' : 'nav'} aria-label={t.nav.services}>{navItems.map(([label, href]) => <a key={href} aria-current={path === href ? 'page' : undefined} href={href} onClick={(e) => { e.preventDefault(); navigate(href) }}>{label}</a>)}<label className="language-select"><Globe2 size={15} /><span className="sr-only">{t.labels.language}</span><select value={language} onChange={(e) => setLanguage(e.target.value as Language)} aria-label={t.labels.language}><option value="tr">TR</option><option value="en">EN</option><option value="ar">AR</option></select></label><a className="nav-cta" href="/rezervasyon" onClick={(e) => { e.preventDefault(); navigate('/rezervasyon') }}>{t.actions.quote} <ArrowRight size={16} /></a></nav></header>
}

function Home({ navigate }: { navigate: (to: string) => void }) {
  return <><section className="hero section-wrap"><div className="hero-copy"><p className="eyebrow">KATAR · ÖZEL ŞOFÖRLÜ ULAŞIM</p><h1>Vardığınız andan itibaren, <em>ayrıcalıklı</em> bir yolculuk.</h1><p className="hero-text">Havalimanından otele, toplantıdan özel davete. Zamanınıza saygı duyan, konforu standart kabul eden VIP transfer hizmeti.</p><RoutePlanner navigate={navigate} /><div className="hero-actions"><a className="text-link" href="/hizmetler" onClick={(e) => { e.preventDefault(); navigate('/hizmetler') }}>Hizmetleri keşfet</a></div></div><div className="hero-visual"><img src="https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1400&q=85" alt="Gece şehir ışıkları önünde lüks araç" /><div className="hero-note"><span className="note-dot" /> Her yolculukta kişisel ilgi</div></div></section><TrustStrip /><section className="section-wrap section" id="hizmetler"><SectionHeading eyebrow="HİZMETLER" title={<>Yolculuğunuzun<br /><em>ritmine</em> uyum.</>} text="İş veya seyahat için Katar'da olduğunuzda, tüm detayları sizin yerinize düşünürüz." /><ServiceGrid navigate={navigate} /></section><section className="fleet-band"><div className="section-wrap section"><SectionHeading eyebrow="FİLO" title={<>Konforun<br /><em>doğru</em> karşılığı.</>} text="Her araç, konfor ve güvenlik beklentilerinizi karşılamak için seçildi." /><FleetGrid navigate={navigate} /></div></section><section className="section-wrap section two-column"><div><p className="eyebrow">NEDEN BİZ</p><h2>Sadece bir araç değil, <em>iyi hissettiren</em> bir hizmet.</h2></div><div className="benefits"><Benefit icon={<Users size={21} />} title="Size göre planlanır" text="Güzergâhınız, bagajınız ve programınız için doğru araç ve akışı birlikte kurgularız." /><Benefit icon={<Luggage size={21} />} title="Detaylar bizde" text="Karşılama tabelasından bekleme süresine kadar yolculuğun her adımı düşünülür." /></div></section><BookingBand navigate={navigate} /></>
}

function RoutePlanner({ navigate }: { navigate: (to: string) => void }) { return <form className="route-planner" onSubmit={(e) => { e.preventDefault(); navigate('/rezervasyon') }}><div className="planner-grid"><label>Hizmet tipi<select defaultValue="airport_transfer"><option value="airport_transfer">Havalimanı transferi</option><option value="chauffeured_rental">Şoförlü VIP kiralama</option><option value="corporate_transfer">Kurumsal transfer</option></select></label><label>Nereden<input required placeholder="Kalkış bölgesi" /></label><label>Nereye<input required placeholder="Varış bölgesi" /></label></div><button className="button button-primary" type="submit">Güzergâhı planla <ArrowRight size={17} /></button></form> }

function Page({ path, navigate, selectedVehicle }: { path: string; navigate: (to: string) => void; selectedVehicle?: string }) {
  const content: Record<string, { eyebrow: string; title: ReactNode; intro: string }> = {
    '/hizmetler': { eyebrow: 'HİZMETLER', title: <>Katar'da her plan için<br /><em>özenli ulaşım.</em></>, intro: 'İhtiyacınıza göre tasarlanan dört hizmet başlığı; net iletişim, zamanında karşılama ve seçkin araç konforuyla.' },
    '/filo': { eyebrow: 'FİLO', title: <>Programınıza uygun<br /><em>araç.</em></>, intro: 'Yolcu ve bagaj kapasitenize göre önerilen, özenle seçilmiş araçlar.' },
    '/kurumsal': { eyebrow: 'KURUMSAL', title: <>İşinizin temposuna<br /><em>uyum sağlayan</em> transfer.</>, intro: 'Aylık anlaşma, faturalı operasyon ve yönetici transferleri için tek bir güvenilir çözüm ortağı.' },
    '/hakkimizda': { eyebrow: 'HAKKIMIZDA', title: <>Katar'da hareketin<br /><em>daha iyi hali.</em></>, intro: 'VIP Transfer, yolculuğu yalnızca bir noktadan diğerine gitmek değil, iyi hissettiren bir deneyim olarak görür.' },
    '/iletisim': { eyebrow: 'İLETİŞİM', title: <>Planınızı<br /><em>konuşalım.</em></>, intro: 'Güzergâhınızı ve ihtiyaçlarınızı paylaşın; size en uygun akışı birlikte oluşturalım.' },
    '/kvkk': { eyebrow: 'KVKK', title: <>Verinizin<br /><em>güvenliği.</em></>, intro: 'Kişisel verilerin korunması ve işlenmesine ilişkin aydınlatma metni bu alanda yer alacaktır.' },
    '/sss': { eyebrow: 'SSS', title: <>Merak ettikleriniz,<br /><em>net cevaplar.</em></>, intro: 'Rezervasyon, araç seçimi ve transfer akışı hakkında sık sorulan sorular.' },
    '/rezervasyon': { eyebrow: 'REZERVASYON', title: <>Dört adımda<br /><em>transfer planı.</em></>, intro: 'Güzergâhınızı paylaşın, aracınızı seçin ve ihtiyaçlarınızı ekleyin.' },
  }
  const current = content[path] || content['/'] || content['/hizmetler']
  return <><section className="page-hero"><div className="section-wrap"><p className="eyebrow">{current.eyebrow}</p><h1>{current.title}</h1><p className="hero-text">{current.intro}</p></div></section><section className="section-wrap section page-content">{path === '/hizmetler' && <ServiceGrid navigate={navigate} />}{path === '/filo' && <FleetGrid navigate={navigate} />}{path === '/rezervasyon' && <><ReservationSteps selectedVehicle={selectedVehicle} /><div className="page-cta"><Button onClick={() => navigate('/rezervasyon?step=route')}>Akışı başlat</Button></div></>}{path === '/sss' && <Faq />}{path === '/iletisim' && <Contact navigate={navigate} />}{path === '/kvkk' && <Legal />}{path === '/kurumsal' && <Corporate />}{path === '/hakkimizda' && <About />}{!content[path] && <ServiceGrid navigate={navigate} />}</section></>
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text: string }) { return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><p>{text}</p></div> }
function TrustStrip() { return <section className="trust-strip section-wrap" aria-label="Hizmet güvenceleri"><div><ShieldCheck size={20} /><span>Güvenli ve deneyimli şoförler</span></div><div><Clock3 size={20} /><span>Zamanında karşılama</span></div><div><Sparkles size={20} /><span>Özenli, kişisel hizmet</span></div></section> }
function ServiceGrid({ navigate }: { navigate: (to: string) => void }) { return <div className="service-grid">{services.map(({ title, slug, text, icon: Icon }, index) => <article className={index === 1 ? 'service-card service-card-dark' : 'service-card'} key={title}><Icon size={22} /><span className="card-index">0{index + 1}</span><h3>{title}</h3><p>{text}</p><button className="inline-action" onClick={() => navigate('/rezervasyon')}>Teklif al <ArrowRight size={16} /></button></article>)}</div> }
function FleetGrid({ navigate }: { navigate: (to: string) => void }) { return <div className="fleet-grid">{fleet.map((car) => <article className="fleet-card" key={car.name}><img src={car.image} alt={`${car.name} lüks araç`} loading="lazy" /><div className="fleet-info"><div><h3>{car.name}</h3><p>{car.meta}</p><small>{car.equipment}</small></div><button onClick={() => navigate(`/rezervasyon?vehicle=${encodeURIComponent(car.name)}`)} aria-label={`${car.name} ile teklif al`}><ArrowRight size={20} /></button></div></article>)}</div> }
function Button({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button className="button button-primary" onClick={onClick}>{children} <ArrowRight size={17} /></button> }
function BookingBand({ navigate }: { navigate: (to: string) => void }) { return <section className="booking section-wrap"><div className="booking-inner"><p className="eyebrow">REZERVASYON</p><h2>Planınızı paylaşın,<br /><em>gerisini bize bırakın.</em></h2><p>Güzergâhınızı, aracınızı ve ihtiyaçlarınızı dört kolay adımda belirleyin.</p><Button onClick={() => navigate('/rezervasyon')}>Rezervasyon başlat</Button></div></section> }
function Benefit({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div>{icon}<h3>{title}</h3><p>{text}</p></div> }
function ReservationSteps({ selectedVehicle }: { selectedVehicle?: string }) { return <><div className="steps-grid">{['Güzergâh', 'Araç seçimi', 'Ekstralar', 'İletişim ve onay'].map((step, i) => <article className="step-card" key={step}><span>0{i + 1}</span><Check size={18} /><h3>{step}</h3><p>{['Hizmet tipi, bölgeler, tarih-saat ve yolcu bilgileri.', 'Kapasitenize uygun araçları fiyatlarıyla görün.', 'Çocuk koltuğu, karşılama tabelası ve notunuzu ekleyin.', 'Bilgilerinizi ve KVKK onayınızı tamamlayın.'][i]}</p>{i === 1 && selectedVehicle && <small className="selected-vehicle">Seçili araç: {selectedVehicle}</small>}</article>)}</div></> }
function Faq() { return <div className="faq-list">{['Fiyat nasıl hesaplanır?', 'Uçuşum gecikirse ne olur?', 'Hangi ödeme yöntemlerini kabul ediyorsunuz?', 'Araç seçimini nasıl yapabilirim?'].map((q) => <details key={q}><summary>{q}<ChevronDown size={18} /></summary><p>Rezervasyon ekibimiz, güzergâh ve ihtiyaçlarınıza göre net bilgiyi teklif sürecinde paylaşır.</p></details>)}</div> }
function Contact({ navigate }: { navigate: (to: string) => void }) { return <div className="contact-layout"><div className="contact-note"><h2>Doğru plan, <em>iyi başlangıç.</em></h2><p>Güzergâhınızı paylaşın; rezervasyon akışına geçmeden önce ihtiyaçlarınızı birlikte netleştirelim.</p><Button onClick={() => navigate('/rezervasyon')}>Transfer planla</Button></div><form className="contact-form" onSubmit={(e) => e.preventDefault()}><label>Ad soyad<input required name="name" placeholder="Adınız ve soyadınız" /></label><label>E-posta<input required type="email" name="email" placeholder="ornek@eposta.com" /></label><label>Mesajınız<textarea required name="message" rows={5} placeholder="Transfer planınızı kısaca anlatın" /></label><button className="button button-primary" type="submit">Mesaj gönder <ArrowRight size={17} /></button></form></div> }
function Corporate() { return <div className="copy-grid"><h2>Her toplantıya<br /><em>zamanında.</em></h2><div><p>Kurumsal personel taşıma ve yönetici transferlerini aylık anlaşma, düzenli raporlama ve faturalı operasyonla yönetiyoruz.</p><p>İş programınız değiştiğinde esnek, ihtiyaçlarınız büyüdüğünde ölçeklenebilir bir ulaşım planı.</p></div></div> }
function About() { return <div className="copy-grid"><h2>Konforu standart<br /><em>kabul ediyoruz.</em></h2><div><p>Deneyimli şoförler, temiz araçlar ve net iletişim; VIP Transfer deneyiminin üç temelini oluşturur.</p><ul className="check-list"><li><Check size={17} /> Dakik karşılama</li><li><Check size={17} /> Kişiye göre planlama</li><li><Check size={17} /> Katar genelinde özenli hizmet</li></ul></div></div> }
function Legal() { return <div className="legal-copy"><h2>Aydınlatma metni</h2><p>İletişim formu üzerinden paylaşılan bilgiler yalnızca talebinizi yanıtlamak ve rezervasyon sürecini yürütmek amacıyla işlenir. Detaylı metin, işletme iletişim bilgileri netleştirildiğinde bu sayfada yayınlanacaktır.</p></div> }
function Footer({ navigate, language }: { navigate: (to: string) => void; language: Language }) { const t = getTranslation(language); return <footer className="site-footer"><div className="section-wrap footer-grid"><div><button className="wordmark" onClick={() => navigate('/')}><span>VIP</span> TRANSFER</button><p>{t.footer.description}</p></div><div><p className="eyebrow">{t.footer.contact}</p><p>{language === 'tr' ? 'Telefon, WhatsApp ve e-posta bilgileri yakında burada yer alacak.' : 'Phone, WhatsApp and email details will be added here.'}</p></div><div><p className="eyebrow">{t.footer.languages}</p><p>Türkçe · English · العربية</p></div></div><div className="section-wrap footer-bottom"><span>© 2026 VIP Transfer</span><button onClick={() => navigate('/kvkk')}>{t.footer.privacy}</button></div></footer> }

export default App
