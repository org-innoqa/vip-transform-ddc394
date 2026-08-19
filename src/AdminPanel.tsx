import { useEffect, useState, type FormEvent } from 'react'
import { Eye, LogIn, LogOut, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import db, { setAdminSession } from './lib/db'

type Vehicle = { id: string; model: string; passenger_capacity: number; luggage_capacity: number; multiplier: number; equipment: string[]; image_url?: string | null; is_active: boolean }
type Zone = { id: string; name: string; is_active: boolean }
type Extra = { id: string; name: string; price: number; extra_type: string; is_active: boolean }
type PriceRule = { id: string; origin_zone_id: string; destination_zone_id: string; base_price: number; is_active: boolean }
type Reservation = { id: string; code: string; service_type: string; origin_zone_id: string; destination_zone_id: string; vehicle_id: string; customer_name: string; customer_phone: string; customer_email: string; calculated_amount: number; status: string; pickup_at: string; passenger_count: number; luggage_count: number; flight_number?: string | null; customer_note?: string | null }

const statuses = ['new', 'confirmed', 'completed', 'cancelled'] as const
const isHttpsUrl = (value: string) => !value || /^https:\/\/[^\s]+$/i.test(value)
const isFiniteNonNegative = (value: number) => Number.isFinite(value) && value >= 0
const friendlyError = (err: unknown, fallback: string) => {
  const message = err instanceof Error ? err.message : ''
  if (/duplicate|unique/i.test(message)) return 'Bu kayıt zaten mevcut.'
  if (/foreign key|restrict/i.test(message)) return 'Bu kayıt başka bir operasyon verisine bağlı.'
  if (/check constraint|invalid/i.test(message)) return 'Girilen değerlerden biri geçerli değil.'
  return fallback
}
const statusLabels: Record<string, string> = { new: 'Yeni', confirmed: 'Onaylandı', completed: 'Tamamlandı', cancelled: 'İptal' }
const emptyVehicle = { model: '', passenger_capacity: 1, luggage_capacity: 0, multiplier: 1, equipment: '', image_url: '', is_active: true }
const emptyExtra = { name: '', price: 0, extra_type: 'other' }

export default function AdminPanel() {
  const [token, setToken] = useState(() => sessionStorage.getItem('vip-admin-session'))
  const [username, setUsername] = useState(() => sessionStorage.getItem('vip-admin-user') || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('reservations')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [extras, setExtras] = useState<Extra[]>([])
  const [priceRules, setPriceRules] = useState<PriceRule[]>([])
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [vehicleForm, setVehicleForm] = useState(emptyVehicle)
  const [editingVehicle, setEditingVehicle] = useState<string | null>(null)
  const [zoneForm, setZoneForm] = useState({ name: '' })
  const [editingZone, setEditingZone] = useState<string | null>(null)
  const [priceForm, setPriceForm] = useState({ origin_zone_id: '', destination_zone_id: '', base_price: 0 })
  const [editingPriceRule, setEditingPriceRule] = useState<string | null>(null)
  const [extraForm, setExtraForm] = useState(emptyExtra)
  const [editingExtra, setEditingExtra] = useState<string | null>(null)

  useEffect(() => { setAdminSession(token); if (token) void loadData() }, [token])
  async function loadData() {
    setLoading(true); setError('')
    try {
      const [r, v, z, e, pr] = await Promise.all([
        db.select<Reservation>('reservations', { orderBy: 'created_at', ascending: false }),
        db.select<Vehicle>('vehicles', { orderBy: 'created_at', ascending: false }),
        db.select<Zone>('zones', { orderBy: 'name' }),
        db.select<Extra>('extras', { orderBy: 'name' }),
        db.select<PriceRule>('price_rules', { orderBy: 'created_at', ascending: false }),
      ])
      setReservations(r); setVehicles(v); setZones(z); setExtras(e); setPriceRules(pr)
    } catch (err) { setError(friendlyError(err, 'Veriler yüklenemedi.')) } finally { setLoading(false) }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError('')
    const form = new FormData(e.currentTarget)
    try {
      const result = await db.rpc<{ token: string; username: string }>('admin_login', { p_username: form.get('username'), p_password: form.get('password') })
      const session = result[0]
      if (!session?.token) throw new Error('invalid_credentials')
      sessionStorage.setItem('vip-admin-session', session.token); sessionStorage.setItem('vip-admin-user', session.username)
      setToken(session.token); setUsername(session.username)
    } catch { setError('Kullanıcı adı veya parola geçersiz.') } finally { setLoading(false) }
  }
  async function logout() {
    if (token) { try { await db.rpc('admin_logout', { p_token: token }) } catch { /* local cleanup still logs out */ } }
    setAdminSession(null); sessionStorage.removeItem('vip-admin-session'); sessionStorage.removeItem('vip-admin-user'); setToken(null); setUsername('')
  }
  function fail(message: string) { setError(message); return false }
  async function saveVehicle(e: FormEvent) {
    e.preventDefault(); setError('')
    const value = { ...vehicleForm, model: vehicleForm.model.trim(), passenger_capacity: Number(vehicleForm.passenger_capacity), luggage_capacity: Number(vehicleForm.luggage_capacity), multiplier: Number(vehicleForm.multiplier), equipment: vehicleForm.equipment.split(',').map(x => x.trim()).filter(Boolean), image_url: vehicleForm.image_url.trim() || null }
    if (!value.model || value.model.length > 120 || !Number.isInteger(value.passenger_capacity) || value.passenger_capacity < 1 || !Number.isInteger(value.luggage_capacity) || value.luggage_capacity < 0 || !Number.isFinite(value.multiplier) || value.multiplier <= 0 || value.multiplier > 100 || !isHttpsUrl(value.image_url || '')) return void fail('Model, kapasite, bagaj, pozitif çarpan ve güvenli görsel URL zorunludur.')
    try { editingVehicle ? await db.update('vehicles', `?id=eq.${editingVehicle}`, value) : await db.insert('vehicles', value); setVehicleForm(emptyVehicle); setEditingVehicle(null); await loadData() } catch (err) { setError(friendlyError(err, 'Araç kaydedilemedi.')) }
  }
  async function saveZone(e: FormEvent) {
    e.preventDefault(); const name = zoneForm.name.trim(); if (!name) return void fail('Bölge adı zorunludur.')
    if (name.length > 120) return void fail('Bölge adı 120 karakterden uzun olamaz.')
    try { editingZone ? await db.update('zones', `?id=eq.${editingZone}`, { name }) : await db.insert('zones', { name, is_active: true }); setZoneForm({ name: '' }); setEditingZone(null); await loadData() } catch (err) { setError(friendlyError(err, 'Bölge kaydedilemedi.')) }
  }
  async function savePriceRule(e: FormEvent) {
    e.preventDefault(); const base_price = Number(priceForm.base_price)
    if (!priceForm.origin_zone_id || !priceForm.destination_zone_id || priceForm.origin_zone_id === priceForm.destination_zone_id || !isFiniteNonNegative(base_price) || base_price > 100000000) return void fail('Farklı kalkış-varış bölgeleri ve 0–100.000.000 arası geçerli fiyat zorunludur.')
    try { editingPriceRule ? await db.update('price_rules', `?id=eq.${editingPriceRule}`, { ...priceForm, base_price }) : await db.insert('price_rules', { ...priceForm, base_price, is_active: true }); setPriceForm({ origin_zone_id: '', destination_zone_id: '', base_price: 0 }); setEditingPriceRule(null); await loadData() } catch (err) { setError(friendlyError(err, 'Tarife kaydedilemedi.')) }
  }
  async function saveExtra(e: FormEvent) {
    e.preventDefault(); const name = extraForm.name.trim(); const price = Number(extraForm.price)
    if (!name || name.length > 120 || !isFiniteNonNegative(price) || price > 100000000) return void fail('Ekstra adı ve 0–100.000.000 arası geçerli fiyat zorunludur.')
    try { editingExtra ? await db.update('extras', `?id=eq.${editingExtra}`, { ...extraForm, name, price }) : await db.insert('extras', { ...extraForm, name, price, is_active: true }); setExtraForm(emptyExtra); setEditingExtra(null); await loadData() } catch (err) { setError(friendlyError(err, 'Ekstra kaydedilemedi.')) }
  }
  async function updateStatus(id: string, status: string) { if (!statuses.includes(status as typeof statuses[number])) return void fail('Geçersiz rezervasyon durumu.'); try { await db.update('reservations', `?id=eq.${id}`, { status }); setReservations(items => items.map(r => r.id === id ? { ...r, status } : r)); setSelectedReservation(item => item?.id === id ? { ...item, status } : item) } catch (err) { setError(friendlyError(err, 'Durum güncellenemedi.')) } }
  async function remove(table: string, id: string) { if (table !== 'vehicles' && table !== 'zones' && table !== 'price_rules' && table !== 'extras') return; if (!window.confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return; try { await db.remove(table, `?id=eq.${id}`); await loadData() } catch (err) { setError(friendlyError(err, 'Kayıt silinemedi.')) } }
  if (!token) return <section className="admin-login section-wrap"><div className="admin-login-card"><p className="eyebrow">OPERASYON PANELİ</p><h2>Yönetici girişi</h2><p>Rezervasyonlarınızı ve tarife verilerinizi güvenli şekilde yönetin.</p><form onSubmit={login}><label>Kullanıcı adı<input name="username" type="email" required autoComplete="username" /></label><label>Parola<input name="password" type="password" required minLength={8} autoComplete="current-password" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" disabled={loading}>{loading ? 'Giriş yapılıyor…' : 'Giriş yap'} <LogIn size={17} /></button></form></div></section>
  const tabs = [['reservations', 'Rezervasyonlar'], ['vehicles', 'Araçlar'], ['zones', 'Bölgeler'], ['priceRules', 'Tarife tablosu'], ['extras', 'Ekstralar']]
  return <section className="admin-shell section-wrap"><div className="admin-head"><div><p className="eyebrow">OPERASYON PANELİ</p><h1>Hoş geldiniz, {username}</h1></div><div className="admin-actions"><button className="button button-outline" onClick={() => void loadData()} disabled={loading}><RefreshCw size={16} /> Yenile</button><button className="button button-outline" onClick={() => void logout()}><LogOut size={16} /> Çıkış</button></div></div>{error && <p className="form-error" role="alert">{error}</p>}<nav className="admin-tabs" aria-label="Yönetim bölümleri">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>{loading && <p className="admin-loading">Veriler yükleniyor…</p>}
    {tab === 'reservations' && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Kod</th><th>Müşteri</th><th>Tarih</th><th>Tutar</th><th>Durum</th><th></th></tr></thead><tbody>{reservations.length ? reservations.map(r => <tr key={r.id}><td data-label="Kod"><strong>{r.code}</strong><small>{r.service_type}</small></td><td data-label="Müşteri">{r.customer_name}<small>{r.customer_phone}</small></td><td data-label="Tarih">{new Date(r.pickup_at).toLocaleString('tr-TR')}</td><td data-label="Tutar">{Number(r.calculated_amount).toFixed(2)} QAR</td><td data-label="Durum"><select value={r.status} onChange={e => void updateStatus(r.id, e.target.value)}>{statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></td><td><button aria-label="Rezervasyon detayını gör" onClick={() => setSelectedReservation(r)}><Eye size={16} /></button></td></tr>) : <tr><td colSpan={6} className="empty-state">Henüz rezervasyon bulunmuyor.</td></tr>}</tbody></table>{selectedReservation && <div className="admin-detail"><button className="icon-button" aria-label="Detayı kapat" onClick={() => setSelectedReservation(null)}><X size={18} /></button><h2>Rezervasyon {selectedReservation.code}</h2><p>{selectedReservation.customer_name} · {selectedReservation.customer_email} · {selectedReservation.customer_phone}</p><p>{zones.find(z => z.id === selectedReservation.origin_zone_id)?.name || '—'} → {zones.find(z => z.id === selectedReservation.destination_zone_id)?.name || '—'}</p><p>{vehicles.find(v => v.id === selectedReservation.vehicle_id)?.model || 'Araç bilgisi yok'} · {new Date(selectedReservation.pickup_at).toLocaleString('tr-TR')}</p><p>{selectedReservation.passenger_count} yolcu · {selectedReservation.luggage_count} bagaj · {selectedReservation.flight_number || 'Uçuş no yok'}</p>{selectedReservation.customer_note && <p>Not: {selectedReservation.customer_note}</p>}</div>}</div>}
    {tab === 'vehicles' && <div className="admin-grid"><form className="admin-form" onSubmit={saveVehicle}><h2>{editingVehicle ? 'Aracı düzenle' : 'Yeni araç'}</h2><label>Model<input value={vehicleForm.model} onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })} required /></label><div className="form-row"><label>Yolcu kapasitesi<input type="number" min="1" value={vehicleForm.passenger_capacity} onChange={e => setVehicleForm({ ...vehicleForm, passenger_capacity: Number(e.target.value) })} required /></label><label>Bagaj kapasitesi<input type="number" min="0" value={vehicleForm.luggage_capacity} onChange={e => setVehicleForm({ ...vehicleForm, luggage_capacity: Number(e.target.value) })} required /></label></div><label>Fiyat çarpanı<input type="number" min="0.01" step="0.01" value={vehicleForm.multiplier} onChange={e => setVehicleForm({ ...vehicleForm, multiplier: Number(e.target.value) })} required /></label><label>Donanım <small>(virgülle ayırın)</small><input value={vehicleForm.equipment} onChange={e => setVehicleForm({ ...vehicleForm, equipment: e.target.value })} /></label><label>Görsel URL <small>(yalnızca https URL)</small><input type="url" pattern="https://.*" value={vehicleForm.image_url} onChange={e => setVehicleForm({ ...vehicleForm, image_url: e.target.value })} /></label><button className="button button-primary"><Save size={16} /> {editingVehicle ? 'Değişiklikleri kaydet' : 'Araç ekle'}</button>{editingVehicle && <button type="button" className="button button-outline" onClick={() => { setEditingVehicle(null); setVehicleForm(emptyVehicle) }}>İptal</button>}</form><div className="admin-list">{vehicles.length ? vehicles.map(v => <article className="admin-list-item" key={v.id}><div><strong>{v.model}</strong><small>{v.passenger_capacity} yolcu · {v.luggage_capacity} bagaj · ×{v.multiplier}</small></div><div><button aria-label="Düzenle" onClick={() => { setEditingVehicle(v.id); setVehicleForm({ ...v, equipment: v.equipment.join(', '), image_url: v.image_url || '' }) }}><Pencil size={16} /></button><button aria-label="Sil" onClick={() => void remove('vehicles', v.id)}><Trash2 size={16} /></button></div></article>) : <p className="empty-state">Henüz araç eklenmemiş.</p>}</div></div>}
    {tab === 'zones' && <div className="admin-grid"><form className="admin-form" onSubmit={saveZone}><h2>{editingZone ? 'Bölgeyi düzenle' : 'Yeni bölge'}</h2><label>Bölge adı<input value={zoneForm.name} onChange={e => setZoneForm({ name: e.target.value })} required /></label><button className="button button-primary"><Plus size={16} /> {editingZone ? 'Kaydet' : 'Bölge ekle'}</button>{editingZone && <button type="button" className="button button-outline" onClick={() => { setEditingZone(null); setZoneForm({ name: '' }) }}>İptal</button>}</form><div className="admin-list">{zones.length ? zones.map(z => <article className="admin-list-item" key={z.id}><strong>{z.name}</strong><div><button aria-label="Düzenle" onClick={() => { setEditingZone(z.id); setZoneForm({ name: z.name }) }}><Pencil size={16} /></button><button aria-label="Sil" onClick={() => void remove('zones', z.id)}><Trash2 size={16} /></button></div></article>) : <p className="empty-state">Henüz bölge eklenmemiş.</p>}</div></div>}
    {tab === 'priceRules' && <div className="admin-grid"><form className="admin-form" onSubmit={savePriceRule}><h2>{editingPriceRule ? 'Tarifeyi düzenle' : 'Yeni tarife'}</h2><label>Kalkış bölgesi<select value={priceForm.origin_zone_id} onChange={e => setPriceForm({ ...priceForm, origin_zone_id: e.target.value })} required><option value="">Seçin</option>{zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label><label>Varış bölgesi<select value={priceForm.destination_zone_id} onChange={e => setPriceForm({ ...priceForm, destination_zone_id: e.target.value })} required><option value="">Seçin</option>{zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label><label>Taban fiyat<input type="number" min="0" step="0.01" value={priceForm.base_price} onChange={e => setPriceForm({ ...priceForm, base_price: Number(e.target.value) })} required /></label><button className="button button-primary"><Plus size={16} /> {editingPriceRule ? 'Kaydet' : 'Tarife ekle'}</button>{editingPriceRule && <button type="button" className="button button-outline" onClick={() => { setEditingPriceRule(null); setPriceForm({ origin_zone_id: '', destination_zone_id: '', base_price: 0 }) }}>İptal</button>}</form><div className="admin-list">{priceRules.length ? priceRules.map(rule => <article className="admin-list-item" key={rule.id}><div><strong>{zones.find(z => z.id === rule.origin_zone_id)?.name || '—'} → {zones.find(z => z.id === rule.destination_zone_id)?.name || '—'}</strong><small>{Number(rule.base_price).toFixed(2)} QAR</small></div><div><button aria-label="Düzenle" onClick={() => { setEditingPriceRule(rule.id); setPriceForm({ origin_zone_id: rule.origin_zone_id, destination_zone_id: rule.destination_zone_id, base_price: Number(rule.base_price) }) }}><Pencil size={16} /></button><button aria-label="Sil" onClick={() => void remove('price_rules', rule.id)}><Trash2 size={16} /></button></div></article>) : <p className="empty-state">Henüz tarife tanımlanmamış.</p>}</div></div>}
    {tab === 'extras' && <div className="admin-grid"><form className="admin-form" onSubmit={saveExtra}><h2>{editingExtra ? 'Ekstrayı düzenle' : 'Yeni ekstra'}</h2><label>Ekstra adı<input value={extraForm.name} onChange={e => setExtraForm({ ...extraForm, name: e.target.value })} required /></label><label>Fiyat<input type="number" min="0" step="0.01" value={extraForm.price} onChange={e => setExtraForm({ ...extraForm, price: Number(e.target.value) })} required /></label><label>Tip<select value={extraForm.extra_type} onChange={e => setExtraForm({ ...extraForm, extra_type: e.target.value })}><option value="child_seat">Çocuk koltuğu</option><option value="welcome_sign">Karşılama tabelası</option><option value="waiting_hour">Ek bekleme saati</option><option value="extra_stop">Ek durak</option><option value="other">Diğer</option></select></label><button className="button button-primary"><Plus size={16} /> {editingExtra ? 'Kaydet' : 'Ekstra ekle'}</button>{editingExtra && <button type="button" className="button button-outline" onClick={() => { setEditingExtra(null); setExtraForm(emptyExtra) }}>İptal</button>}</form><div className="admin-list">{extras.length ? extras.map(x => <article className="admin-list-item" key={x.id}><div><strong>{x.name}</strong><small>{Number(x.price).toFixed(2)} QAR · {x.extra_type}</small></div><div><button aria-label="Düzenle" onClick={() => { setEditingExtra(x.id); setExtraForm({ name: x.name, price: Number(x.price), extra_type: x.extra_type }) }}><Pencil size={16} /></button><button aria-label="Sil" onClick={() => void remove('extras', x.id)}><Trash2 size={16} /></button></div></article>) : <p className="empty-state">Henüz ekstra eklenmemiş.</p>}</div></div>}
  </section>
}
