import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Cins, Ekran, Form, Mesaj, Ortam, Sohbet } from '../types'
import { avatar, avatarRaster, avatarSvg } from './avatar'
import { sohbetSvg } from './sohbetSvg'

// ask.sh — Claude Code içinden anonim tanışma.
// GÜVENLİK: karşı tarafın yazdığı hiçbir şey modele gitmez. Mesajlar sadece panelde görünür;
// bildirimlerde mesajın kendisi yoktur; komut çıktıları isTextDisplayOnly ile işaretlidir.
// Aynı anda birden fazla kişiyle konuşulabilir; iki taraf da isterse sohbet kalıcı olur.

const VARSAYILAN_SUNUCU = 'https://ask.oktaydak.com'
// plugin.json'daki sürümle aynı olmalı.
const SURUM = '0.7.3'
// Kurar ya da günceller ve otomatik güncellemeyi açar.
const GUNCELLEME_KOMUTU = 'curl -fsSL https://ask.oktaydak.com/kur.sh | sh'
// Çalışan Claude Code: zengin görünüm için en az ZENGIN_SURUM gerekir (Text weight/size, Input rows...).
const ZENGIN_SURUM = '2.1.328'
const PANEL = 'asksh'
const BASLIK = 'ask.sh'
const RUMUZ = /^[\p{L}\p{N}_.-]{2,20}$/u
const RUMUZ_UYARI = 'Rumuz 2–20 karakter olabilir; harf, rakam ve _ . - kullanabilirsin.'
const TURUNCU = '#ff5b14'
// Cinsiyet renkleri: kadın pembe, erkek mavi; söylemek istemeyen kendi avatar renginde.
const PEMBE = '#ec4899'
const MAVI = '#3b82f6'
function kisiRenk(rumuz: string, cins?: string): string {
  return cins === 'k' ? PEMBE : cins === 'e' ? MAVI : avatar(rumuz).renk
}
const GRI_CIZGI = '#4a4a47'
const GRI_BALON = '#3a3a3f'
const GRI_BALON_YAZI = '#f1f1f3'
const BAGLANTI_UYARI = 'Bağlantıda bir sorun var, tekrar deniyoruz…'

const ALAN_AD: Record<string, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  mobil: 'Mobil',
  oyun: 'Oyun',
  veri: 'Veri',
  devops: 'DevOps',
  tasarim: 'Tasarım',
  ogreniyorum: 'Öğreniyor',
}
const RUH_AD: Record<string, string> = {
  deploy: 'deploy bekliyor',
  gece: 'gece mesaisinde',
  bug: 'bug kovalıyor',
  mola: 'molada',
  ogreniyorum: 'yeni bir şey öğreniyor',
  toplanti: 'toplantıdan kaçmış',
}

const BOS_EKRAN: Ekran = {
  durum: 'ana',
  sirada: false,
  sohbetler: [],
  aktif: null,
  cevrimici: 0,
  uyari: '',
  yazSayac: 0,
  taslak: '',
  guncelleme: null,
  liste: null,
  bildirForm: null,
}
const ekran = atom({ plugin: 'asksh', key: 'ekran' } as const, BOS_EKRAN, { shape: 'ekran-2' })
const ortam = atom({ plugin: 'asksh', key: 'ortam' } as const, { zengin: false, surum: '' } as Ortam, { shape: 'ortam-1' })
const form = atom({ plugin: 'asksh', key: 'form' } as const, { rumuz: '', ben: 'x', ara: 'x', alan: '', ruh: '', adim: 0 } as Form, {
  shape: 'form-3',
})

type Profil = { rumuz: string; ben: Cins; ara: Cins; alan?: string; ruh?: string }
type E = EngineInterface

// Kontrol karakterlerini (ANSI kaçışları dahil) at.
const temiz = (s: unknown) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, '')

let durdur: { cancel: () => void } | null = null
let yokluyor = false
let sonYaziyor = 0
let siradakiYerel = -1
// Her sohbette okunan son mesaj numarası; kalıcı (yeni oturumda okunmuşlar okunmamış sayılmasın).
let okundu: Record<string, number> | null = null
const fotoIstekBildirildi = new Set<string>()
let ilkIsle = true
// Masaüstü tuvali: bir mesajın süzülerek belirip belirmeyeceği ilk görüldüğünde bir kez seçilir.
const canlanma = new Map<string, boolean>()
function canlanmali(oda: string, m: { kim: string; at: number }) {
  const k = `${oda}:${m.kim}:${m.at}`
  let v = canlanma.get(k)
  if (v === undefined) {
    if (canlanma.size > 3000) canlanma.clear()
    v = Date.now() - m.at < 3500
    canlanma.set(k, v)
  }
  return v
}

// ---------- kimlik ve sunucu ----------
// Her pencere bir "profil yuvası" kullanır; varsayılan hepsinde ortak. /date profil <ad> o pencereyi ayırır.
async function yuva($: E): Promise<string> {
  const id = await $.session.id()
  return String((await $.store.get('yuva:' + id)) || 'varsayilan')
}
async function anahtar($: E, ad: string): Promise<string> {
  const y = await yuva($)
  return y === 'varsayilan' ? ad : `${ad}@${y}`
}

const sunucu = async ($: E) => String((await $.store.get(await anahtar($, 'sunucu'))) || VARSAYILAN_SUNUCU)

async function api($: E, yol: string, govde?: unknown): Promise<any> {
  let token = (await $.store.get(await anahtar($, 'token'))) as string | undefined
  const taban = await sunucu($)
  if (!token) {
    const r = await $.http.fetch(taban + '/api/kimlik', { method: 'POST', body: '{}' })
    token = JSON.parse(r.text).token as string
    await $.store.set(await anahtar($, 'token'), token)
  }
  const r = await $.http.fetch(taban + yol, {
    method: govde === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, 'x-asksh-surum': SURUM },
    body: govde === undefined ? undefined : JSON.stringify(govde),
  })
  let veri: any = {}
  try {
    veri = JSON.parse(r.text)
  } catch {}
  if (r.status === 426) {
    yoklamayiDurdur($)
    await update($, ekran, (e: Ekran) => ({ ...e, guncelleme: { durum: 'zorunlu' as const, son: String(veri.son || ''), komut: String(veri.komut || GUNCELLEME_KOMUTU) } }))
  }
  if (!r.ok) throw new Error(veri.hata || `HTTP ${r.status}`)
  return veri
}

function surumKarsilastir(a: string, b: string): number {
  const x = a.split('.').map(n => parseInt(n, 10) || 0)
  const y = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0) ? -1 : 1
  return 0
}

// Yayındaki sürümü sorar: daha yenisi varsa panelde şerit, desteklenmiyorsa güncelleme ekranı.
async function surumKontrol($: E) {
  try {
    const r = await $.http.fetch((await sunucu($)) + '/api/surum')
    if (!r.ok) return
    const v = JSON.parse(r.text) as { son: string; enAz: string; komut?: string }
    const komut = v.komut || GUNCELLEME_KOMUTU
    const durum: 'zorunlu' | 'var' | null = surumKarsilastir(SURUM, v.enAz) < 0 ? 'zorunlu' : surumKarsilastir(SURUM, v.son) < 0 ? 'var' : null
    await update($, ekran, (e: Ekran) => ({ ...e, guncelleme: durum ? { durum, son: v.son, komut } : null }))
    if (durum === 'zorunlu') yoklamayiDurdur($)
  } catch {}
}

const profil = async ($: E) => (await $.store.get(await anahtar($, 'profil'))) as Profil | undefined

// ---------- sunucudan gelen durumu ekrana işle ----------
function okunmamisToplam(e: Ekran): number {
  return e.sohbetler.reduce((t, s) => t + s.okunmamis, 0)
}

function durumSatiri($: E, e: Ekran) {
  const okunmamis = okunmamisToplam(e)
  $.ui.status(
    okunmamis > 0
      ? `💬 ${okunmamis} okunmamış`
      : e.sirada
        ? '⏳ ask.sh aranıyor'
        : e.sohbetler.some(s => !s.bitti)
          ? `💬 ask.sh · ${e.sohbetler.filter(s => !s.bitti).length} sohbet`
          : undefined,
  )
}

async function okunduYukle($: E): Promise<Record<string, number>> {
  if (!okundu) okundu = ((await $.store.get(await anahtar($, 'okundu'))) as Record<string, number>) || {}
  return okundu
}
async function okunduKaydet($: E) {
  if (okundu) await $.store.set(await anahtar($, 'okundu'), okundu).catch(() => {})
}

async function isle($: E, d: any) {
  // Kullanıcı bilgilerini düzenlerken sunucudan gelen durum ekranı değiştirmesin.
  if ((await read($, ekran)).durum === 'kurulum') return
  const ok = await okunduYukle($)
  const ilk = ilkIsle
  ilkIsle = false
  const yeniEslesme: string[] = []
  const yeniMesaj: { rumuz: string; adet: number }[] = []
  const biten: { rumuz: string; neden?: string }[] = []
  const simdi = Date.now()
  await update($, ekran, (e: Ekran) => {
    const eskiler = new Map(e.sohbetler.map(s => [s.id, s]))
    const sohbetler: Sohbet[] = (d.sohbetler || []).map((g: any): Sohbet => {
      const eski = eskiler.get(g.id)
      const gelen: Mesaj[] = (g.mesajlar || [])
        .filter((m: Mesaj) => !eski || m.n > eski.son)
        .map((m: Mesaj) => ({ n: m.n, kim: m.kim, metin: temiz(m.metin), at: m.at, ...(m.foto ? { foto: m.foto } : {}) }))
      // Sunucudan gelen kendi mesajlarımız, iyimser olarak eklediklerimizin yerini alır.
      const bizimkiler = new Set(gelen.filter(m => m.kim === 'ben').map(m => m.metin))
      const onceki = (eski?.mesajlar ?? []).filter(m => !(m.n < 0 && m.durum !== 'hata' && bizimkiler.has(m.metin)))
      const gelenO = gelen.filter(m => m.kim === 'o').length
      const karsi = { rumuz: temiz(g.karsi?.rumuz), cins: String(g.karsi?.cins || 'x'), alan: String(g.karsi?.alan || ''), ruh: String(g.karsi?.ruh || '') }
      if (!eski) yeniEslesme.push(karsi.rumuz)
      if (gelenO && e.aktif !== g.id) yeniMesaj.push({ rumuz: karsi.rumuz, adet: gelenO })
      if (eski && !eski.bitti && g.bitti && !g.bitti.ben) biten.push({ rumuz: karsi.rumuz, neden: g.bitti.neden })
      const aktifMi = e.aktif === g.id
      return {
        id: g.id,
        karsi,
        mesajlar: [...onceki, ...gelen].slice(-200).map(m => {
          const f = (g.fotolar || []).find((x: any) => x.n === m.n)
          return f && m.foto ? { ...m, foto: { ...m.foto, durum: f.durum } } : m
        }),
        son: Math.max(eski?.son ?? 0, ...gelen.map(m => m.n), 0),
        bitti: g.bitti ?? null,
        kalici: !!g.kalici,
        kalBen: !!g.kalBen,
        kalO: !!g.kalO,
        karsiCevrimici: !!g.karsiCevrimici,
        karsiYaziyor: !!g.karsiYaziyor,
        puanBen: g.puanBen ?? null,
        fotoBenden: String(g.fotoBenden || 'sor'),
        fotoOndan: String(g.fotoOndan || 'sor'),
        fotoIstekGeldi: !!g.fotoIstekGeldi,
        fotoIstekGitti: !!g.fotoIstekGitti,
        okunmamis: (() => {
          const mesajlar = [...onceki, ...gelen]
          const son = Math.max(eski?.son ?? 0, ...gelen.map(m => m.n), 0)
          // Bu sürümle ilk açılışta kaydı olmayan eski sohbetleri okunmuş say; açık sohbet hep okunmuş.
          if (aktifMi || (ok[g.id] === undefined && ilk && eski === undefined && g.mesajlar?.length)) ok[g.id] = son
          return mesajlar.filter(m => m.kim === 'o' && m.n > (ok[g.id] ?? 0)).length
        })(),
        eslesme: eski?.eslesme ?? simdi,
      }
    })
    const aktif = e.aktif && sohbetler.some(s => s.id === e.aktif) ? e.aktif : null
    return {
      ...e,
      durum: 'ana' as const,
      sirada: !!d.sirada,
      fotoAl: String(d.fotoAl || e.fotoAl || 'sor'),
      sohbetler,
      aktif,
      cevrimici: d.cevrimici ?? e.cevrimici,
      bildirForm: aktif ? e.bildirForm : null,
      // Sadece bağlantı uyarısını temizle; kullanıcıya verilen uyarılar dursun.
      uyari: e.uyari === BAGLANTI_UYARI ? '' : e.uyari,
    }
  })
  await okunduKaydet($)
  const e = await read($, ekran)
  // Sistem bildirimleri (başka sekmedeyken de görünür)
  for (const x of e.sohbetler) {
    if (yeniEslesme.includes(x.karsi.rumuz) && (await birKez($, 'es:' + x.id))) void sistemBildirimi($, 'ask.sh', `👋 ${x.karsi.rumuz} ile eşleştin`)
    const sonO = [...x.mesajlar].reverse().find(m => m.kim === 'o')
    if (sonO && x.okunmamis > 0 && x.id !== e.aktif && (await birKez($, `m:${x.id}:${sonO.n}`)))
      void sistemBildirimi($, 'ask.sh', `💬 ${x.karsi.rumuz} ${x.okunmamis > 1 ? `${x.okunmamis} mesaj` : 'yeni mesaj'} gönderdi`)
    if (x.fotoIstekGeldi && (await birKez($, 'fi:' + x.id))) void sistemBildirimi($, 'ask.sh', `📷 ${x.karsi.rumuz} sana fotoğraf göndermek istiyor`)
    if (!x.kalici && x.kalO && !x.kalBen && (await birKez($, 'kal:' + x.id))) void sistemBildirimi($, 'ask.sh', `★ ${x.karsi.rumuz} bağlantıda kalmak istiyor`)
  }
  for (const rumuz of yeniEslesme) {
    // Klavyeyi çalmıyoruz: Claude'a yazarken yanlışlıkla yabancıya yazılmasın.
    void $.ui.open({ id: PANEL, title: BASLIK }).catch(() => {})
    $.ui.toast(`👋 ${rumuz} ile eşleştin · panele geçmek için ctrl+x tab`)
  }
  for (const x of e.sohbetler) {
    if (x.fotoIstekGeldi && !fotoIstekBildirildi.has(x.id)) {
      fotoIstekBildirildi.add(x.id)
      $.ui.toast(`📷 ${x.karsi.rumuz} sana fotoğraf göndermek istiyor`)
    }
  }
  // Ekran paylaşırken okunmasın: bildirimlerde mesajın kendisi yok.
  for (const y of yeniMesaj) $.ui.toast(`💬 ${y.rumuz} ${y.adet > 1 ? `${y.adet} mesaj` : 'yeni mesaj'} gönderdi`)
  for (const b of biten) $.ui.toast(ayrilis(b.rumuz, b.neden))
  durumSatiri($, e)
  if (!e.sirada && e.sohbetler.length === 0) yoklamayiDurdur($)
}

