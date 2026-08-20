import { ArrowLeft, ArrowRight, Check, LoaderCircle, Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { db } from './lib/db'
import type { Language } from './lib/i18n'

type Vehicle = { id: string; model: string; passenger_capacity: number; luggage_capacity: number; multiplier: number; equipment: string[]; image_url?: string | null }
type Zone = { id: string; name: string }
type Rule = { origin_zone_id: string; destination_zone_id: string; base_price: number }
type Extra = { id: string; name: string; price: number; extra_type: string }
type Settings = { round_trip_discount_percent: number; night_surcharge_percent: number; currency_code: string }
type Form = { service_type: string; origin_zone_id: string; destination_zone_id: string; pickup_at: string; is_round_trip: boolean; passenger_count: number; luggage_count: number; vehicle_id: string; extras: Record<string, number>; flight_number: string; customer_name: string; customer_phone: string; customer_email: string; customer_note: string; honeypot: string; kvkk: boolean }

const initial: Form = { service_type: 'airport_transfer', origin_zone_id: '', destination_zone_id: '', pickup_at: '', is_round_trip: false, passenger_count: 1, luggage_count: 0, vehicle_id: '', extras: {}, flight_number: '', customer_name: '', customer_phone: '', customer_email: '', customer_note: '', honeypot: '', kvkk: false }
const copy = {
  tr: { steps: ['Güzergâh', 'Araç seçimi', 'Ekstralar', 'İletişim ve onay'], service: 'Hizmet tipi', airport_transfer: 'Havalimanı transferi', chauffeured_rental: 'Şoförlü VIP kiralama', wedding_event: 'Düğün ve özel etkinlik', corporate_transfer: 'Kurumsal transfer', from: 'Kalkış bölgesi', to: 'Varış bölgesi', date: 'Tarih ve saat', return: 'Gidiş-dönüş', passengers: 'Yolcu sayısı', luggage: 'Bagaj sayısı', next: 'Devam et', back: 'Geri', choose: 'Bu aracı seç', extras: 'Ek hizmetler', flight: 'Uçuş numarası (opsiyonel)', note: 'Notunuz (opsiyonel)', name: 'Ad soyad', phone: 'Telefon', email: 'E-posta', consent: 'KVKK aydınlatma metnini okudum ve onaylıyorum.', finish: 'Rezervasyonu tamamla', estimate: 'Tahmini tutar', notePrice: 'Fiyat kesin teklifle onaylanır.', loading: 'Veriler yükleniyor…', empty: 'Bu kapasiteye uygun araç bulunamadı.', success: 'Rezervasyonunuz alındı', code: 'Rezervasyon kodu', summary: 'Rezervasyon özeti', required: 'Bu alan zorunludur.', invalidEmail: 'Geçerli bir e-posta girin.', consentError: 'KVKK onayı gereklidir.', honeypot: 'İşlem doğrulanamadı.' },
  en: { steps: ['Route', 'Vehicle selection', 'Extras', 'Contact and confirmation'], service: 'Service type', airport_transfer: 'Airport transfer', chauffeured_rental: 'Chauffeured VIP rental', wedding_event: 'Wedding and special event', corporate_transfer: 'Corporate transfer', from: 'Pickup zone', to: 'Destination zone', date: 'Date and time', return: 'Round trip', passengers: 'Passengers', luggage: 'Luggage', next: 'Continue', back: 'Back', choose: 'Choose this vehicle', extras: 'Additional services', flight: 'Flight number (optional)', note: 'Your note (optional)', name: 'Full name', phone: 'Phone', email: 'Email', consent: 'I have read and agree to the privacy notice.', finish: 'Complete reservation', estimate: 'Estimated total', notePrice: 'Final price is confirmed with a definitive quote.', loading: 'Loading data…', empty: 'No vehicle matches this capacity.', success: 'Your reservation is confirmed', code: 'Reservation code', summary: 'Reservation summary', required: 'This field is required.', invalidEmail: 'Enter a valid email.', consentError: 'Privacy consent is required.', honeypot: 'The request could not be verified.' },
  ar: { steps: ['المسار', 'اختيار السيارة', 'الإضافات', 'التواصل والتأكيد'], service: 'نوع الخدمة', airport_transfer: 'نقل من المطار', chauffeured_rental: 'تأجير فاخر مع سائق', wedding_event: 'الأعراس والمناسبات', corporate_transfer: 'نقل الشركات', from: 'منطقة الانطلاق', to: 'منطقة الوصول', date: 'التاريخ والوقت', return: 'رحلة ذهاب وعودة', passengers: 'عدد الركاب', luggage: 'عدد الحقائب', next: 'متابعة', back: 'رجوع', choose: 'اختر هذه السيارة', extras: 'الخدمات الإضافية', flight: 'رقم الرحلة (اختياري)', note: 'ملاحظتك (اختياري)', name: 'الاسم الكامل', phone: 'الهاتف', email: 'البريد الإلكتروني', consent: 'قرأت إشعار الخصوصية وأوافق عليه.', finish: 'إتمام الحجز', estimate: 'المبلغ التقديري', notePrice: 'يتم تأكيد السعر النهائي بعرض سعر نهائي.', loading: 'جار تحميل البيانات…', empty: 'لا توجد سيارة تناسب هذه السعة.', success: 'تم استلام حجزك', code: 'رمز الحجز', summary: 'ملخص الحجز', required: 'هذا الحقل مطلوب.', invalidEmail: 'أدخل بريداً إلكترونياً صحيحاً.', consentError: 'الموافقة على الخصوصية مطلوبة.', honeypot: 'تعذر التحقق من الطلب.' },
} as const

export default function BookingFlow({ language, selectedVehicle, initialRoute }: { language: Language; selectedVehicle?: string; initialRoute?: { origin?: string; destination?: string } }) {
  const t = copy[language]; const [data, setData] = useState<{ vehicles: Vehicle[]; zones: Zone[]; rules: Rule[]; extras: Extra[]; settings: Settings }>({ vehicles: [], zones: [], rules: [], extras: [], settings: { round_trip_discount_percent: 0, night_surcharge_percent: 0, currency_code: 'QAR' } })
  const [form, setForm] = useState<Form>({ ...initial, origin_zone_id: initialRoute?.origin || '', destination_zone_id: initialRoute?.destination || '' }); const [step, setStep] = useState(0); const [loading, setLoading] = useState(true); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState(''); const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); const [confirmation, setConfirmation] = useState<{ code: string; amount: number } | null>(null)
  useEffect(() => { Promise.all([db.rpc<Vehicle>('list_available_vehicles', { p_passenger_count: 1, p_luggage_count: 0 }), db.select<Zone>('zones', { filters: { is_active: true }, orderBy: 'name' }), db.select<Rule>('price_rules', { filters: { is_active: true } }), db.select<Extra>('extras', { filters: { is_active: true }, orderBy: 'name' }), db.select<Settings>('pricing_settings', { limit: 1 })]).then(([vehicles, zones, rules, extras, settings]) => { setData({ vehicles, zones, rules, extras, settings: settings[0] || data.settings }); const found = selectedVehicle && vehicles.find(v => v.model === selectedVehicle); if (found) setForm(f => ({ ...f, vehicle_id: found.id })) }).catch(() => setError('Rezervasyon verileri yüklenemedi. Lütfen tekrar deneyin.')).finally(() => setLoading(false)) }, [selectedVehicle])
  useEffect(() => {
    if (loading) return
    let cancelled = false
    db.rpc<Vehicle>('list_available_vehicles', { p_passenger_count: form.passenger_count, p_luggage_count: form.luggage_count }).then(vehicles => {
      if (cancelled) return
      setData(current => ({ ...current, vehicles }))
      if (form.vehicle_id && !vehicles.some(vehicle => vehicle.id === form.vehicle_id)) set('vehicle_id', '')
    }).catch(() => { if (!cancelled) setError('Uygun araçlar yüklenemedi. Lütfen tekrar deneyin.') })
    return () => { cancelled = true }
  }, [loading, form.passenger_count, form.luggage_count])
  const available = useMemo(() => data.vehicles.filter(v => v.passenger_capacity >= form.passenger_count && v.luggage_capacity >= form.luggage_count), [data.vehicles, form.passenger_count, form.luggage_count])
  const [serverAmount, setServerAmount] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    const vehicle = data.vehicles.find(v => v.id === form.vehicle_id)
    if (!form.origin_zone_id || !form.destination_zone_id || !vehicle || !form.pickup_at) { setServerAmount(null); return () => { cancelled = true } }
    const pickup = new Date(form.pickup_at)
    if (Number.isNaN(pickup.getTime())) { setServerAmount(null); return () => { cancelled = true } }
    const selectedExtras = data.extras.filter(x => (form.extras[x.id] || 0) > 0).map(x => ({ extra_id: x.id, quantity: form.extras[x.id] }))
    db.rpc<{ calculated_amount: number }>('calculate_reservation_quote', { p_origin_zone_id: form.origin_zone_id, p_destination_zone_id: form.destination_zone_id, p_vehicle_id: form.vehicle_id, p_pickup_at: pickup.toISOString(), p_is_round_trip: form.is_round_trip, p_passenger_count: form.passenger_count, p_luggage_count: form.luggage_count, p_extras: selectedExtras }).then(rows => { if (!cancelled) setServerAmount(rows[0] ? Number(rows[0].calculated_amount) : null) }).catch(() => { if (!cancelled) setServerAmount(null) })
    return () => { cancelled = true }
  }, [data.vehicles, data.extras, form.origin_zone_id, form.destination_zone_id, form.vehicle_id, form.pickup_at, form.is_round_trip, form.passenger_count, form.luggage_count, form.extras])
  function set<K extends keyof Form>(key: K, value: Form[K]) { setForm(f => ({ ...f, [key]: value })); setFieldErrors(e => ({ ...e, [key]: '' })); setError('') }
  function validate(): boolean { const e: Record<string, string> = {}; if (step === 0) { if (!form.origin_zone_id) e.origin_zone_id = t.required; if (!form.destination_zone_id) e.destination_zone_id = t.required; if (form.origin_zone_id && form.origin_zone_id === form.destination_zone_id) e.destination_zone_id = t.required; if (!form.pickup_at) e.pickup_at = t.required } if (step === 1 && !form.vehicle_id) e.vehicle_id = t.required; if (step === 3) { if (!form.customer_name.trim()) e.customer_name = t.required; if (!form.customer_phone.trim()) e.customer_phone = t.required; if (!/^\S+@\S+\.\S+$/.test(form.customer_email)) e.customer_email = t.invalidEmail; if (!form.kvkk) e.kvkk = t.consentError; if (form.honeypot) e.honeypot = t.honeypot } setFieldErrors(e); return !Object.keys(e).length }
  function next() { if (validate()) setStep(s => Math.min(3, s + 1)) }
  async function submit() {
    if (!validate() || serverAmount === null) {
      if (serverAmount === null) setError('Kalkış, varış ve seçili araç için aktif tarife bulunamadı.')
      return
    }
    setSubmitting(true)
    try {
      const selectedExtras = data.extras
        .filter(x => (form.extras[x.id] || 0) > 0)
        .map(x => ({ extra_id: x.id, quantity: form.extras[x.id] }))
      const rows = await db.rpc<{ id: string; code: string; calculated_amount: number; currency_code: string }>('create_reservation', {
        p_service_type: form.service_type,
        p_origin_zone_id: form.origin_zone_id,
        p_destination_zone_id: form.destination_zone_id,
        p_vehicle_id: form.vehicle_id,
        p_pickup_at: new Date(form.pickup_at).toISOString(),
        p_is_round_trip: form.is_round_trip,
        p_passenger_count: form.passenger_count,
        p_luggage_count: form.luggage_count,
        p_flight_number: form.flight_number.trim() || null,
        p_customer_name: form.customer_name.trim(),
        p_customer_phone: form.customer_phone.trim(),
        p_customer_email: form.customer_email.trim(),
        p_customer_note: form.customer_note.trim() || null,
        p_kvkk_consent_at: new Date().toISOString(),
        p_honeypot: form.honeypot,
        p_extras: selectedExtras,
      })
      const reservation = rows[0]
      if (!reservation?.code) throw new Error('reservation_not_created')
      setConfirmation({ code: reservation.code, amount: Number(reservation.calculated_amount) })
    } catch {
      setError('Rezervasyon kaydedilemedi. Bilgilerinizi kontrol edip tekrar deneyin.')
    } finally { setSubmitting(false) }
  }
  if (loading) return <div className="booking-flow loading-state"><LoaderCircle className="spin" />{t.loading}</div>
  if (confirmation) return <div className="booking-flow confirmation"><Check size={38} /><p className="eyebrow">{t.success}</p><h2>{t.code}: {confirmation.code}</h2><p>{t.summary}</p><strong>{t.estimate}: {confirmation.amount.toFixed(2)} {data.settings.currency_code}</strong><p className="price-note">{t.notePrice}</p></div>
  const input = (key: keyof Form, label: string, props: Record<string, string | number> = {}) => <label className={fieldErrors[key as string] ? 'has-error' : ''}>{label}<input {...props} value={String(form[key] ?? '')} onChange={e => set(key, e.target.value as Form[typeof key])} />{fieldErrors[key as string] && <small className="field-error">{fieldErrors[key as string]}</small>}</label>
  return <div className="booking-flow"><div className="booking-progress" aria-label="Booking progress">{t.steps.map((name, i) => <div className={i <= step ? 'active' : ''} key={name}><span>0{i + 1}</span><b>{name}</b></div>)}</div>{error && <p className="form-error" role="alert">{error}</p>}{step === 0 && <section className="flow-panel"><h2>{t.steps[0]}</h2><div className="flow-grid"><label>{t.service}<select value={form.service_type} onChange={e => set('service_type', e.target.value)}>{(['airport_transfer', 'chauffeured_rental', 'wedding_event', 'corporate_transfer'] as const).map(k => <option key={k} value={k}>{t[k]}</option>)}</select></label><label>{t.from}<select value={form.origin_zone_id} onChange={e => set('origin_zone_id', e.target.value)}><option value="">—</option>{data.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select>{fieldErrors.origin_zone_id && <small className="field-error">{fieldErrors.origin_zone_id}</small>}</label><label>{t.to}<select value={form.destination_zone_id} onChange={e => set('destination_zone_id', e.target.value)}><option value="">—</option>{data.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select>{fieldErrors.destination_zone_id && <small className="field-error">{fieldErrors.destination_zone_id}</small>}</label>{input('pickup_at', t.date, { type: 'datetime-local', min: new Date().toISOString().slice(0, 16) })}{input('passenger_count', t.passengers, { type: 'number', min: 1, max: 100 })}{input('luggage_count', t.luggage, { type: 'number', min: 0, max: 100 })}<label className="checkbox-label"><input type="checkbox" checked={form.is_round_trip} onChange={e => set('is_round_trip', e.target.checked)} />{t.return}</label></div></section>}{step === 1 && <section className="flow-panel"><h2>{t.steps[1]}</h2>{fieldErrors.vehicle_id && <p className="field-error">{fieldErrors.vehicle_id}</p>}<div className="vehicle-options">{available.length ? available.map(v => <article className={form.vehicle_id === v.id ? 'vehicle-option selected' : 'vehicle-option'} key={v.id}><div>{v.image_url ? <img src={v.image_url} alt={v.model} loading="lazy" /> : <div className="vehicle-placeholder">VIP</div>}<div><h3>{v.model}</h3><p>{v.passenger_capacity} pax · {v.luggage_capacity} bags</p><small>{v.equipment.join(' · ')}</small></div></div><div className="vehicle-price"><strong>{quote(v, serverAmount ?? 0, form.vehicle_id === v.id, data, form)}</strong><button type="button" className="button button-outline" onClick={() => set('vehicle_id', v.id)}>{form.vehicle_id === v.id ? <Check size={16} /> : null}{t.choose}</button></div></article>) : <p className="empty-state">{t.empty}</p>}</div></section>}{step === 2 && <section className="flow-panel"><h2>{t.extras}</h2><div className="extras-list">{data.extras.map(x => <div className="extra-row" key={x.id}><div><strong>{x.name}</strong><small>{Number(x.price).toFixed(2)} {data.settings.currency_code}</small></div><div className="quantity"><button type="button" aria-label="-" onClick={() => set('extras', { ...form.extras, [x.id]: Math.max(0, (form.extras[x.id] || 0) - 1) })}><Minus size={15} /></button><b>{form.extras[x.id] || 0}</b><button type="button" aria-label="+" onClick={() => set('extras', { ...form.extras, [x.id]: (form.extras[x.id] || 0) + 1 })}><Plus size={15} /></button></div></div>)}</div>{input('flight_number', t.flight)}{input('customer_note', t.note, { maxLength: 500 })}</section>}{step === 3 && <section className="flow-panel"><h2>{t.steps[3]}</h2><div className="flow-grid">{input('customer_name', t.name, { required: 'true' })}{input('customer_phone', t.phone, { type: 'tel', required: 'true' })}{input('customer_email', t.email, { type: 'email', required: 'true' })}</div><label className="honeypot">Website<input tabIndex={-1} autoComplete="off" value={form.honeypot} onChange={e => set('honeypot', e.target.value)} /></label><label className={fieldErrors.kvkk ? 'checkbox-label has-error' : 'checkbox-label'}><input type="checkbox" checked={form.kvkk} onChange={e => set('kvkk', e.target.checked)} />{t.consent}</label>{fieldErrors.kvkk && <small className="field-error">{fieldErrors.kvkk}</small>}</section>}<div className="flow-footer">{step > 0 && <button type="button" className="button button-outline" onClick={() => setStep(s => s - 1)}><ArrowLeft size={17} />{t.back}</button>}<div className="estimate"><span>{t.estimate}</span><strong>{(serverAmount ?? 0).toFixed(2)} {data.settings.currency_code}</strong><small>{t.notePrice}</small></div>{step < 3 ? <button type="button" className="button button-primary" onClick={next}>{t.next}<ArrowRight size={17} /></button> : <button type="button" className="button button-primary" disabled={submitting} onClick={submit}>{submitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{t.finish}</button>}</div></div>
}
function quote(v: Vehicle, selectedAmount: number, selected: boolean, data: { rules: Rule[]; settings: Settings }, form: Form) { if (!selected) { const rule = data.rules.find(r => r.origin_zone_id === form.origin_zone_id && r.destination_zone_id === form.destination_zone_id); return rule ? `${(Number(rule.base_price) * Number(v.multiplier)).toFixed(2)} ${data.settings.currency_code}` : '—' } return `${selectedAmount.toFixed(2)} ${data.settings.currency_code}` }
