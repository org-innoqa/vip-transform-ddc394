export type Language = 'tr' | 'en' | 'ar'

export const languages: Array<{ code: Language; label: string; nativeLabel: string }> = [
  { code: 'tr', label: 'Türkçe', nativeLabel: 'TR' },
  { code: 'en', label: 'English', nativeLabel: 'EN' },
  { code: 'ar', label: 'العربية', nativeLabel: 'AR' },
]

const copy = {
  tr: {
    nav: { services: 'Hizmetler', fleet: 'Filo', corporate: 'Kurumsal', about: 'Hakkımızda', faq: 'SSS', contact: 'İletişim', booking: 'Rezervasyon' },
    actions: { quote: 'Teklif al', plan: 'Transfer planla', explore: 'Hizmetleri keşfet', start: 'Rezervasyon başlat', call: 'Ara', whatsapp: 'WhatsApp' },
    labels: { language: 'Dil seçimi', home: 'VIP Transfer ana sayfa', menuOpen: 'Menüyü aç', menuClose: 'Menüyü kapat' },
    footer: { description: 'Katar’da konforlu, güvenilir ve özenli ulaşım.', contact: 'İletişim', languages: 'DİL', privacy: 'KVKK' },
  },
  en: {
    nav: { services: 'Services', fleet: 'Fleet', corporate: 'Corporate', about: 'About us', faq: 'FAQ', contact: 'Contact', booking: 'Reservation' },
    actions: { quote: 'Get a quote', plan: 'Plan your transfer', explore: 'Explore services', start: 'Start reservation', call: 'Call', whatsapp: 'WhatsApp' },
    labels: { language: 'Language selection', home: 'VIP Transfer home', menuOpen: 'Open menu', menuClose: 'Close menu' },
    footer: { description: 'Comfortable, reliable and thoughtful transport in Qatar.', contact: 'CONTACT', languages: 'LANGUAGE', privacy: 'Privacy' },
  },
  ar: {
    nav: { services: 'الخدمات', fleet: 'الأسطول', corporate: 'الشركات', about: 'من نحن', faq: 'الأسئلة الشائعة', contact: 'اتصل بنا', booking: 'الحجز' },
    actions: { quote: 'احصل على عرض', plan: 'خطط رحلتك', explore: 'اكتشف الخدمات', start: 'ابدأ الحجز', call: 'اتصال', whatsapp: 'واتساب' },
    labels: { language: 'اختيار اللغة', home: 'الصفحة الرئيسية للنقل الفاخر', menuOpen: 'فتح القائمة', menuClose: 'إغلاق القائمة' },
    footer: { description: 'نقل مريح وموثوق بعناية في قطر.', contact: 'اتصل بنا', languages: 'اللغة', privacy: 'الخصوصية' },
  },
} as const

export type Translation = (typeof copy)[Language]
export function getTranslation(language: Language): Translation { return copy[language] }