// Karşı tarafa nedenini açık etmeden, sıcak bir dille söyle (engellendiğini bilmesin).
function ayrilis(rumuz: string, neden: string | undefined): string {
  if (neden === 'bağlantısı koptu') return `${rumuz} ile bağlantı koptu.`
  return `${rumuz} sohbetten ayrıldı.`
}

// İşletim sistemi bildirimi: başka bir sekmede ya da uygulamadayken de görünsün.
// Linux notify-send, macOS osascript; ikisi de yoksa Claude'un kendi bildirimi. Mesajın kendisi yazılmaz.
async function sistemBildirimi($: E, baslik: string, metin: string) {
  if ((await read($, ekran)).bildirimKapali) return
  let r = { exitCode: 1 } as { exitCode: number }
  try {
    r = await $.process.run(
      [
        'sh',
        '-c',
        'if command -v notify-send >/dev/null 2>&1; then notify-send -a ask.sh "$1" "$2"; ' +
          'elif command -v osascript >/dev/null 2>&1; then osascript -e "on run argv" -e "display notification (item 2 of argv) with title (item 1 of argv)" -e "end run" "$1" "$2"; ' +
          'else exit 3; fi',
        'sh',
        baslik,
        metin,
      ],
      { timeoutMs: 5000 },
    )
  } catch {}
  if (r.exitCode !== 0) void $.ui.notify(metin, { title: baslik }).catch(() => {})
}

// Aynı olay için birden çok Claude penceresi bildirim göndermesin (pencereler ortak depoyu paylaşır).
async function birKez($: E, olay: string): Promise<boolean> {
  const k = await anahtar($, 'bildirilen')
  const kayit = ((await $.store.get(k)) as Record<string, number>) || {}
  if (kayit[olay]) return false
  const simdi = Date.now()
  for (const [x, t] of Object.entries(kayit)) if (simdi - t > 86_400_000) delete kayit[x]
  kayit[olay] = simdi
  await $.store.set(k, kayit)
  return true
}

async function uyar($: E, metin: string) {
  await update($, ekran, (e: Ekran) => ({ ...e, uyari: metin }))
}

// ---------- yoklama ----------
async function yokla($: E) {
  if (yokluyor) return
  yokluyor = true
  try {
    const e = await read($, ekran)
    const imlec = e.sohbetler.map(s => `${s.id}:${s.son}`).join(',')
    await isle($, await api($, '/api/durum' + (imlec ? '?son=' + imlec : '')))
  } catch {
    await uyar($, BAGLANTI_UYARI)
  } finally {
    yokluyor = false
  }
}

async function yoklamayiBaslat($: E) {
  await $.store.set(await anahtar($, 'aktif'), true)
  if (durdur) return
  durdur = $.clock.every(2500, () => void yokla($))
}

function yoklamayiDurdur($: E) {
  durdur?.cancel()
  durdur = null
  void anahtar($, 'aktif')
    .then(k => $.store.set(k, false))
    .catch(() => {})
}

// ---------- eylemler ----------
async function sirayaGir($: E) {
  const p = await profil($)
  if (!p) {
    await update($, ekran, (e: Ekran) => ({ ...e, durum: 'kurulum' as const }))
    return
  }
  await update($, ekran, (e: Ekran) => ({ ...e, durum: 'ana' as const, sirada: true, aktif: null, liste: null, uyari: '' }))
  $.ui.status('⏳ ask.sh aranıyor')
  await isle($, await api($, '/api/kuyruk', { ...p, yas18: true }))
  await yoklamayiBaslat($)
}

async function siradanCik($: E) {
  await isle($, await api($, '/api/sira-cik', {}))
}

// Kendi taslağında telefon, e-posta, link ya da kullanıcı adı varsa göndermeden önce bir kez uyar.
const KISISEL: [RegExp, string][] = [
  [/(\+?\d[\d\s().-]{8,}\d)/, 'bir telefon numarasına'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, 'bir e-posta adresine'],
  [/(https?:\/\/|www\.)\S+/i, 'bir linke'],
  [/(^|\s)@[\w.]{3,}/, 'bir kullanıcı adına'],
]

function sohbetGuncelle(e: Ekran, id: string, fn: (s: Sohbet) => Sohbet): Ekran {
  return { ...e, sohbetler: e.sohbetler.map(s => (s.id === id ? fn(s) : s)) }
}

async function gonder($: E, oda: string, metin: string) {
  const m = temiz(metin).trim()
  if (!m || !oda) return
  const d0 = await read($, ekran)
  const kisisel = KISISEL.find(([r]) => r.test(m))
  if (kisisel && d0.kisiselOnay !== m) {
    await update($, ekran, (e: Ekran) => ({
      ...e,
      kisiselOnay: m,
      uyari: `Bu ${kisisel[1]} benziyor. Emin misin? Yine de göndermek için tekrar Gönder'e bas.`,
    }))
    return
  }
  const yerel = siradakiYerel--
  await update($, ekran, (e: Ekran) => ({
    ...sohbetGuncelle(e, oda, s => ({
      ...s,
      mesajlar: [...s.mesajlar, { n: yerel, kim: 'ben' as const, metin: m, at: Date.now(), durum: 'gidiyor' as const }].slice(-200),
    })),
    yazSayac: e.yazSayac + 1,
    taslak: '',
    kisiselOnay: '',
    uyari: '',
    sabitN: null,
  }))
  try {
    const r = await api($, '/api/mesaj', { oda, metin: m })
    await update($, ekran, (e: Ekran) =>
      sohbetGuncelle(e, oda, s => ({
        ...s,
        mesajlar: s.mesajlar.map(x => (x.n === yerel ? { n: r.n, kim: 'ben' as const, metin: m, at: x.at } : x)),
        son: Math.max(s.son, r.n),
      })),
    )
  } catch (err: any) {
    await update($, ekran, (e: Ekran) => ({
      ...sohbetGuncelle(e, oda, s => ({ ...s, mesajlar: s.mesajlar.map(x => (x.n === yerel ? { ...x, durum: 'hata' as const } : x)) })),
      uyari: /yavaş|bitti/i.test(String(err?.message)) ? String(err.message) : 'Bağlantı koptu, mesajın gitmedi. Tekrar yazıp gönderebilirsin.',
    }))
  }
}

// Yazarken karşı tarafa "yazıyor…" gider; en fazla 3 saniyede bir.
function yaziyorBildir($: E, oda: string | null) {
  const simdi = Date.now()
  if (!oda || simdi - sonYaziyor < 3000) return
  sonYaziyor = simdi
  void api($, '/api/yaziyor', { oda }).catch(() => {})
}

// Tekerlek / ok tuşları: panel değil, yalnızca mesajlar kayar. by < 0 yukarı (eskiye).
async function mesajKaydir($: E, by: number) {
  const d = await read($, ekran)
  const s = d.sohbetler.find(x => x.id === d.aktif)
  if (!s || !s.mesajlar.length) return
  const son = s.mesajlar.length - 1
  let i = d.sabitN == null ? son : s.mesajlar.findIndex(m => m.n >= d.sabitN!)
  if (i < 0) i = son
  const adim = Math.sign(by) * Math.max(1, Math.round(Math.abs(by) / 2))
  i = Math.min(son, Math.max(0, i + adim))
  const yeni = i >= son ? null : s.mesajlar[i].n
  if (yeni !== (d.sabitN ?? null)) await update($, ekran, (e: Ekran) => ({ ...e, sabitN: yeni }))
}

async function sohbetAc($: E, oda: string | null) {
  const ok = await okunduYukle($)
  const s = (await read($, ekran)).sohbetler.find(x => x.id === oda)
  if (oda && s) {
    ok[oda] = s.son
    await okunduKaydet($)
  }
  await update($, ekran, (e: Ekran) => ({
    ...(oda ? sohbetGuncelle(e, oda, s => ({ ...s, okunmamis: 0 })) : e),
    aktif: oda,
    bildirForm: null,
    kisiselOnay: '',
    uyari: '',
    sabitN: null,
  }))
  durumSatiri($, await read($, ekran))
}

type Eylem = 'bitir' | 'engelle' | 'sikayet' | 'kapat'
async function eylem($: E, ad: Eylem, oda: string, neden = '') {
  const s = (await read($, ekran)).sohbetler.find(x => x.id === oda)
  const kim = s?.karsi.rumuz ?? 'Bu kişi'
  await api($, '/api/' + ad, ad === 'sikayet' ? { oda, neden } : { oda })
  // Engellenen, bildirilen, kapatılan ya da silinen bağlantı ekrandan hemen kalkar.
  await update($, ekran, (e: Ekran) => ({
    ...e,
    sohbetler: e.sohbetler.filter(x => x.id !== oda),
    aktif: e.aktif === oda ? null : e.aktif,
    bildirForm: null,
    yazSayac: e.yazSayac + 1,
    uyari:
      ad === 'engelle'
        ? `${kim} engellendi. Bir daha karşılaşmayacaksınız.`
        : ad === 'sikayet'
          ? `Bildirdin. ${kim} ile bir daha eşleşmeyeceksin. Teşekkürler.`
          : ad === 'bitir' && s?.kalici
            ? `${kim} ile bağlantını sildin.`
            : ad === 'bitir' && s?.bitti
              ? `${kim} ile konuşma silindi.`
              : ad === 'bitir'
                ? `${kim} ile sohbetten ayrıldın. O da ayrılınca konuşma silinecek.`
                : ad === 'kapat'
                  ? `${kim} ile konuşma silindi.`
                  : '',
  }))
  const e = await read($, ekran)
  durumSatiri($, e)
  if (!e.sirada && e.sohbetler.length === 0) yoklamayiDurdur($)
}

async function kalIstegi($: E, oda: string) {
  const s = (await read($, ekran)).sohbetler.find(x => x.id === oda)
  if (!s) return
  const r = await api($, '/api/kal', { oda, istek: !s.kalBen })
  await update($, ekran, (e: Ekran) =>
    sohbetGuncelle(e, oda, x => ({ ...x, kalBen: !s.kalBen, kalici: !!r.kalici, bitti: r.kalici ? null : x.bitti })),
  )
  if (r.kalici) $.ui.toast(`★ ${s.karsi.rumuz} ile bağlantıdasınız. Sohbetiniz kalıcı.`)
}

// ---------- fotoğraf ----------
const FOTO_SINIR = 116_000 // base64; sunucunun sınırının biraz altı

async function calistir($: E, argv: string[]) {
  try {
    return await $.process.run(argv, { timeoutMs: 30_000 })
  } catch {
    return { exitCode: 127, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
  }
}

// Panodaki ekran görüntüsünü ya da verilen dosyayı küçültür, içindeki bütün bilgileri
// (GPS konumu dahil) siler ve base64 JPEG olarak verir. ffmpeg, sips (macOS) ya da ImageMagick kullanır.
async function fotoHazirla($: E, kaynak: string): Promise<{ b64: string; tur: string }> {
  const gecici = (await calistir($, ['mktemp', '-d'])).stdout.trim()
  if (!gecici) throw new Error('Geçici klasör açılamadı.')
  try {
    let girdi = kaynak.replace(/^~(?=\/)/, (await calistir($, ['sh', '-c', 'printf %s "$HOME"'])).stdout.trim())
    if (kaynak === 'pano') {
      girdi = gecici + '/pano.png'
      const r = await calistir($, [
        'sh',
        '-c',
        'xclip -selection clipboard -t image/png -o > "$1" 2>/dev/null || wl-paste --type image/png > "$1" 2>/dev/null || pngpaste "$1" 2>/dev/null; test -s "$1"',
        'sh',
        girdi,
      ])
      if (r.exitCode !== 0) throw new Error('Panoda bir görüntü yok. Önce ekran görüntüsü al ya da bir resim kopyala.')
    } else if (!(await $.fs.exists(girdi))) throw new Error('Bu yolda bir dosya yok: ' + kaynak)
    const cikti = gecici + '/foto.jpg'
    for (const [en, q] of [[960, 5], [720, 6], [560, 7], [420, 9], [320, 12]] as const) {
      let r = await calistir($, ['ffmpeg', '-loglevel', 'error', '-y', '-i', girdi, '-vf', `scale='min(${en},iw)':-2`, '-map_metadata', '-1', '-q:v', String(q), cikti])
      if (r.exitCode !== 0) r = await calistir($, ['magick', girdi, '-auto-orient', '-strip', '-resize', `${en}x${en}>`, '-quality', String(90 - q * 4), cikti])
      if (r.exitCode !== 0) r = await calistir($, ['convert', girdi, '-auto-orient', '-strip', '-resize', `${en}x${en}>`, '-quality', String(90 - q * 4), cikti])
      if (r.exitCode !== 0) r = await calistir($, ['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', String(90 - q * 4), '-Z', String(en), girdi, '--out', cikti])
      if (r.exitCode !== 0) throw new Error('Fotoğrafı hazırlamak için ffmpeg ya da ImageMagick gerekiyor (macOS’ta sips yeterli).')
      const okunan = (await $.fs.read(cikti, { as: 'bytes' } as any)) as any
      const b64 = String(okunan?.base64 ?? '')
      if (b64 && b64.length <= FOTO_SINIR) return { b64, tur: 'jpeg' }
    }
    throw new Error('Fotoğraf küçültülemedi; daha küçük bir resim dene.')
  } finally {
    void calistir($, ['rm', '-rf', gecici])
  }
}

async function fotoIzinIste($: E, oda: string) {
  const r = await api($, '/api/foto-istek', { oda })
  await update($, ekran, (e: Ekran) => ({
    ...sohbetGuncelle(e, oda, x => ({ ...x, fotoIstekGitti: r.izin !== 'evet', fotoOndan: r.izin === 'evet' ? 'evet' : x.fotoOndan })),
    fotoForm: r.izin === 'evet' ? { oda, mod: 'tek' as const } : e.fotoForm,
    uyari: r.izin === 'evet' ? '' : 'İsteğin gitti. Kabul ederse fotoğraf gönderebileceksin.',
  }))
}

async function fotoIzinVer($: E, oda: string, izin: 'evet' | 'hayir') {
  await api($, '/api/foto-izin', { oda, izin })
  await update($, ekran, (e: Ekran) => sohbetGuncelle(e, oda, x => ({ ...x, fotoBenden: izin, fotoIstekGeldi: false })))
}

async function fotoAyari($: E, al: 'sor' | 'hayir') {
  await api($, '/api/foto-ayar', { al })
  await update($, ekran, (e: Ekran) => ({ ...e, fotoAl: al, uyari: al === 'hayir' ? 'Artık kimseden fotoğraf almıyorsun.' : 'Fotoğraf istekleri yine sorulacak.' }))
}

async function fotoGonder($: E, oda: string, mod: 'tek' | 'kalici', kaynak: string) {
  await uyar($, 'Fotoğraf hazırlanıyor…')
  const { b64, tur } = await fotoHazirla($, kaynak)
  const r = await api($, '/api/foto', { oda, b64, tur, mod })
  await update($, ekran, (e: Ekran) => ({
    ...sohbetGuncelle(e, oda, x => ({
      ...x,
      mesajlar: [...x.mesajlar, { n: r.n, kim: 'ben' as const, metin: mod === 'tek' ? '📷 Tek gösterimlik fotoğraf' : '📷 Fotoğraf', at: Date.now(), foto: r.foto }].slice(-200),
      son: Math.max(x.son, r.n),
    })),
    fotoForm: null,
    uyari: mod === 'tek' ? 'Tek gösterimlik fotoğraf gönderildi. Açınca silinecek.' : 'Fotoğraf gönderildi.',
  }))
}

// Fotoğrafı aç. Masaüstünde panelde görüntüleyici; terminalde bilgisayarın resim görüntüleyicisi.
async function fotoAc($: E, oda: string, id: string, terminal: boolean) {
  const f = await api($, `/api/foto?oda=${encodeURIComponent(oda)}&id=${encodeURIComponent(id)}`)
  await update($, ekran, (e: Ekran) =>
    sohbetGuncelle(e, oda, x => ({ ...x, mesajlar: x.mesajlar.map(m => (m.foto?.id === id && f.mod === 'tek' ? { ...m, foto: { ...m.foto, durum: 'goruldu' as const } } : m)) })),
  )
  if (!terminal) {
    await update($, ekran, (e: Ekran) => ({ ...e, fotoGoster: { oda, id, tur: f.tur, b64: f.b64, mod: f.mod } }))
    return
  }
  const gecici = (await calistir($, ['mktemp', '-d'])).stdout.trim()
  const yol = `${gecici}/asksh-${id}.jpg`
  await calistir($, ['sh', '-c', 'printf %s "$1" | base64 -d > "$2" 2>/dev/null || printf %s "$1" | base64 -D > "$2"', 'sh', f.b64, yol])
  const ac = await calistir($, ['sh', '-c', '(xdg-open "$1" || open "$1") >/dev/null 2>&1 &', 'sh', yol])
  if (ac.exitCode !== 0) throw new Error('Fotoğraf açılamadı.')
  // Tek gösterimlik fotoğrafın dosyası bir dakika sonra silinir.
  $.clock.after(f.mod === 'tek' ? 60_000 : 600_000, () => void calistir($, ['rm', '-rf', gecici]))
  await uyar($, f.mod === 'tek' ? '🔥 Tek gösterimlik fotoğraf açıldı; bir dakika sonra bilgisayarından da silinecek.' : 'Fotoğraf açıldı.')
}

async function puanVer($: E, oda: string, puan: 'iyi' | 'kotu') {
  await api($, '/api/degerlendir', { oda, puan })
  await update($, ekran, (e: Ekran) => sohbetGuncelle(e, oda, x => ({ ...x, puanBen: puan })))
}

// Ayrıl: sıradan çık, sıradan sohbetleri bitir; kalıcı bağlantılar durur.
async function ayril($: E) {
  await api($, '/api/cik', {}).catch(() => {})
  await update($, ekran, (e: Ekran) => ({
    ...e,
    sirada: false,
    sohbetler: e.sohbetler.filter(s => s.kalici),
    aktif: e.sohbetler.find(s => s.id === e.aktif)?.kalici ? e.aktif : null,
    uyari: '',
  }))
  const e = await read($, ekran)
  durumSatiri($, e)
  if (e.sohbetler.length === 0) yoklamayiDurdur($)
}

async function engelleriAc($: E) {
  const r = await api($, '/api/engeller')
  await update($, ekran, (e: Ekran) => ({ ...e, liste: r.engeller ?? [], uyari: '' }))
}

async function engelKaldir($: E, id: string, rumuz: string) {
  await api($, '/api/engel-kaldir', { id })
  const r = await api($, '/api/engeller')
  await update($, ekran, (e: Ekran) => ({ ...e, liste: r.engeller ?? [], uyari: `${rumuz} için engel kaldırıldı.` }))
}

async function duzenlemeyeGec($: E) {
  if ((await read($, ekran)).sirada) await api($, '/api/sira-cik', {}).catch(() => {})
  await update($, form, (y: Form) => ({ ...y, adim: 0 }))
  await update($, ekran, (x: Ekran) => ({ ...x, durum: 'kurulum' as const, sirada: false, uyari: '' }))
}

async function kaydet($: E, p: Profil) {
  await $.store.set(await anahtar($, 'profil'), p)
  await update($, form, () => ({ ...p, adim: 0 }))
}

const guvenli = async ($: E, is: () => Promise<unknown>) => {
  try {
    await is()
  } catch (err: any) {
    await uyar($, temiz(err?.message))
  }
}

function paneliAc($: E) {
  return $.ui.open({ id: PANEL, title: BASLIK, focus: true })
}

// Uzun mesajları balonun genişliğine göre kelime kelime satırlara böl (balon panelin tamamına yayılmasın).
function sar(metin: string, en: number): string {
  const satirlar: string[] = []
  for (const paragraf of metin.split('\n')) {
    let satir = ''
    for (const kelime of paragraf.split(/\s+/)) {
      let k = kelime
      while (k.length > en) {
        if (satir) satirlar.push(satir), (satir = '')
        satirlar.push(k.slice(0, en))
        k = k.slice(en)
      }
      if (!satir) satir = k
      else if ((satir + ' ' + k).length <= en) satir += ' ' + k
      else satirlar.push(satir), (satir = k)
    }
    satirlar.push(satir)
  }
  return satirlar.join('\n')
}

async function geriBildirimGonder($: E, metin: string, yuzey: string) {
  const m = temiz(metin).trim()
  if (m.length < 3) throw new Error('Biraz daha yazar mısın? En az 3 karakter.')
  await api($, '/api/geribildirim', { metin: m, yuzey })
  await update($, ekran, (e: Ekran) => ({ ...e, geriBildirim: false, uyari: 'Teşekkürler! Geri bildirimin bize ulaştı.' }))
}

const FOTO_KURALLARI = [
  'Gönderdiğin fotoğraftan yalnızca sen sorumlusun.',
  'Çıplaklık ya da cinsel içerik, başkasına ait ya da izinsiz çekilmiş görüntüler ve 18 yaşından küçükleri gösteren her türlü görüntü yasaktır. Bildirilen fotoğraflar incelenir; kural ihlalinde erişim kapatılır ve gerekirse yetkililere bildirilir.',
  'Tek gösterimlik fotoğraf açıldıktan sonra silinir, ama karşındaki ekran görüntüsü alabilir; ask.sh bunu engelleyemez.',
  'Fotoğraflar gönderilmeden önce küçültülür ve içindeki konum gibi bilgiler silinir.',
]

// Fotoğraf mesajının ekranda görünen metni (durumuyla birlikte)
function fotoMetin(m: Mesaj): string {
  if (!m.foto) return m.metin
  if (m.foto.mod === 'kalici') return '📷 Fotoğraf'
  if (m.kim === 'ben') return m.foto.durum === 'goruldu' ? '🔥 Tek gösterimlik fotoğraf · açıldı' : '🔥 Tek gösterimlik fotoğraf · henüz açılmadı'
  return m.foto.durum === 'goruldu' ? '🔥 Tek gösterimlik fotoğraf · açıldı, silindi' : '🔥 Tek gösterimlik fotoğraf · aşağıdan aç'
}

// ---------- yazı modu (telefon / Remote Control: panel çizilmeyen yüzeyler) ----------
function metinSaat(t: number) {
  return new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function metinListe(d: Ekran): string {
  const satirlar = ['ask.sh' + (d.sirada ? ' · yeni biri aranıyor…' : '')]
  if (!d.sohbetler.length) satirlar.push('Şu an sohbetin yok. Yeni biriyle tanışmak için: /date yeni')
  d.sohbetler.forEach((s, i) => {
    const son = s.mesajlar[s.mesajlar.length - 1]
    const durum = s.bitti && !s.kalici ? 'bitti' : s.karsiYaziyor ? 'yazıyor…' : s.karsiCevrimici ? 'çevrimiçi' : 'çevrimdışı'
    const isaret = (s.id === d.aktif ? '›' : ' ') + ` ${i + 1}. ${s.karsi.rumuz}${s.kalici ? ' ★' : ''}${s.okunmamis ? ` ● ${s.okunmamis}` : ''} · ${durum}`
    satirlar.push(isaret + (son ? `\n     ${son.kim === 'ben' ? 'sen' : s.karsi.rumuz}: ${son.metin.slice(0, 80)}` : ''))
  })
  satirlar.push('', 'Oku: /date oku <no> · Yaz: /date <mesaj> · Yeni: /date yeni · Bağlantıda kal: /date kal')
  return satirlar.join('\n')
}

function metinSohbet(s: Sohbet, adet = 12): string {
  const satirlar = [`${s.karsi.rumuz}${s.kalici ? ' ★' : ''}${[ALAN_AD[s.karsi.alan ?? ''], RUH_AD[s.karsi.ruh ?? '']].filter(Boolean).map(x => ' · ' + x).join('')}`]
  if (!s.mesajlar.length) satirlar.push('Henüz mesaj yok. Bir selam iyi bir başlangıç: /date selam!')
  for (const m of s.mesajlar.slice(-adet)) satirlar.push(`${metinSaat(m.at)}  ${m.kim === 'ben' ? 'sen' : s.karsi.rumuz}: ${fotoMetin(m)}${m.foto ? ' (bilgisayardan açılır)' : ''}${m.durum === 'hata' ? ' (gönderilemedi)' : ''}`)
  if (s.bitti && !s.kalici) satirlar.push(s.bitti.ben ? '— Sohbeti bitirdin.' : `— ${ayrilis(s.karsi.rumuz, s.bitti.neden)}`)
  if (!s.kalici && s.kalO && !s.kalBen) satirlar.push(`★ ${s.karsi.rumuz} bağlantıda kalmak istiyor. Kabul: /date kal`)
  return satirlar.join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'date',
      description: 'ask.sh — çalışırken biriyle tanış, yan panelde sohbet et',
      argumentHint: '[mesaj | yeni | sohbetler | bitir | engelle | bildir | ayrıl | yardım]',
    } as any)
    void surumKontrol($)
    try {
      const v = await $.session.version()
      const temel = (v.base ?? v.version).replace(/-.*/, '')
      await update($, ortam, () => ({ zengin: surumKarsilastir(temel, ZENGIN_SURUM) >= 0, surum: temel }))
    } catch {
      await update($, ortam, () => ({ zengin: false, surum: '' }))
    }
    const kabul = !!(await $.store.get(await anahtar($, 'fotoKabul')))
    const bildirimKapali = (await $.store.get(await anahtar($, 'bildirim'))) === 'kapali'
    await update($, ekran, (x: Ekran) => ({ ...x, fotoKabul: kabul, bildirimKapali, fotoForm: null, fotoGoster: null }))
    const p = await profil($)
    if (p) {
      await update($, form, () => ({ ...p, adim: 0 }))
      // Kalıcı bağlantılar ve bekleyen mesajlar için bir kez bak; varsa dinlemeye başla.
      void (async () => {
        try {
          await yokla($)
          const d = await read($, ekran)
          if (d.sirada || d.sohbetler.length) await yoklamayiBaslat($)
        } catch {}
      })()
    }
    return next(e)
  })

  on('command.run', { command: 'date' }, async ($, e) => {
    const args = e.args.trim()
    const [ilk, ...kalan] = args.split(/\s+/)
    const komut = (ilk || '').toLocaleLowerCase('tr')
    const sonuc = (text: string) => ({ text, isTextDisplayOnly: true as const })
    // Remote Control (telefon, web) paneli çizmeyebilir: oradan gelen komutlara yazıyla cevap ver.
    const uzaktan = (e.origin as any)?.kind === 'bridge'

    try {
      if (uzaktan && (!args || komut === 'oku' || komut === 'liste' || komut === 'sohbetler' || komut === 'kal' || komut === 'git')) {
        await surumKontrol($)
        if ((await read($, ekran)).guncelleme?.durum === 'zorunlu') return sonuc(`ask.sh'ın yeni sürümü çıktı, devam etmek için güncelle. Terminalde: ${(await read($, ekran)).guncelleme?.komut || GUNCELLEME_KOMUTU} (sonra Claude'u yeniden başlat)`)
        let d = await read($, ekran)
        if (!args && (d.durum === 'kurulum' || (!d.sirada && d.sohbetler.length === 0))) {
          if (!(await profil($))) return sonuc('Önce bilgisayarında /date ile kurulumu yap ya da: /date kur <rumuz> <k|e|x> <h|k|e> 18+')
          await sirayaGir($)
        } else await yokla($)
        await yoklamayiBaslat($)
        d = await read($, ekran)
        if (!args || komut === 'liste' || komut === 'sohbetler') return sonuc(metinListe(d))
        const no = Number(kalan[0])
        const hedef = no ? d.sohbetler[no - 1] : (d.sohbetler.find(x => x.id === d.aktif) ?? (d.sohbetler.length === 1 ? d.sohbetler[0] : undefined))
        if (!hedef) return sonuc('Hangi sohbet? Örnek: /date oku 1\n\n' + metinListe(d))
        await sohbetAc($, hedef.id)
        if (komut === 'kal') {
          await kalIstegi($, hedef.id)
          d = await read($, ekran)
        }
        return sonuc(metinSohbet(d.sohbetler.find(x => x.id === hedef.id) ?? hedef))
      }
      if (!args) {
        await paneliAc($)
        await surumKontrol($)
        if ((await read($, ekran)).guncelleme?.durum === 'zorunlu') return sonuc(`ask.sh'ın yeni sürümü çıktı, devam etmek için güncelle. Terminalde: ${(await read($, ekran)).guncelleme?.komut || GUNCELLEME_KOMUTU} (sonra Claude'u yeniden başlat)`)
        const d = await read($, ekran)
        if (d.durum === 'kurulum' || (!d.sirada && d.sohbetler.length === 0)) await sirayaGir($)
        return sonuc('ask.sh açıldı.')
      }
      if (komut === 'yardım' || komut === 'yardim' || komut === 'help') {
        return sonuc(
          [
            'ask.sh — çalışırken biriyle tanış.',
            '',
            '  /date                  paneli aç, tanışmaya başla',
            '  /date <mesaj>          açık sohbete mesaj gönder (panelden de yazabilirsin)',
            '  /date yeni             sohbetlerin sürerken yeni biriyle tanış',
            '  /date sohbetler        sohbet listesine dön',
            '  /date oku <no>         (telefonda) o sohbetin son mesajlarını göster',
            '  /date kal              (telefonda) açık sohbet için bağlantıda kal',
            '  /date bitir            açık sohbetten ayrıl (ikiniz de ayrılınca konuşma silinir; kalıcı bağlantıyı siler)',
            '  /date engelle          açık sohbetteki kişiyle bir daha karşılaşma',
            '  /date bildir [neden]   rahatsız edeni bildir',
            '  /date engellediklerim  engellediklerini gör, istersen engeli kaldır',
            '  /date geri-bildirim <metin>  bize öneri, hata ya da düzeltme yaz',
            '  /date ayrıl            sıradan sohbetleri bitir (kalıcı bağlantılar durur)',
            '  /date sürüm            sürümünü ve güncelleme olup olmadığını göster',
            '  /date kur <rumuz> <k|e|x> <h|k|e> 18+   hızlı kurulum: cinsiyetin, kimlerle; 18+ ile yaşını onaylarsın',
            '  /date profil <ad>      bu pencereye ayrı bir kimlik ver',
            '',
            'Karşındakinin yazdıkları yalnızca panelde görünür; Claude onları hiç okumaz.',
          ].join('\n'),
        )
      }
      if (komut === 'sürüm' || komut === 'surum' || komut === 'version') {
        await surumKontrol($)
        const g = (await read($, ekran)).guncelleme
        return sonuc(
          g
            ? `ask.sh ${SURUM}. Yeni sürüm: ${g.son}. Güncellemek için terminalde: ${g.komut} (sonra Claude'u yeniden başlat)`
            : `ask.sh ${SURUM}. En güncel sürümdesin.`,
        )
      }
      if (komut === 'kur') {
        const [rumuz, ben, araHam, onay] = kalan
        const ara = araHam === 'h' ? 'x' : araHam
        if (!rumuz || !RUMUZ.test(rumuz) || !/^[kex]$/.test(ben ?? '') || !/^[kex]$/.test(ara ?? '') || onay !== '18+')
          return sonuc(
            'Kullanım: /date kur <rumuz> <k|e|x> <h|k|e> 18+\n' +
              RUMUZ_UYARI +
              '\nSondaki 18+ ile 18 yaşında ya da daha büyük olduğunu onaylarsın. Kurallar: nazik ol, kişisel bilgi paylaşma, rahatsız olursan bitir, engelle ya da bildir.',
          )
        await kaydet($, { rumuz, ben: ben as Cins, ara: ara as Cins })
        return sonuc(`Hazırsın, ${rumuz}. /date ile başla.`)
      }
      if (komut === 'profil') {
        const ad = (kalan[0] || '').toLocaleLowerCase('tr')
        if (ad && !/^[a-z0-9_-]{1,20}$/.test(ad)) return sonuc('Profil adında a-z, 0-9, _ ve - kullanabilirsin.')
        const id = await $.session.id()
        if (!ad || ad === 'varsayilan') await $.store.delete('yuva:' + id)
        else await $.store.set('yuva:' + id, ad)
        yoklamayiDurdur($)
        await update($, ekran, () => BOS_EKRAN)
        const p = await profil($)
        await update($, form, () => ({ rumuz: '', ben: 'x' as Cins, ara: 'x' as Cins, alan: '', ruh: '', ...p, adim: 0 }))
        return sonuc(`Bu pencere artık "${ad || 'varsayilan'}" kimliğini kullanıyor${p ? ` (${p.rumuz})` : ''}. /date ile başla.`)
      }
      if (komut === 'sunucu') {
        if (kalan[0]) await $.store.set(await anahtar($, 'sunucu'), kalan[0])
        else await $.store.delete(await anahtar($, 'sunucu'))
        return sonuc('sunucu: ' + (await sunucu($)))
      }
      if (komut === 'geri-bildirim' || komut === 'geribildirim' || komut === 'öneri' || komut === 'oneri') {
        const metin = kalan.join(' ')
        if (!metin) {
          await paneliAc($)
          await update($, ekran, (x: Ekran) => ({ ...x, geriBildirim: true, aktif: null }))
          return sonuc('Geri bildirim formu panelde. Ya da doğrudan: /date geri-bildirim <yazın>')
        }
        await geriBildirimGonder($, metin, uzaktan ? 'telefon' : 'komut')
        return sonuc('Teşekkürler! Geri bildirimin bize ulaştı.')
      }
      if (komut === 'engellediklerim' || komut === 'engeller') {
        await paneliAc($)
        await engelleriAc($)
        return sonuc('Engellediklerin panelde.')
      }
      if (komut === 'yeni') {
        await paneliAc($)
        await sirayaGir($)
        return sonuc('Sana uygun birini arıyoruz; sohbetlerin sürüyor.')
      }
      if (komut === 'sohbetler') {
        await paneliAc($)
        await sohbetAc($, null)
        return sonuc('Sohbetlerin panelde.')
      }
      if (komut === 'ayrıl' || komut === 'ayril' || komut === 'çık' || komut === 'cik') {
        await ayril($)
        return sonuc('Sıradan sohbetlerin bitti. Kalıcı bağlantıların duruyor. Görüşmek üzere!')
      }
      const d = await read($, ekran)
      const acik = d.sohbetler.find(s => s.id === d.aktif) ?? (d.sohbetler.filter(s => !s.bitti || s.kalici).length === 1 ? d.sohbetler.find(s => !s.bitti || s.kalici) : undefined)
      const es: Record<string, Eylem> = { bitir: 'bitir', engelle: 'engelle', bildir: 'sikayet', şikayet: 'sikayet', sikayet: 'sikayet' }
      if (es[komut]) {
        if (!acik) return sonuc('Önce panelden bir sohbet aç.')
        await eylem($, es[komut]!, acik.id, kalan.join(' '))
        return sonuc({ bitir: acik.kalici ? 'Bağlantıyı sildin; konuşma ikiniz için de silindi.' : acik.bitti ? 'Konuşma silindi.' : 'Sohbetten ayrıldın. O da ayrılınca konuşma tamamen silinir.', engelle: 'Engelledin.', sikayet: 'Bildirimin alındı, teşekkürler.', kapat: '' }[es[komut]!])
      }
      if (!acik || (acik.bitti && !acik.kalici)) return sonuc('Şu an açık bir sohbetin yok. Panelden bir sohbet seç ya da /date ile başla.')
      await gonder($, acik.id, args)
      if (uzaktan) {
        await yokla($)
        const sonra = (await read($, ekran)).sohbetler.find(x => x.id === acik.id)
        const u = (await read($, ekran)).uyari
        return sonuc((u ? u + '\n\n' : '') + (sonra ? metinSohbet(sonra, 6) : 'Mesajın gönderildi.'))
      }
      return sonuc('Mesajın gönderildi.')
    } catch (err: any) {
      return sonuc(temiz(err?.message))
    }
  })

  on('ui.scroll', { requestId: PANEL }, async ($, e, next) => {
    // Yalnızca sohbet ekranında: orada panel yüksekliğe kilitli, kayan mesaj alanı.
    const d = await read($, ekran)
    const sohbetEkrani =
      !!d.aktif && d.durum === 'ana' && !d.bildirForm && !d.ayrilOnay && !d.fotoForm && !d.fotoGoster && !d.geriBildirim && !d.liste && d.guncelleme?.durum !== 'zorunlu'
    if (!sohbetEkrani || (typeof e.bodyRows === 'number' && e.bodyRows > 0 && e.bodyRows < 12)) return next(e)
    await mesajKaydir($, e.by)
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANEL }, async ($, e) => {
    const ogeler = $.ui.resolve(e) as any
    const { Box, Text, Button, Input, Select } = ogeler
    const d = await read($, ekran)
    const f = await read($, form)
    const o = await read($, ortam)
    const zengin = o.zengin
    // Yüzey ve ölçü: terminal sıkı düzen; masaüstü, mobil ve VS Code ferah düzen.
    // Genişliğe göre: dar (< 64 sütun, telefon ya da dar yan panel) her şeyi alt alta dizer.
    const yuzey = e.surface
    const masaustu = yuzey !== 'terminal'
    const mobil = yuzey === 'mobile'
    const siki = !masaustu
    const pp = (e as any).props ?? {}
    const odakta = !!pp.isFocused
    const govdeSatir = Number(pp.scroll?.bodyRows ?? e.viewport?.rows ?? 24)
    const genislik = Number(pp.bodyColumns ?? e.viewport?.columns ?? 80)
    const dar = genislik < 64
    const yerlesim: string = pp.placement ?? 'dock'

    // Yazı stilleri: yeni Claude'da gerçek boyut/kalınlık, eskisinde kalın + soluk.
    const BASLIK_S = zengin ? { weight: 'semibold', size: 'heading' } : { bold: true }
    const KALIN = zengin ? { weight: 'semibold' } : { bold: true }
    const KUCUK = zengin ? { size: 'caption', dimColor: true } : { dimColor: true }
    const SAAT = zengin ? { size: 'caption', dimColor: true, tabular: true } : { dimColor: true }

    // Rumuzdan doğan avatar: masaüstünde Svg, terminalde Raster; eski Claude'da renkli işaret.
    const Avatar = (rumuz: string, anahtarAd: string, cins?: string) => {
      const renk = kisiRenk(rumuz, cins)
      if (zengin && ogeler.Svg) return <ogeler.Svg key={anahtarAd} source={avatarSvg(rumuz, renk)} alt={`${rumuz} avatarı`} width={30} height={30} />
      if (zengin && ogeler.Raster) {
        const r = avatarRaster(rumuz, renk)
        return <ogeler.Raster key={anahtarAd} columns={r.columns} rows={r.rows} cells={r.cells} />
      }
      return (
        <Text key={anahtarAd} color={renk}>
          ◆
        </Text>
      )
    }
    const Ad = (rumuz: string, cins?: string) => (
      <Text {...KALIN} color={kisiRenk(rumuz, cins)}>
        {rumuz}
      </Text>
    )
    const tat = (k: { alan?: string; ruh?: string }) => [ALAN_AD[k.alan ?? ''], RUH_AD[k.ruh ?? '']].filter(Boolean).join(' · ')

    const anaEkran = d.durum === 'ana' && !d.aktif && !d.liste
    const sayac = (anaEkran || d.durum === 'kurulum') && d.cevrimici >= 5 ? `şu an ${d.cevrimici} kişi burada` : ''
    const ust = (
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text {...BASLIK_S}>
          ask.sh<Text color={TURUNCU}>.</Text>
        </Text>
        {sayac ? <Text {...KUCUK}>{sayac}</Text> : null}
      </Box>
    )
    const eskiNot =
      !zengin && o.surum ? (
        <Text dimColor>
          Daha şık bir görünüm için {mobil ? 'bilgisayarındaki Claude Code’u' : masaustu ? 'Claude masaüstü uygulamasını' : "Claude Code'u"} güncelle (sende {o.surum}, en az {ZENGIN_SURUM}).
        </Text>
      ) : null
    const uyari = d.uyari ? (
      <Box borderStyle="round" borderColor={GRI_CIZGI} paddingX={1}>
        <Text>{d.uyari}</Text>
      </Box>
    ) : null
    const kart = (icerik: any, key?: string) => (
      <Box key={key} flexDirection="column" gap={siki ? 0 : 1} borderStyle="round" borderColor={GRI_CIZGI} paddingX={2} paddingY={masaustu ? 1 : 0}>
        {icerik}
      </Box>
    )
    const komutKopyala = (metin: string) => void $.ui.copy({ text: metin }).catch(() => {})

    // ---------- zorunlu güncelleme ----------
    if (d.guncelleme?.durum === 'zorunlu') {
      const g = d.guncelleme
      return (
        <Box flexDirection="column" gap={1}>
          {ust}
          <Box flexDirection="column" gap={1} borderStyle="round" borderColor={TURUNCU} paddingX={2} paddingY={masaustu ? 1 : 0}>
            <Text {...BASLIK_S}>ask.sh'ı güncellemen gerekiyor</Text>
            <Text dimColor>
              Yeni sürüm çıktı{g.son ? ` (${g.son})` : ''}, seninki {SURUM}. Devam etmek için terminalde şunu çalıştır, sonra Claude'u yeniden başlat. Bu komut otomatik güncellemeyi de açar, bir daha elle uğraşmazsın:
            </Text>
            <Text color={TURUNCU}>{g.komut}</Text>
          </Box>
          <Box flexDirection="row" gap={1}>
            <Button key="kopyala" variant="primary" label="Komutu kopyala" onPress={() => komutKopyala(g.komut)} />
          </Box>
        </Box>
      )
    }
    // Masaüstünde küçültülmüş panel: tek bakışta okunacak özet; tıklamalar ulaşmayabilir.
    if (yerlesim === 'widget') {
      const okunmamis = okunmamisToplam(d)
      const yazan = d.sohbetler.find(x => x.karsiYaziyor)
      const ozet = okunmamis
        ? `💬 ${okunmamis} okunmamış`
        : yazan
          ? `${yazan.karsi.rumuz} yazıyor…`
          : d.sirada
            ? 'biri aranıyor…'
            : d.sohbetler.length
              ? `${d.sohbetler.length} sohbet`
              : 'sakin'
      return (
        <Box flexDirection="column">
          <Text {...KALIN}>
            ask.sh<Text color={TURUNCU}>.</Text>
          </Text>
          <Text {...(okunmamis ? { color: TURUNCU } : { dimColor: true })}>{ozet}</Text>
        </Box>
      )
    }

    const g = d.guncelleme
    const serit =
      g?.durum === 'var' ? (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Text>
            <Text color={TURUNCU}>↑ </Text>
            <Text dimColor>Yeni sürüm {g.son}: </Text>
            <Text>{g.komut}</Text>
          </Text>
          <Button key="kopyala-serit" plain label="Kopyala" onPress={() => komutKopyala(g.komut)} />
        </Box>
      ) : null

    // ---------- fotoğraf görüntüleyici (masaüstü) ----------
    if (d.fotoGoster) {
      const fg = d.fotoGoster
      const W = Math.max(240, Math.round(genislik * 7.8) - 20)
      const kapat = () => void update($, ekran, (x: Ekran) => ({ ...x, fotoGoster: null }))
      const kaynak = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Math.round(W * 0.75)}" viewBox="0 0 ${W} ${Math.round(W * 0.75)}"><rect width="100%" height="100%" rx="14" fill="#111114"/><image href="data:image/${fg.tur};base64,${fg.b64}" x="0" y="0" width="${W}" height="${Math.round(W * 0.75)}" preserveAspectRatio="xMidYMid meet"/></svg>`
      return (
        <Box flexDirection="column" gap={1}>
          {ust}
          {ogeler.Svg ? <ogeler.Svg key="foto-goruntu" source={kaynak} alt="Gelen fotoğraf" width={W} height={Math.round(W * 0.75)} /> : <Text>Fotoğraf bu ekranda gösterilemiyor.</Text>}
          <Text dimColor>{fg.mod === 'tek' ? '🔥 Tek gösterimlik: kapatınca bir daha açılamaz.' : '📌 Bu fotoğraf sohbette kalıyor.'}</Text>
          <Button key="foto-kapat" variant="primary" label="Kapat" onPress={kapat} />
        </Box>
      )
    }

    // ---------- fotoğraf gönder ----------
    if (d.fotoForm) {
      const ff = d.fotoForm
      const hedefS = d.sohbetler.find(x => x.id === ff.oda)
      const kapat = () => void update($, ekran, (x: Ekran) => ({ ...x, fotoForm: null, uyari: '' }))
      const gonderKaynak = (kaynak: string) => void guvenli($, () => fotoGonder($, ff.oda, ff.mod, kaynak))
      if (!d.fotoKabul) {
        return (
          <Box flexDirection="column" gap={siki ? 0 : 1}>
            {ust}
            {kart(
              <Box flexDirection="column" gap={siki ? 0 : 1}>
                <Text {...BASLIK_S}>Fotoğraf göndermeden önce</Text>
                {FOTO_KURALLARI.map((k, i) => (
                  <Text key={'kural-' + i}>• {k}</Text>
                ))}
              </Box>,
            )}
            <Box flexDirection="row" gap={2} flexWrap="wrap">
              <Button key="foto-kabul" variant="primary" label="Okudum, kabul ediyorum" onPress={() => void guvenli($, async () => {
                await $.store.set(await anahtar($, 'fotoKabul'), true)
                await update($, ekran, (x: Ekran) => ({ ...x, fotoKabul: true }))
              })} />
              <Button key="foto-vazgec" plain label="Vazgeç" onPress={kapat} />
            </Box>
          </Box>
        )
      }
      return (
        <Box flexDirection="column" gap={siki ? 0 : 1}>
          {ust}
          {kart(
            <Box flexDirection="column" gap={siki ? 0 : 1}>
              <Text {...BASLIK_S}>{hedefS?.karsi.rumuz ?? ''} kişisine fotoğraf</Text>
              <Box flexDirection="row" gap={2} flexWrap="wrap">
                <Button key="mod-tek" plain={ff.mod !== 'tek' ? true : undefined} variant={ff.mod === 'tek' ? 'primary' : undefined} label="🔥 Tek gösterim" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, fotoForm: { ...ff, mod: 'tek' as const } }))} />
                <Button key="mod-kalici" plain={ff.mod !== 'kalici' ? true : undefined} variant={ff.mod === 'kalici' ? 'primary' : undefined} label="📌 Sohbette kalsın" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, fotoForm: { ...ff, mod: 'kalici' as const } }))} />
              </Box>
              <Text dimColor>{ff.mod === 'tek' ? 'Bir kez açılır, sonra herkesten silinir.' : 'Bağlantınız durdukça sohbette kalır.'}</Text>
              <Button key="foto-pano" label="Panodaki görüntüyü gönder" onPress={() => gonderKaynak('pano')} />
              <Input key="foto-yol" label="ya da dosya yolu" placeholder="~/Resimler/ekran.png" submitLabel="Gönder" onSubmit={(v: string) => v.trim() && gonderKaynak(v.trim())} />
            </Box>,
          )}
          <Button key="foto-vazgec" plain label="Vazgeç" onPress={kapat} />
          {uyari}
        </Box>
      )
    }

    // ---------- ayrılma onayı ----------
    if (d.ayrilOnay) {
      const vazgec = () => void update($, ekran, (x: Ekran) => ({ ...x, ayrilOnay: null }))
      if (d.ayrilOnay === 'hepsi') {
        const silinecek = d.sohbetler.filter(x => !x.kalici).length
        const kalici = d.sohbetler.filter(x => x.kalici).length
        return (
          <Box flexDirection="column" gap={siki ? 0 : 1}>
            {ust}
            {kart(
              <Box flexDirection="column" gap={siki ? 0 : 1}>
                <Text {...BASLIK_S}>ask.sh'tan çıkıyorsun</Text>
                <Text>
                  {silinecek
                    ? `Bağlantıda kalmadığın ${silinecek} sohbetten ayrılacaksın. Karşındakiler de ayrılınca bu konuşmalar tamamen silinir.`
                    : 'Sıradan çıkacaksın.'}
                  {kalici ? ` ★ ${kalici} kalıcı bağlantın durur.` : ''}
                </Text>
              </Box>,
            )}
            <Box flexDirection="row" gap={2} flexWrap="wrap">
              <Button key="ayril-evet" variant="primary" label="Çık" onPress={() => void guvenli($, async () => {
                await update($, ekran, (x: Ekran) => ({ ...x, ayrilOnay: null }))
                await ayril($)
              })} />
              <Button key="ayril-vazgec" plain label="Vazgeç" onPress={vazgec} />
            </Box>
          </Box>
        )
      }
      const hs = d.sohbetler.find(x => x.id === d.ayrilOnay)
      if (hs) {
        const oGitti = !!hs.bitti && !hs.bitti.ben && !hs.kalici
        const baslik = hs.kalici
          ? `${hs.karsi.rumuz} ile bağlantını siliyorsun`
          : oGitti
            ? `${hs.karsi.rumuz} zaten ayrıldı`
            : `${hs.karsi.rumuz} ile sohbetten ayrılıyorsun`
        const aciklama = hs.kalici
          ? 'Bağlantı ve tüm mesajlar ikiniz için de silinir, geri getirilemez.'
          : oGitti
            ? 'Sen de çıkarsan bu konuşma tamamen silinir, geri getirilemez.'
            : 'Bağlantıda kalmadığınız için, ikiniz de ayrılınca bu konuşma tamamen silinir. Ayrılmadan önce son bir mesaj yazabilir ya da bağlantıda kalmayı önerebilirsin.'
        const evet = () =>
          void guvenli($, async () => {
            await update($, ekran, (x: Ekran) => ({ ...x, ayrilOnay: null }))
            await eylem($, oGitti ? 'kapat' : 'bitir', hs.id)
          })
        return (
          <Box flexDirection="column" gap={siki ? 0 : 1}>
            {ust}
            {kart(
              <Box flexDirection="column" gap={siki ? 0 : 1}>
                <Box flexDirection="row" alignItems="center" gap={1}>
                  {masaustu ? Avatar(hs.karsi.rumuz, 'av-onay', hs.karsi.cins) : null}
                  <Text {...BASLIK_S}>{baslik}</Text>
                </Box>
                <Text>{aciklama}</Text>
              </Box>,
            )}
            <Box flexDirection="row" gap={2} flexWrap="wrap">
              <Button key="ayril-evet" variant="primary" label={hs.kalici ? 'Bağlantıyı sil' : oGitti ? 'Sil ve çık' : 'Ayrıl'} onPress={evet} />
              {!hs.kalici && !oGitti ? <Button key="son-mesaj" plain label="Son bir mesaj yaz" onPress={vazgec} /> : null}
              {!hs.kalici && !oGitti && !hs.kalBen ? (
                <Button key="kal-oner" plain label="★ Bağlantıda kalmayı öner" onPress={() => void guvenli($, async () => {
                  await update($, ekran, (x: Ekran) => ({ ...x, ayrilOnay: null }))
                  await kalIstegi($, hs.id)
                })} />
              ) : null}
              <Button key="ayril-vazgec" plain label="Vazgeç" onPress={vazgec} />
            </Box>
          </Box>
        )
      }
    }

    // ---------- geri bildirim ----------
    if (d.geriBildirim) {
      const kapat = () => void update($, ekran, (x: Ekran) => ({ ...x, geriBildirim: false, uyari: '' }))
      return (
        <Box flexDirection="column" gap={siki ? 0 : 1}>
          {ust}
          {kart(
            <Box flexDirection="column" gap={siki ? 0 : 1}>
              <Text {...BASLIK_S}>Bize bir şey söyle</Text>
              <Text dimColor>Hata, öneri, beğenmediğin bir yer… Doğrudan bize ulaşır. Rumuzun ve sürümün de eklenir.</Text>
              <Input
                key="geri-bildirim-yazi"
                placeholder="ör. balonlar çok küçük, şu düğme kafa karıştırıyor…"
                submitLabel="Gönder"
                autoFocus
                {...(zengin ? { rows: 3 } : {})}
                onSubmit={(v: string) => void guvenli($, () => geriBildirimGonder($, v, String(yuzey)))}
              />
            </Box>,
          )}
          <Button key="geri-bildirim-kapat" plain label="Vazgeç" onPress={kapat} />
          {uyari}
        </Box>
      )
    }

    // ---------- engellediklerim ----------
    if (d.liste) {
      const kapat = () => void update($, ekran, (x: Ekran) => ({ ...x, liste: null, uyari: '' }))
      return (
        <Box flexDirection="column" gap={1}>
          {ust}
          {kart(
            <Box flexDirection="column" gap={1}>
              <Box flexDirection="column">
                <Text {...BASLIK_S}>Engellediklerin</Text>
                <Text dimColor>Engelini kaldırdığın kişiyle yeniden eşleşebilirsin; bildirimin de geri çekilir.</Text>
              </Box>
              {d.liste.length === 0 ? <Text dimColor>Kimseyi engellemedin.</Text> : null}
              {d.liste.map(k => (
                <Box key={'e' + k.id} flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <Text>
                    <Text color={avatar(k.rumuz).renk}>◆ </Text>
                    {Ad(k.rumuz)}
                    <Text dimColor>{k.bildirildi ? '  bildirdin' : '  engelledin'}</Text>
                  </Text>
                  <Button key={'kaldir-' + k.id} label="Engeli kaldır" onPress={() => void guvenli($, () => engelKaldir($, k.id, k.rumuz))} />
                </Box>
              ))}
            </Box>,
          )}
          <Box flexDirection="row" gap={1}>
            <Button key="liste-kapat" variant="primary" label="Tamam" onPress={kapat} />
          </Box>
          {uyari}
        </Box>
      )
    }

    // ---------- kurulum (3 adım) ----------
    if (d.durum === 'kurulum') {
      const adim = Math.min(2, f.adim ?? 0)
      const ileri = (v: Partial<Form>) => update($, form, (x: Form) => ({ ...x, ...v, adim: Math.min(2, (x.adim ?? 0) + 1) }))
      const geri = () => void update($, form, (x: Form) => ({ ...x, adim: Math.max(0, (x.adim ?? 0) - 1) }))
      const rumuzDevam = (v?: string) =>
        void (async () => {
          const r = (v ?? (await read($, form)).rumuz).trim()
          if (!RUMUZ.test(r)) return uyar($, RUMUZ_UYARI)
          await uyar($, '')
          await ileri({ rumuz: r })
        })()

      let baslik
      let govde
      if (adim === 0) {
        baslik = 'Sana nasıl seslenelim?'
        govde = (
          <Box flexDirection={dar ? 'column' : 'row'} alignItems={dar ? 'flex-start' : 'center'} gap={dar ? 1 : 2}>
            <Box flexGrow={1} flexDirection="column">
              <Text dimColor>Gerçek adın olmasın. Avatarın bu isimden doğar.</Text>
              <Input
                key="rumuz"
                label="Rumuz"
                placeholder="ör. gececi_kedi"
                value={f.rumuz}
                submitLabel="Devam"
                autoFocus
                onInput={(v: string) => void update($, form, (x: Form) => ({ ...x, rumuz: v }))}
                onSubmit={(v: string) => rumuzDevam(v)}
              />
            </Box>
            {RUMUZ.test(f.rumuz.trim()) && (
              <Box flexDirection="column" alignItems="center">
                {Avatar(f.rumuz.trim(), 'av-onizleme')}
                <Text {...KUCUK}>avatarın</Text>
              </Box>
            )}
          </Box>
        )
      } else if (adim === 1) {
        baslik = `Memnun oldum, ${f.rumuz}.`
        govde = (
          <Box flexDirection={siki && !dar ? 'row' : 'column'} gap={siki && !dar ? 4 : 1}>
            <Select
              key="ben"
              label="Cinsiyetin"
              autoFocus
              value={f.ben}
              options={[
                { value: 'k', label: 'Kadın' },
                { value: 'e', label: 'Erkek' },
                { value: 'x', label: 'Söylemek istemiyorum' },
              ]}
              onSelect={(v: string) => void update($, form, (x: Form) => ({ ...x, ben: v as Cins }))}
            />
            <Select
              key="ara"
              label="Kimlerle tanışmak istersin"
              value={f.ara}
              options={[
                { value: 'x', label: 'Herkesle' },
                { value: 'k', label: 'Kadınlarla' },
                { value: 'e', label: 'Erkeklerle' },
              ]}
              onSelect={(v: string) => void update($, form, (x: Form) => ({ ...x, ara: v as Cins }))}
            />
            <Text dimColor>Cinsiyetin karşındakine renkle görünür: kadın pembe, erkek mavi. Kimlerle tanışmak istediğin görünmez.</Text>
          </Box>
        )
      } else {
        baslik = `Her şey hazır, ${f.rumuz}.`
        govde = (
          <Box flexDirection="column" gap={siki ? 0 : 1}>
            <Box flexDirection={siki && !dar ? 'row' : 'column'} gap={siki && !dar ? 4 : 1}>
              <Select
                key="alan"
                label="Alanın (isteğe bağlı)"
                value={f.alan ?? ''}
                options={[{ value: '', label: 'Söylemeyeyim' }, ...Object.entries(ALAN_AD).map(([value, label]) => ({ value, label }))]}
                onSelect={(v: string) => void update($, form, (x: Form) => ({ ...x, alan: v }))}
              />
              <Select
                key="ruh"
                label="Şu an (isteğe bağlı)"
                value={f.ruh ?? ''}
                options={[{ value: '', label: 'Söylemeyeyim' }, ...Object.entries(RUH_AD).map(([value, label]) => ({ value, label }))]}
                onSelect={(v: string) => void update($, form, (x: Form) => ({ ...x, ruh: v }))}
              />
            </Box>
            <Text dimColor>Bunlar karşındakine görünür. Nazik ol, kişisel bilgi paylaşma, rahatsız olursan bitir, engelle ya da bildir.</Text>
          </Box>
        )
      }

      const devam =
        adim === 0 ? null : adim === 1 ? (
          <Button key="devam" variant="primary" label="Devam" onPress={() => void ileri({})} />
        ) : (
          <Button
            key="basla"
            variant="primary"
            label="18 yaşındayım ya da daha büyüğüm, başlayalım"
            onPress={() =>
              void guvenli($, async () => {
                const x = await read($, form)
                await kaydet($, { rumuz: x.rumuz, ben: x.ben, ara: x.ara, alan: x.alan ?? '', ruh: x.ruh ?? '' })
                await sirayaGir($)
              })
            }
          />
        )

      return (
        <Box flexDirection="column" gap={siki ? 0 : 1}>
          {ust}
          {serit}
          {zengin && masaustu && ogeler.Progress ? (
            <ogeler.Progress label="Kurulum" value={adim + 1} max={3} valueText={`${adim + 1} / 3`} color={TURUNCU} />
          ) : (
            <Text dimColor>
              {adim + 1} / 3{'  '}
              <Text color={TURUNCU}>{'━━━'.repeat(adim + 1)}</Text>
              <Text dimColor>{'━━━'.repeat(2 - adim)}</Text>
            </Text>
          )}
          {kart(
            <>
              <Text {...BASLIK_S}>{baslik}</Text>
              {govde}
            </>,
          )}
          {(adim > 0 || devam) && (
            <Box flexDirection="row" justifyContent="space-between" alignItems="center">
              {adim > 0 ? <Button key="geri" plain label="Geri" onPress={geri} /> : <Text> </Text>}
              {devam}
            </Box>
          )}
          {uyari}
          {eskiNot}
        </Box>
      )
    }

    const saat = (t: number) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const aktif = d.sohbetler.find(s => s.id === d.aktif)

    // ---------- sohbet listesi ----------
    if (!aktif) {
      const digerleri = d.sohbetler
      const aramaKarti = d.sirada ? (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" {...(masaustu ? { borderStyle: 'round', borderColor: GRI_CIZGI, paddingX: 1 } : {})}>
          <Text>
            <Text color={TURUNCU}>● </Text>
            <Text {...KALIN}>Yeni biri aranıyor…</Text>
            <Text dimColor>  gelince haber veririz</Text>
          </Text>
          <Button key="vazgec-ara" plain label="Vazgeç" onPress={() => void guvenli($, () => siradanCik($))} />
        </Box>
      ) : (
        <Box flexDirection="row" gap={1} alignItems="center">
          <Button key="ara" variant="primary" label="Yeni biriyle tanış" onPress={() => void guvenli($, () => sirayaGir($))} />
          {digerleri.length === 0 && <Text dimColor>Şu an kimseyle konuşmuyorsun.</Text>}
        </Box>
      )
      const satirSigan = siki ? Math.max(2, govdeSatir - 5 - (serit ? 1 : 0) - (d.uyari ? 3 : 0) - (eskiNot ? 1 : 0)) : 20
      return (
        <Box flexDirection="column" gap={siki ? 0 : 1}>
          {ust}
          {serit}
          {aramaKarti}
          {digerleri.length > 0 && (
            <Box flexDirection="column" gap={siki ? 0 : 1} {...(masaustu ? { borderStyle: 'round', borderColor: GRI_CIZGI, paddingX: 1 } : {})}>
              {digerleri.slice(0, satirSigan).map(s => {
                const son = s.mesajlar[s.mesajlar.length - 1]
                // Sağdaki tek bilgi: okunmamış > yazıyor > sıra sende > bitti.
                const sag =
                  s.bitti && !s.kalici
                    ? { yazi: 'bitti', vurgu: false }
                    : s.okunmamis > 0
                      ? { yazi: `● ${s.okunmamis} yeni`, vurgu: true }
                      : s.karsiYaziyor
                        ? { yazi: 'yazıyor…', vurgu: false }
                        : son?.kim === 'o'
                          ? { yazi: 'sıra sende', vurgu: false }
                          : null
                const ac = () => void sohbetAc($, s.id)
                return (
                  <Box key={'satir-' + s.id} flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
                    <Box flexDirection="row" alignItems="center" gap={1}>
                      {masaustu ? Avatar(s.karsi.rumuz, 'av-l-' + s.id, s.karsi.cins) : null}
                      {masaustu ? (
                        <Button key={'ac-' + s.id} plain label={s.karsi.rumuz + (s.kalici ? ' ★' : '')} onPress={ac} />
                      ) : (
                        <Button key={'ac-' + s.id} plain onPress={ac}>
                          <Text color={kisiRenk(s.karsi.rumuz, s.karsi.cins)}>◆ </Text>
                          {Ad(s.karsi.rumuz, s.karsi.cins)}
                          {s.kalici ? <Text color={TURUNCU}> ★</Text> : null}
                        </Button>
                      )}
                      {!s.kalici && s.kalO && !s.kalBen ? <Text color={TURUNCU}>★?</Text> : null}
                    </Box>
                    {sag ? (
                      <Text {...(sag.vurgu ? { color: TURUNCU, ...KALIN } : KUCUK)}>{sag.yazi}</Text>
                    ) : null}
                  </Box>
                )
              })}
              {digerleri.length > satirSigan && <Text dimColor>+{digerleri.length - satirSigan} sohbet daha</Text>}
            </Box>
          )}
          <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
            {!siki && f.rumuz ? Avatar(f.rumuz, 'av-ben', f.ben) : null}
            <Text dimColor>
              {f.rumuz} olarak görünüyorsun{tat(f) ? ` · ${tat(f)}` : ''}
            </Text>
            <Button key="profil" plain label="Bilgilerimi değiştir" onPress={() => void guvenli($, () => duzenlemeyeGec($))} />
            <Button key="engeller" plain label="Engellediklerim" onPress={() => void guvenli($, () => engelleriAc($))} />
            <Button
              key="bildirim-ayar"
              plain
              label={d.bildirimKapali ? '🔕 Bildirimler kapalı (aç)' : '🔔 Bildirimler açık'}
              onPress={() =>
                void guvenli($, async () => {
                  const kapali = !d.bildirimKapali
                  await $.store.set(await anahtar($, 'bildirim'), kapali ? 'kapali' : 'acik')
                  await update($, ekran, (x: Ekran) => ({ ...x, bildirimKapali: kapali, uyari: kapali ? 'Sistem bildirimleri kapandı.' : 'Sistem bildirimleri açıldı.' }))
                  if (!kapali) void sistemBildirimi($, 'ask.sh', '🔔 Bildirimler açık')
                })
              }
            />
            <Button key="foto-ayar" plain label={d.fotoAl === 'hayir' ? '📷 Fotoğraf almıyorsun (aç)' : '📷 Fotoğraf: sorarak al'} onPress={() => void guvenli($, () => fotoAyari($, d.fotoAl === 'hayir' ? 'sor' : 'hayir'))} />
            <Button key="geri-bildirim" plain label="Geri bildirim" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, geriBildirim: true, uyari: '' }))} />
            <Button key="cik" plain label="Çıkış" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, ayrilOnay: 'hepsi' }))} />
          </Box>
          {uyari}
          {eskiNot}
        </Box>
      )
    }

    // ---------- tek sohbet ----------
    const s = aktif
    const karsi = s.karsi.rumuz
    const acik = !s.bitti || s.kalici
    const benimMesajYok = !s.mesajlar.some(m => m.kim === 'ben')
    const gonderTaslak = (v?: string) => void guvenli($, async () => gonder($, s.id, v ?? (await read($, ekran)).taslak ?? ''))
    const digerOkunmamis = d.sohbetler.filter(x => x.id !== s.id).reduce((t, x) => t + x.okunmamis, 0)

    // Bildir: önce neden sorulur.
    if (d.bildirForm === s.id) {
      const neden = (v: string) => void guvenli($, () => eylem($, 'sikayet', s.id, v))
      return (
        <Box flexDirection="column" gap={siki ? 0 : 1}>
          {ust}
          {kart(
            <>
              <Text {...BASLIK_S}>{karsi} kullanıcısını neden bildiriyorsun?</Text>
              <Text dimColor>Bildirdiğin kişiyle bir daha eşleşmezsin. Sohbetin son mesajları incelemek için saklanır.</Text>
              <Select
                key="neden"
                autoFocus
                options={[
                  { value: 'taciz', label: 'Taciz ya da hakaret' },
                  { value: 'cinsel', label: 'İstemediğim cinsel içerik' },
                  { value: 'resit-degil', label: 'Reşit olmayabilir' },
                  { value: 'spam', label: 'Spam ya da reklam' },
                  { value: 'diger', label: 'Başka bir şey' },
                ]}
                onSelect={neden}
              />
            </>,
          )}
          <Button key="vazgec" plain label="Vazgeç" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, bildirForm: null }))} />
        </Box>
      )
    }

    const kalEtiket = s.kalici
      ? null
      : s.kalO && !s.kalBen
        ? { label: `★ ${karsi} bağlantıda kalmak istiyor, kabul et`, primary: true }
        : s.kalBen
          ? { label: '★ İsteğin gitti', primary: false }
          : { label: '★ Bağlantıda kal', primary: false }
    const durumYazi = s.bitti && !s.kalici ? 'sohbet bitti' : s.karsiYaziyor ? 'yazıyor…' : s.karsiCevrimici ? 'çevrimiçi' : s.kalici ? 'çevrimdışı · mesajın onu bekler' : 'çevrimdışı'

    const tuvalYuzeyOn = (yuzey === 'desktop' || yuzey === 'vscode') && zengin && !!ogeler.Svg
    // Yan panelde (dock) üst kısım ve yazma kutusu sabit; aradaki mesaj alanı kayar.
    const sabit = yerlesim === 'dock' && !mobil && govdeSatir >= 12
    const sabitN = sabit ? (d.sabitN ?? null) : null
    const kadar = sabitN == null ? s.mesajlar : s.mesajlar.filter(m => m.n <= sabitN)
    const altta = s.mesajlar.length - kadar.length
    // Mesajlar: kalan yüksekliğe sığanlar; saat yalnızca değişince ya da konuşan değişince.
    const sabitSatir = 3 + (serit ? 1 : 0) + (d.uyari ? 3 : 0) + (acik ? (zengin ? 3 : 2) : 2) + (benimMesajYok && acik ? 2 : 1) + (eskiNot ? 1 : 0)
    const sigan = siki ? Math.max(2, govdeSatir - sabitSatir) : 12
    const gorunen = kadar.slice(-(tuvalYuzeyOn ? 40 : sabit ? 60 : sigan))
    const gizli = kadar.length - gorunen.length
    // Masaüstü ve VS Code'da mesajlar tek bir SVG tuvalinde, mesajlaşma uygulaması gibi çizilir.
    const tuvalYuzey = (yuzey === 'desktop' || yuzey === 'vscode') && zengin && !!ogeler.Svg
    const tuval =
      tuvalYuzey && (s.mesajlar.length > 0 || s.karsiYaziyor)
        ? sohbetSvg({
            mesajlar: kadar.slice(-40).map(m => (m.foto ? { ...m, metin: fotoMetin(m) } : m)),
            karsiRumuz: karsi,
            karsiRenk: kisiRenk(karsi, s.karsi.cins),
            yaziyor: s.karsiYaziyor && acik && sabitN == null,
            genislik: genislik * 7.8,
            canlan: m => canlanmali(s.id, m),
          })
        : null
    // Balon: masaüstü ve mobilde yuvarlak köşeli; genişlik panelin ~%70'i, uzun mesaj içeride satır atlar.
    const balonEn = Math.max(14, Math.floor(genislik * (dar ? 0.82 : 0.68)) - 4)
    const mesajSatiri = (m: Mesaj, i: number) => {
      const benim = m.kim === 'ben'
      const onceki = gorunen[i - 1]
      const sonraki = gorunen[i + 1]
      const yeniKonusan = !!onceki && onceki.kim !== m.kim
      const grupSonu = !sonraki || sonraki.kim !== m.kim || saat(sonraki.at) !== saat(m.at)
      const renk = benim ? TURUNCU : GRI_BALON
      const balon = (
        <Box
          backgroundColor={renk}
          paddingX={1}
          {...(masaustu ? { borderStyle: 'round', borderColor: renk } : {})}
        >
          <Text color={benim ? '#ffffff' : GRI_BALON_YAZI}>{sar(fotoMetin(m), balonEn)}</Text>
        </Box>
      )
      const alt =
        m.durum === 'gidiyor' ? (
          <Text {...SAAT}>gönderiliyor…</Text>
        ) : m.durum === 'hata' ? (
          <Text color={TURUNCU}>gönderilemedi</Text>
        ) : grupSonu ? (
          <Text {...SAAT}>{saat(m.at)}</Text>
        ) : null
      return siki ? (
        <Box key={'m' + m.n} flexDirection="row" justifyContent={benim ? 'flex-end' : 'flex-start'} gap={1}>
          {benim ? alt : balon}
          {benim ? balon : alt}
        </Box>
      ) : (
        <Box key={'m' + m.n} flexDirection="column" alignItems={benim ? 'flex-end' : 'flex-start'} {...(yeniKonusan ? { marginTop: 1 } : {})}>
          {balon}
          {alt}
        </Box>
      )
    }
    const buzKiricilar = ['Şu an ne üzerinde çalışıyorsun?', 'Tab mı space mi?', "Bugünün en saçma bug'ı neydi?"]
    const eylemler = (
      <Box flexDirection="row" gap={2} flexWrap="wrap">
        <Button key="bitir" plain label={s.kalici ? 'Bağlantıyı sil' : 'Ayrıl'} onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, ayrilOnay: s.id }))} />
        <Button key="engelle" plain label="Engelle" onPress={() => void guvenli($, () => eylem($, 'engelle', s.id))} />
        <Button key="sikayet" plain label="Bildir" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, bildirForm: s.id }))} />
        {kalEtiket && !s.bitti ? (
          <Button key="kal" variant={kalEtiket.primary ? 'primary' : undefined} plain={kalEtiket.primary ? undefined : true} label={kalEtiket.label} onPress={() => void guvenli($, () => kalIstegi($, s.id))} />
        ) : null}
      </Box>
    )

    return (
      <Box flexDirection="column" gap={siki ? 0 : 1} {...(sabit ? { height: govdeSatir } : {})}>
        <Box flexDirection="column" flexShrink={0} gap={siki ? 0 : 1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Button key="geri-liste" plain label={'← Sohbetler' + (digerOkunmamis > 0 ? ` ● ${digerOkunmamis}` : '')} onPress={() => void sohbetAc($, null)} />
            {masaustu ? Avatar(karsi, 'av-karsi', s.karsi.cins) : <Text color={kisiRenk(karsi, s.karsi.cins)}>◆</Text>}
            <Box flexDirection={dar ? 'column' : 'row'}>
              <Text>
                {Ad(karsi, s.karsi.cins)}
                {s.kalici ? <Text color={TURUNCU}> ★</Text> : null}
              </Text>
              <Text {...KUCUK}>{dar ? durumYazi : `  ${durumYazi}`}</Text>
            </Box>
          </Box>
          {acik && !dar && eylemler}
        </Box>
        {acik && dar && eylemler}
        {serit}
        </Box>

        <Box
          flexDirection="column"
          gap={0}
          paddingY={siki ? 0 : 1}
          {...(sabit ? { flexGrow: 1, flexShrink: 1, minHeight: 0, overflow: 'hidden', justifyContent: 'flex-end' } : {})}
        >
          {gizli > 0 ? (
            sabit ? null : <Text dimColor>↑ {gizli} eski mesaj</Text>
          ) : (
            <Box flexDirection="row" alignItems="center" gap={1}>
              {masaustu && f.rumuz ? Avatar(f.rumuz, 'av-es-ben', f.ben) : null}
              {masaustu ? Avatar(karsi, 'av-es-o', s.karsi.cins) : null}
              <Text dimColor>
                <Text color={TURUNCU}>♥ </Text>
                {karsi} ile eşleştiniz · {saat(s.eslesme)}
                {tat(s.karsi) ? ` · ${tat(s.karsi)}` : ''}
              </Text>
            </Box>
          )}
          {acik && s.mesajlar.length === 0 && (
            <Box flexDirection="row" gap={1} flexWrap="wrap">
              {buzKiricilar.map((b, i) => (
                <Button key={'buz-' + i} label={b} onPress={() => gonderTaslak(b)} />
              ))}
            </Box>
          )}
          {tuval ? (
            <Box key="sohbet-tuvali" flexDirection="column" gap={0}>
              {tuval.parcalar.map(p => (
                <ogeler.Svg key={p.key} source={p.source} width={p.width} height={p.height} alt={p.key === 'yaziyor' ? `${karsi} yazıyor` : `${karsi} ile sohbetten bir mesaj`} isInteractive />
              ))}
            </Box>
          ) : (
            gorunen.map(mesajSatiri)
          )}
          {s.bitti && !s.kalici && sabitN == null && <Text dimColor>{s.bitti.ben ? 'Sohbeti bitirdin.' : ayrilis(karsi, s.bitti.neden)}</Text>}
        </Box>

        <Box flexDirection="column" flexShrink={0} gap={siki ? 0 : 1}>
        {sabitN != null ? (
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Button
              key="en-alta"
              {...(altta > 0 ? { variant: 'primary' } : { plain: true })}
              label={`↓ En yeni mesajlar${altta > 0 ? ` (${altta})` : ''}`}
              onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, sabitN: null }))}
            />
          </Box>
        ) : null}
        {s.kalici && s.fotoIstekGeldi ? (
          <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap" borderStyle="round" borderColor={TURUNCU} paddingX={1}>
            <Text>📷 {karsi} sana fotoğraf göndermek istiyor. Almak ister misin?</Text>
            <Button key="foto-evet" variant="primary" label="Evet, al" onPress={() => void guvenli($, () => fotoIzinVer($, s.id, 'evet'))} />
            <Button key="foto-hayir" plain label="Hayır" onPress={() => void guvenli($, () => fotoIzinVer($, s.id, 'hayir'))} />
          </Box>
        ) : null}
        {s.kalici && s.fotoBenden === 'hayir' ? (
          <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
            <Text dimColor>Bu sohbette {karsi} kişisinden fotoğraf almıyorsun.</Text>
            <Button key="foto-izin-ac" plain label="Fotoğraflara izin ver" onPress={() => void guvenli($, () => fotoIzinVer($, s.id, 'evet'))} />
          </Box>
        ) : null}
        {s.mesajlar
          .filter(m => m.foto && (m.foto.mod === 'kalici' || (m.kim === 'o' && m.foto.durum !== 'goruldu')))
          .slice(-3)
          .map(m => (
            <Button
              key={'foto-' + m.foto!.id}
              plain
              label={`${m.foto!.mod === 'tek' ? '🔥 Tek gösterimlik fotoğrafı aç' : '📷 Fotoğrafı aç'} · ${m.kim === 'ben' ? 'senin' : karsi} · ${new Date(m.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`}
              onPress={() => void guvenli($, () => fotoAc($, s.id, m.foto!.id, siki))}
            />
          ))}
        {acik && uyari}
        {acik && (
          <Input
            key={'mesaj-' + s.id + '-' + d.yazSayac + (d.kisiselOnay ? '-onay' : '')}
            {...(d.kisiselOnay ? { value: d.kisiselOnay } : {})}
            placeholder={`${karsi} için bir şey yaz`}
            submitLabel="Gönder"
            autoFocus
            {...(zengin ? { rows: 2 } : {})}
            onInput={(v: string) => {
              yaziyorBildir($, s.id)
              void update($, ekran, (x: Ekran) => ({ ...x, taslak: v }))
            }}
            onSubmit={(v: string) => gonderTaslak(v)}
          />
        )}
        <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
          {s.kalici ? (
            <Button
              key="foto-gonder"
              plain
              label={s.fotoOndan === 'evet' ? '📷 Fotoğraf' : s.fotoOndan === 'hayir' ? '📷 Fotoğraf almıyor' : s.fotoIstekGitti ? '📷 İzin bekleniyor…' : '📷 Fotoğraf göndermek için izin iste'}
              onPress={() =>
                void guvenli($, async () => {
                  if (s.fotoOndan === 'evet') await update($, ekran, (x: Ekran) => ({ ...x, fotoForm: { oda: s.id, mod: 'tek' as const }, uyari: '' }))
                  else if (s.fotoOndan === 'hayir') await uyar($, `${karsi} bu sohbette fotoğraf almak istemiyor.`)
                  else if (s.fotoIstekGitti) await uyar($, 'İsteğin gitti; cevabını bekliyoruz.')
                  else await fotoIzinIste($, s.id)
                })
              }
            />
          ) : null}
          {kalEtiket && s.bitti && !s.kalici ? (
            <Button key="kal" plain label={kalEtiket.label} onPress={() => void guvenli($, () => kalIstegi($, s.id))} />
          ) : null}
          {s.bitti && !s.kalici && (
            <>
              <Text dimColor>Nasıldı?</Text>
              <Button key="iyi" plain label={s.puanBen === 'iyi' ? '[👍]' : '👍'} onPress={() => void guvenli($, () => puanVer($, s.id, 'iyi'))} />
              <Button key="kotu" plain label={s.puanBen === 'kotu' ? '[👎]' : '👎'} onPress={() => void guvenli($, () => puanVer($, s.id, 'kotu'))} />
              <Button key="kapat" plain label="Sil ve kapat" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, ayrilOnay: s.id }))} />
              <Button key="yeni" variant="primary" label="Yeni biriyle tanış" onPress={() => void guvenli($, () => sirayaGir($))} />
            </>
          )}
          {acik && siki && !odakta && <Text dimColor>Panele yazmak için ctrl+x tab</Text>}
          {acik && mobil && <Text dimColor>Kutu görünmüyorsa: /date mesajın</Text>}
        </Box>
        {!acik && uyari}
        {eskiNot}
        </Box>
      </Box>
    )
  })
}
