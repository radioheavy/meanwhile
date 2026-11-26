import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Cins, Ekran, Form, Mesaj, Ortam, Sohbet } from '../types'
import { avatar, avatarRaster, avatarSvg } from './avatar'
import { sohbetSvg } from './sohbetSvg'

// meanwhile — Claude Code içinden anonim tanışma.
// GÜVENLİK: karşı tarafın yazdığı hiçbir şey modele gitmez. Mesajlar sadece panelde görünür;
// bildirimlerde mesajın kendisi yoktur; komut çıktıları isTextDisplayOnly ile işaretlidir.
// Aynı anda birden fazla kişiyle konuşulabilir; iki taraf da isterse sohbet kalıcı olur.

const VARSAYILAN_SUNUCU = 'https://meanwhile.oktaydak.com'
// plugin.json'daki sürümle aynı olmalı.
const SURUM = '0.9.5'
// Kurar ya da günceller ve otomatik güncellemeyi açar.
const GUNCELLEME_KOMUTU = 'curl -fsSL https://meanwhile.oktaydak.com/kur.sh | sh'
// Çalışan Claude Code: zengin görünüm için en az ZENGIN_SURUM gerekir (Text weight/size, Input rows...).
const ZENGIN_SURUM = '2.1.328'
const PANEL = 'meanwhile'
const BASLIK = 'meanwhile'
const DESTEK_ADRESI = 'https://buymeacoffee.com/oktaydak'
// Kullanım şartları ve veri kullanımı: metin değişince sürüm değişir, herkes yeniden kabul eder.
const ONAY_SURUM = '2026-11-26'
const ONAY_MADDELERI = [
  'You’re 18 or older.',
  'Be kind. No harassment, no unwanted sexual content, no sharing anyone’s personal info.',
  'For your safety, reports are reviewed with AI help: when someone reports a chat, its latest messages are checked by an AI model (Claude) and by us. Other chats are never read.',
  'We collect usage data linked to a random ID, not to who you are: when you match, how many messages you send and how long they are, your gender and who you’re looking for. Never what anyone writes, your nickname or your photos. We use it to improve matching.',
]
const SARTLAR_ADRESI = 'https://meanwhile.oktaydak.com/terms'
const GIZLILIK_ADRESI = 'https://meanwhile.oktaydak.com/privacy'
const onayVarMi = async ($: E) => (await $.store.get(await anahtar($, 'onay'))) === ONAY_SURUM
async function onayla($: E) {
  await $.store.set(await anahtar($, 'onay'), ONAY_SURUM)
  await update($, ekran, (e: Ekran) => ({ ...e, onayGerek: false }))
}
const RUMUZ = /^[\p{L}\p{N}_.-]{2,20}$/u
const RUMUZ_UYARI = 'Nicknames can be 2–20 characters: letters, numbers, _ . and -.'
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
const BAGLANTI_UYARI = 'Connection problem, retrying…'
// "3 chats", "1 chat"
const adet = (n: number, tekil: string, cogul = tekil + 's') => `${n} ${n === 1 ? tekil : cogul}`

const ALAN_AD: Record<string, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  mobil: 'Mobile',
  oyun: 'Games',
  veri: 'Data',
  devops: 'DevOps',
  tasarim: 'Design',
  ogreniyorum: 'Learning',
}
const RUH_AD: Record<string, string> = {
  deploy: 'Waiting on a deploy',
  gece: 'Night owl',
  bug: 'Bug hunting',
  mola: 'On a break',
  ogreniyorum: 'Learning something',
  toplanti: 'Stuck in a meeting',
}

// /meanwhile alt komutları: İngilizce adlar asıl; eski Türkçe adlar sessiz takma ad.
const KOMUT_TAKMA: Record<string, string> = {
  yeni: 'new',
  sohbetler: 'chats',
  liste: 'chats',
  list: 'chats',
  oku: 'open',
  git: 'open',
  kal: 'stay',
  bitir: 'end',
  engelle: 'block',
  bildir: 'report',
  şikayet: 'report',
  sikayet: 'report',
  engellediklerim: 'blocked',
  engeller: 'blocked',
  'geri-bildirim': 'feedback',
  geribildirim: 'feedback',
  destek: 'support',
  bagis: 'support',
  öneri: 'feedback',
  oneri: 'feedback',
  sürüm: 'version',
  surum: 'version',
  kur: 'setup',
  profil: 'profile',
  sunucu: 'server',
  ayrıl: 'leave',
  ayril: 'leave',
  çık: 'leave',
  cik: 'leave',
  yardım: 'help',
  yardim: 'help',
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
const ekran = atom({ plugin: 'meanwhile', key: 'ekran' } as const, BOS_EKRAN, { shape: 'ekran-2' })
const ortam = atom({ plugin: 'meanwhile', key: 'ortam' } as const, { zengin: false, surum: '' } as Ortam, { shape: 'ortam-1' })
const form = atom({ plugin: 'meanwhile', key: 'form' } as const, { rumuz: '', ben: 'x', ara: 'x', alan: '', ruh: '', adim: 0 } as Form, {
  shape: 'form-3',
})

type Profil = { rumuz: string; ben: Cins; ara: Cins; alan?: string; ruh?: string }
type E = EngineInterface

// Kontrol karakterlerini (ANSI kaçışları dahil) at.
const temiz = (s: unknown) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, '')

let durdur: { cancel: () => void } | null = null
let yokluyor = false
let sonYuzey = '' // en son çizildiği yüzey (terminal, desktop, mobile…): yalnızca kullanım istatistiği için
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
// Her pencere bir "profil yuvası" kullanır; varsayılan hepsinde ortak. /meanwhile profil <ad> o pencereyi ayırır.
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
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, 'x-meanwhile-surum': SURUM, 'x-meanwhile-claude': (await read($, ortam)).surum || '', 'x-meanwhile-yuzey': sonYuzey },
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
    const r = await $.http.fetch((await sunucu($)) + '/api/surum', { headers: { 'x-meanwhile-surum': SURUM } })
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
      ? `💬 ${okunmamis} unread`
      : e.sirada
        ? '⏳ meanwhile · looking for someone…'
        : e.sohbetler.some(s => !s.bitti)
          ? `💬 meanwhile · ${adet(e.sohbetler.filter(s => !s.bitti).length, 'chat')}`
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
    if (yeniEslesme.includes(x.karsi.rumuz) && (await birKez($, 'es:' + x.id))) void sistemBildirimi($, 'meanwhile', `👋 You matched with ${x.karsi.rumuz}`)
    const sonO = [...x.mesajlar].reverse().find(m => m.kim === 'o')
    if (sonO && x.okunmamis > 0 && x.id !== e.aktif && (await birKez($, `m:${x.id}:${sonO.n}`)))
      void sistemBildirimi($, 'meanwhile', `💬 ${x.karsi.rumuz} sent ${x.okunmamis > 1 ? `${x.okunmamis} messages` : 'a new message'}`)
    if (x.fotoIstekGeldi && (await birKez($, 'fi:' + x.id))) void sistemBildirimi($, 'meanwhile', `📷 ${x.karsi.rumuz} wants to send you photos`)
    if (!x.kalici && x.kalO && !x.kalBen && (await birKez($, 'kal:' + x.id))) void sistemBildirimi($, 'meanwhile', `★ ${x.karsi.rumuz} wants to stay connected`)
  }
  for (const rumuz of yeniEslesme) {
    // Klavyeyi çalmıyoruz: Claude'a yazarken yanlışlıkla yabancıya yazılmasın.
    void $.ui.open({ id: PANEL, title: BASLIK }).catch(() => {})
    $.ui.toast(`👋 You matched with ${rumuz} · ctrl+x tab to switch to the panel`)
  }
  for (const x of e.sohbetler) {
    if (x.fotoIstekGeldi && !fotoIstekBildirildi.has(x.id)) {
      fotoIstekBildirildi.add(x.id)
      $.ui.toast(`📷 ${x.karsi.rumuz} wants to send you photos`)
    }
  }
  // Ekran paylaşırken okunmasın: bildirimlerde mesajın kendisi yok.
  for (const y of yeniMesaj) $.ui.toast(`💬 ${y.rumuz} sent ${y.adet > 1 ? `${y.adet} messages` : 'a new message'}`)
  for (const b of biten) $.ui.toast(ayrilis(b.rumuz, b.neden))
  durumSatiri($, e)
  if (!e.sirada && e.sohbetler.length === 0) yoklamayiDurdur($)
}

// Karşı tarafa nedenini açık etmeden, sıcak bir dille söyle (engellendiğini bilmesin).
function ayrilis(rumuz: string, neden: string | undefined): string {
  if (neden === 'bağlantısı koptu') return `Lost connection with ${rumuz}.`
  return `${rumuz} left the chat.`
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
        'if command -v notify-send >/dev/null 2>&1; then notify-send -a meanwhile "$1" "$2"; ' +
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
// Yoklama sıklığı: sırada beklerken, açık bir sohbetteyken, sıradan (kalıcı olmayan) bir sohbet
// sürerken ya da son bir dakikada mesaj geldiyse 2,5 sn; yalnızca kalıcı bağlantılar varken 20 sn.
// Saat her 2,5 sn'de bir kontrol eder ama sunucuya sadece gerektiğinde sorar.
const HIZLI_ARALIK = 2500
const YAVAS_ARALIK = 20_000
let sonYoklama = 0
let sonHareket = 0
function canliMi(e: Ekran) {
  return e.sirada || !!e.aktif || e.sohbetler.some(s => !s.kalici && !s.bitti) || Date.now() - sonHareket < 60_000
}

async function yokla($: E, zorla = true) {
  if (yokluyor) return
  yokluyor = true
  try {
    const e = await read($, ekran)
    if (!zorla && !canliMi(e) && Date.now() - sonYoklama < YAVAS_ARALIK - 500) return
    sonYoklama = Date.now()
    const imlec = e.sohbetler.map(s => `${s.id}:${s.son}`).join(',')
    await isle($, await api($, '/api/durum' + (imlec ? '?son=' + imlec : '')))
    const yeni = (await read($, ekran)).sohbetler.map(s => `${s.id}:${s.son}`).join(',')
    if (yeni !== imlec) sonHareket = Date.now()
  } catch {
    await uyar($, BAGLANTI_UYARI)
  } finally {
    yokluyor = false
  }
}

async function yoklamayiBaslat($: E) {
  await $.store.set(await anahtar($, 'aktif'), true)
  if (durdur) return
  durdur = $.clock.every(HIZLI_ARALIK, () => void yokla($, false))
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
  if (!(await onayVarMi($))) {
    await update($, ekran, (e: Ekran) => ({ ...e, onayGerek: true }))
    return
  }
  await update($, ekran, (e: Ekran) => ({ ...e, durum: 'ana' as const, sirada: true, aktif: null, liste: null, uyari: '' }))
  $.ui.status('⏳ meanwhile · looking for someone…')
  await isle($, await api($, '/api/kuyruk', { ...p, yas18: true, onay: ONAY_SURUM }))
  await yoklamayiBaslat($)
}

async function siradanCik($: E) {
  await isle($, await api($, '/api/sira-cik', {}))
}

// Kendi taslağında telefon, e-posta, link ya da kullanıcı adı varsa göndermeden önce bir kez uyar.
const KISISEL: [RegExp, string][] = [
  [/(\+?\d[\d\s().-]{8,}\d)/, 'a phone number'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, 'an email address'],
  [/(https?:\/\/|www\.)\S+/i, 'a link'],
  [/(^|\s)@[\w.]{3,}/, 'a username'],
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
      uyari: `This looks like ${kisisel[1]}. Are you sure? Press Send again to send it anyway.`,
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
      uyari: /slow down|ended/i.test(String(err?.message)) ? String(err.message) : 'Connection lost, your message wasn’t sent. You can type it and send it again.',
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
  const kim = s?.karsi.rumuz ?? 'This person'
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
        ? `${kim} is blocked. You won’t run into each other again.`
        : ad === 'sikayet'
          ? `Reported. You won’t be matched with ${kim} again. Thanks.`
          : ad === 'bitir' && s?.kalici
            ? `You deleted your connection with ${kim}.`
            : ad === 'bitir' && s?.bitti
              ? `Your chat with ${kim} was deleted.`
              : ad === 'bitir'
                ? `You left the chat with ${kim}. It’ll be deleted once they leave too.`
                : ad === 'kapat'
                  ? `Your chat with ${kim} was deleted.`
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
  if (r.kalici) $.ui.toast(`★ You and ${s.karsi.rumuz} are connected. Your chat is kept.`)
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

// Panodaki görseli "$1" dosyasına yazar. Çıkış: 0 tamam (dosya kopyalandıysa yolunu basar),
// 1 panoda görsel yok, 3 pano aracı yok. X11, Wayland ve macOS; DISPLAY yoksa ilk X ekranını dener.
const PANO_BETIGI = `
out="$1"
if [ "$(uname)" = Darwin ]; then
  osascript -e 'set f to open for access POSIX file "'"$out"'" with write permission' -e 'set eof f to 0' -e 'write (the clipboard as «class PNGf») to f' -e 'close access f' >/dev/null 2>&1 || pngpaste "$out" >/dev/null 2>&1
  test -s "$out" && exit 0
  exit 1
fi
if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ]; then
  n=$(ls /tmp/.X11-unix 2>/dev/null | sed -n 's/^X//p' | head -n 1)
  [ -n "$n" ] && export DISPLAY=":$n"
fi
dosya() {
  for u in $(cat); do
    case "$u" in file://*) f=$(printf '%s\\n' "\${u#file://}" | awk '{ h="0123456789abcdef"; o=""; s=$0; while ((i = index(s, "%")) > 0 && i + 2 <= length(s)) { o = o substr(s, 1, i - 1); x = tolower(substr(s, i + 1, 2)); o = o sprintf("%c", (index(h, substr(x, 1, 1)) - 1) * 16 + index(h, substr(x, 2, 1)) - 1); s = substr(s, i + 3) } printf "%s", o s }');; /*) f="$u";; *) continue;; esac
    case "$(printf %s "$f" | tr 'A-Z' 'a-z')" in *.png|*.jpg|*.jpeg|*.webp|*.gif|*.bmp|*.heic|*.tif|*.tiff) [ -f "$f" ] && { printf %s "$f"; exit 0; };; esac
  done
  exit 1
}
if [ -n "$WAYLAND_DISPLAY" ] && command -v wl-paste >/dev/null 2>&1; then
  tur=$(wl-paste --list-types 2>/dev/null | grep -m1 '^image/')
  if [ -n "$tur" ]; then wl-paste --type "$tur" > "$out" 2>/dev/null; test -s "$out" && exit 0; fi
  wl-paste --type text/uri-list 2>/dev/null | tr -d '\r' | dosya && exit 0
fi
if command -v xclip >/dev/null 2>&1; then
  turler=$(xclip -selection clipboard -t TARGETS -o 2>/dev/null)
  tur=$(printf '%s\n' "$turler" | grep -m1 '^image/')
  if [ -n "$tur" ]; then xclip -selection clipboard -t "$tur" -o > "$out" 2>/dev/null; test -s "$out" && exit 0; fi
  { xclip -selection clipboard -t x-special/gnome-copied-files -o 2>/dev/null; xclip -selection clipboard -t text/uri-list -o 2>/dev/null; } | tr -d '\r' | grep -v '^copy$\|^cut$' | dosya && exit 0
  exit 1
fi
command -v wl-paste >/dev/null 2>&1 && exit 1
exit 3
`

// Sistemin dosya seçme penceresi: macOS'ta Finder, Linux'ta zenity ya da kdialog.
// Seçilen yolu verir; vazgeçilirse null.
async function dosyaSec($: E): Promise<string | null> {
  const r = await $.process
    .run(
      [
        'sh',
        '-c',
        `if [ "$(uname)" = Darwin ]; then osascript -e 'POSIX path of (choose file of type {"public.image"} with prompt "Choose a photo to send")' 2>/dev/null; exit $?; fi
if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ]; then n=$(ls /tmp/.X11-unix 2>/dev/null | sed -n 's/^X//p' | head -n 1); [ -n "$n" ] && export DISPLAY=":$n"; fi
if command -v zenity >/dev/null 2>&1; then zenity --file-selection --title="Choose a photo to send" --file-filter='Images | *.png *.jpg *.jpeg *.webp *.gif *.bmp *.heic *.PNG *.JPG *.JPEG' 2>/dev/null; exit $?; fi
if command -v kdialog >/dev/null 2>&1; then kdialog --getopenfilename "$HOME" 'image/png image/jpeg image/webp image/gif' 2>/dev/null; exit $?; fi
exit 3`,
      ],
      { timeoutMs: 600_000 },
    )
    .catch(() => ({ exitCode: 127, stdout: '' }) as { exitCode: number; stdout: string })
  if (r.exitCode === 3 || r.exitCode === 127) throw new Error('No file picker found. On Linux, install zenity or kdialog; or copy the image and use Paste.')
  const yol = r.stdout.trim()
  return r.exitCode === 0 && yol ? yol : null
}

// Panodaki ekran görüntüsünü ya da verilen dosyayı küçültür, içindeki bütün bilgileri
// (GPS konumu dahil) siler ve base64 JPEG olarak verir. ffmpeg, sips (macOS) ya da ImageMagick kullanır.
async function fotoHazirla($: E, kaynak: string): Promise<{ b64: string; tur: string }> {
  const gecici = (await calistir($, ['mktemp', '-d'])).stdout.trim()
  if (!gecici) throw new Error('Couldn’t create a temporary folder.')
  try {
    let girdi = kaynak.replace(/^~(?=\/)/, (await calistir($, ['sh', '-c', 'printf %s "$HOME"'])).stdout.trim())
    if (kaynak === 'pano') {
      girdi = gecici + '/pano.png'
      const r = await calistir($, ['sh', '-c', PANO_BETIGI, 'sh', girdi])
      const kopyalanan = r.stdout.trim()
      if (r.exitCode === 3) throw new Error('Reading the clipboard needs xclip (X11) or wl-clipboard (Wayland). Install one, or use Browse.')
      if (r.exitCode !== 0) throw new Error('There’s no image on the clipboard. Take a screenshot or copy an image first, or use Browse.')
      // Dosya yöneticisinden kopyalanmış bir resim dosyası: doğrudan onu kullan.
      if (kopyalanan.startsWith('/')) girdi = kopyalanan
    } else if (!(await $.fs.exists(girdi))) throw new Error('No file at this path: ' + kaynak)
    const cikti = gecici + '/foto.jpg'
    for (const [en, q] of [[960, 5], [720, 6], [560, 7], [420, 9], [320, 12]] as const) {
      let r = await calistir($, ['ffmpeg', '-loglevel', 'error', '-y', '-i', girdi, '-vf', `scale='min(${en},iw)':-2`, '-map_metadata', '-1', '-q:v', String(q), cikti])
      if (r.exitCode !== 0) r = await calistir($, ['magick', girdi, '-auto-orient', '-strip', '-resize', `${en}x${en}>`, '-quality', String(90 - q * 4), cikti])
      if (r.exitCode !== 0) r = await calistir($, ['convert', girdi, '-auto-orient', '-strip', '-resize', `${en}x${en}>`, '-quality', String(90 - q * 4), cikti])
      if (r.exitCode !== 0) r = await calistir($, ['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', String(90 - q * 4), '-Z', String(en), girdi, '--out', cikti])
      if (r.exitCode !== 0) throw new Error('Preparing a photo needs ffmpeg or ImageMagick (on macOS, sips is enough).')
      const b64 = (await calistir($, ['sh', '-c', 'base64 < "$1" | tr -d "\\n\\r"', 'sh', cikti])).stdout.trim()
      if (b64 && b64.length <= FOTO_SINIR) return { b64, tur: 'jpeg' }
    }
    throw new Error('Couldn’t shrink the photo; try a smaller image.')
  } finally {
    void calistir($, ['rm', '-rf', gecici])
  }
}

async function fotoIzinIste($: E, oda: string) {
  const r = await api($, '/api/foto-istek', { oda })
  await update($, ekran, (e: Ekran) => ({
    ...sohbetGuncelle(e, oda, x => ({ ...x, fotoIstekGitti: r.izin !== 'evet', fotoOndan: r.izin === 'evet' ? 'evet' : x.fotoOndan })),
    fotoForm: r.izin === 'evet' ? { oda, mod: 'tek' as const } : e.fotoForm,
    uyari: r.izin === 'evet' ? '' : 'Request sent. If they accept, you can send photos.',
  }))
}

async function fotoIzinVer($: E, oda: string, izin: 'evet' | 'hayir') {
  await api($, '/api/foto-izin', { oda, izin })
  await update($, ekran, (e: Ekran) => sohbetGuncelle(e, oda, x => ({ ...x, fotoBenden: izin, fotoIstekGeldi: false })))
}

async function fotoAyari($: E, al: 'sor' | 'hayir') {
  await api($, '/api/foto-ayar', { al })
  await update($, ekran, (e: Ekran) => ({ ...e, fotoAl: al, uyari: al === 'hayir' ? 'You no longer accept photos from anyone.' : 'You’ll be asked about photo requests again.' }))
}

async function fotoGonder($: E, oda: string, mod: 'tek' | 'kalici', kaynak: string) {
  await uyar($, 'Preparing the photo…')
  const { b64, tur } = await fotoHazirla($, kaynak)
  const r = await api($, '/api/foto', { oda, b64, tur, mod })
  await update($, ekran, (e: Ekran) => ({
    ...sohbetGuncelle(e, oda, x => ({
      ...x,
      mesajlar: [...x.mesajlar, { n: r.n, kim: 'ben' as const, metin: mod === 'tek' ? '📷 View-once photo' : '📷 Photo', at: Date.now(), foto: r.foto }].slice(-200),
      son: Math.max(x.son, r.n),
    })),
    fotoForm: null,
    uyari: mod === 'tek' ? 'View-once photo sent. It’ll be deleted once it’s opened.' : 'Photo sent.',
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
  const yol = `${gecici}/meanwhile-${id}.jpg`
  await calistir($, ['sh', '-c', 'printf %s "$1" | base64 -d > "$2" 2>/dev/null || printf %s "$1" | base64 -D > "$2"', 'sh', f.b64, yol])
  const ac = await calistir($, ['sh', '-c', '(xdg-open "$1" || open "$1") >/dev/null 2>&1 &', 'sh', yol])
  if (ac.exitCode !== 0) throw new Error('Couldn’t open the photo.')
  // Tek gösterimlik fotoğrafın dosyası bir dakika sonra silinir.
  $.clock.after(f.mod === 'tek' ? 60_000 : 600_000, () => void calistir($, ['rm', '-rf', gecici]))
  await uyar($, f.mod === 'tek' ? '🔥 View-once photo opened; it’ll be deleted from your computer in a minute too.' : 'Photo opened.')
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
  await update($, ekran, (e: Ekran) => ({ ...e, liste: r.engeller ?? [], uyari: `${rumuz} is unblocked.` }))
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
  if (m.length < 3) throw new Error('Could you write a bit more? At least 3 characters.')
  await api($, '/api/geribildirim', { metin: m, yuzey })
  await update($, ekran, (e: Ekran) => ({ ...e, geriBildirim: false, uyari: 'Thanks! We got your feedback.' }))
}

const FOTO_KURALLARI = [
  'You alone are responsible for the photos you send.',
  'Nudity or sexual content, images that belong to someone else or were taken without consent, and any image showing anyone under 18 are not allowed. Reported photos are reviewed; breaking the rules means losing access and, when needed, a report to the authorities.',
  'A view-once photo is deleted after it’s opened, but the other person could still take a screenshot; meanwhile can’t prevent that.',
  'Photos are resized before they’re sent, and details like location are removed.',
]

// Fotoğraf mesajının ekranda görünen metni (durumuyla birlikte)
function fotoMetin(m: Mesaj): string {
  if (!m.foto) return m.metin
  if (m.foto.mod === 'kalici') return '📷 Photo'
  if (m.kim === 'ben') return m.foto.durum === 'goruldu' ? '🔥 View-once photo · opened' : '🔥 View-once photo · not opened yet'
  return m.foto.durum === 'goruldu' ? '🔥 View-once photo · opened, deleted' : '🔥 View-once photo · open it below'
}

// ---------- yazı modu (telefon / Remote Control: panel çizilmeyen yüzeyler) ----------
function metinSaat(t: number) {
  return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function metinListe(d: Ekran): string {
  const satirlar = ['meanwhile' + (d.sirada ? ' · looking for someone…' : '')]
  if (!d.sohbetler.length) satirlar.push('No chats right now. To meet someone new: /meanwhile new')
  d.sohbetler.forEach((s, i) => {
    const son = s.mesajlar[s.mesajlar.length - 1]
    const durum = s.bitti && !s.kalici ? 'ended' : s.karsiYaziyor ? 'typing…' : s.karsiCevrimici ? 'online' : 'offline'
    const isaret = (s.id === d.aktif ? '›' : ' ') + ` ${i + 1}. ${s.karsi.rumuz}${s.kalici ? ' ★' : ''}${s.okunmamis ? ` ● ${s.okunmamis}` : ''} · ${durum}`
    satirlar.push(isaret + (son ? `\n     ${son.kim === 'ben' ? 'you' : s.karsi.rumuz}: ${son.metin.slice(0, 80)}` : ''))
  })
  satirlar.push('', 'Open: /meanwhile open <no> · Write: /meanwhile <message> · New: /meanwhile new · Stay connected: /meanwhile stay')
  return satirlar.join('\n')
}

function metinSohbet(s: Sohbet, adet = 12): string {
  const satirlar = [`${s.karsi.rumuz}${s.kalici ? ' ★' : ''}${[ALAN_AD[s.karsi.alan ?? ''], RUH_AD[s.karsi.ruh ?? '']].filter(Boolean).map(x => ' · ' + x).join('')}`]
  if (!s.mesajlar.length) satirlar.push('No messages yet. A hello is a good start: /meanwhile hi!')
  for (const m of s.mesajlar.slice(-adet)) satirlar.push(`${metinSaat(m.at)}  ${m.kim === 'ben' ? 'you' : s.karsi.rumuz}: ${fotoMetin(m)}${m.foto ? ' (open it on your computer)' : ''}${m.durum === 'hata' ? ' (not sent)' : ''}`)
  if (s.bitti && !s.kalici) satirlar.push(s.bitti.ben ? '— You ended the chat.' : `— ${ayrilis(s.karsi.rumuz, s.bitti.neden)}`)
  if (!s.kalici && s.kalO && !s.kalBen) satirlar.push(`★ ${s.karsi.rumuz} wants to stay connected. Accept: /meanwhile stay`)
  return satirlar.join('\n')
}

// Önceki kurulumdan kimlik taşıma: kur.sh eski kayıtları (kimlik, profil, bağlantılar)
// ~/.config/meanwhile/tasima.json'a kopyalar; ilk açılışta buraya alınır, var olan anahtara dokunulmaz.
async function kimlikTasi($: E) {
  if (await $.store.get('tasindi')) return
  const r = await calistir($, ['sh', '-c', 'f="${XDG_CONFIG_HOME:-$HOME/.config}/meanwhile/tasima.json"; [ -f "$f" ] && cat "$f"'])
  const metin = r.exitCode === 0 ? r.stdout.trim() : ''
  if (metin) {
    try {
      const eski = JSON.parse(metin) as Record<string, unknown>
      for (const [k, v] of Object.entries(eski)) if ((await $.store.get(k)) === undefined) await $.store.set(k, v)
    } catch {}
  }
  await $.store.set('tasindi', true)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await kimlikTasi($)
    await $.command.register({
      name: 'meanwhile',
      description: 'meanwhile — meet someone while you code, chat in the side panel',
      argumentHint: '[message | new | chats | end | block | report | leave | help]',
    } as any)
    await $.command.register({
      name: 'mw',
      description: 'Short for /meanwhile',
      argumentHint: '[message | new | chats | end | block | report | leave | help]',
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

  // /mw, /meanwhile'ın kısası: ikisi aynı işi yapar.
  for (const ad of ['meanwhile', 'mw'])
  on('command.run', { command: ad }, async ($, e) => {
    const args = e.args.trim()
    const [ilk, ...kalan] = args.split(/\s+/)
    // İngilizce alt komutlar; eski Türkçe adlar sessizce çalışmaya devam eder.
    const ham = (ilk || '').toLowerCase()
    const hamTr = (ilk || '').toLocaleLowerCase('tr')
    const komut = KOMUT_TAKMA[hamTr] ?? KOMUT_TAKMA[ham] ?? ham
    const sonuc = (text: string) => ({ text, isTextDisplayOnly: true as const })
    // Remote Control (telefon, web) paneli çizmeyebilir: oradan gelen komutlara yazıyla cevap ver.
    const uzaktan = (e.origin as any)?.kind === 'bridge'

    try {
      if (uzaktan && (!args || komut === 'open' || komut === 'chats' || komut === 'stay')) {
        await surumKontrol($)
        if ((await read($, ekran)).guncelleme?.durum === 'zorunlu') return sonuc(`A new version of meanwhile is out; update to continue. In your terminal: ${(await read($, ekran)).guncelleme?.komut || GUNCELLEME_KOMUTU} (then restart Claude)`)
        let d = await read($, ekran)
        if (!args && (d.durum === 'kurulum' || (!d.sirada && d.sohbetler.length === 0))) {
          if (!(await profil($))) return sonuc('Set up first with /meanwhile on your computer, or: /meanwhile setup <nickname> <w|m|x> <w|m|a> 18+ agree')
          if (!(await onayVarMi($)))
            return sonuc(['A few things first:', ...ONAY_MADDELERI.map(m => '• ' + m), `Terms: ${SARTLAR_ADRESI} · Privacy: ${GIZLILIK_ADRESI}`, 'If you’re 18+ and agree: /meanwhile agree'].join('\n'))
          await sirayaGir($)
        } else await yokla($)
        await yoklamayiBaslat($)
        d = await read($, ekran)
        if (!args || komut === 'chats') return sonuc(metinListe(d))
        const no = Number(kalan[0])
        const hedef = no ? d.sohbetler[no - 1] : (d.sohbetler.find(x => x.id === d.aktif) ?? (d.sohbetler.length === 1 ? d.sohbetler[0] : undefined))
        if (!hedef) return sonuc('Which chat? Example: /meanwhile open 1\n\n' + metinListe(d))
        await sohbetAc($, hedef.id)
        if (komut === 'stay') {
          await kalIstegi($, hedef.id)
          d = await read($, ekran)
        }
        return sonuc(metinSohbet(d.sohbetler.find(x => x.id === hedef.id) ?? hedef))
      }
      if (!args) {
        await paneliAc($)
        await surumKontrol($)
        if ((await read($, ekran)).guncelleme?.durum === 'zorunlu') return sonuc(`A new version of meanwhile is out; update to continue. In your terminal: ${(await read($, ekran)).guncelleme?.komut || GUNCELLEME_KOMUTU} (then restart Claude)`)
        const d = await read($, ekran)
        if (d.durum === 'kurulum' || (!d.sirada && d.sohbetler.length === 0)) await sirayaGir($)
        return sonuc('meanwhile is open.')
      }
      if (komut === 'help') {
        return sonuc(
          [
            'meanwhile — meet someone while you code. /mw is short for /meanwhile.',
            '',
            '  /meanwhile                  open the panel and start meeting people',
            '  /meanwhile <message>        send a message to the open chat (you can also type in the panel)',
            '  /meanwhile new              meet someone new while your chats continue',
            '  /meanwhile chats            back to the chat list',
            '  /meanwhile open <no>        open that chat (on your phone: shows its latest messages)',
            '  /meanwhile stay             ask to stay connected in the open chat',
            '  /meanwhile end              leave the open chat (deleted once you both leave; deletes a connection)',
            '  /meanwhile block            never run into the person in the open chat again',
            '  /meanwhile report [reason]  report someone who bothers you',
            '  /meanwhile blocked          see who you blocked, unblock if you like',
            '  /meanwhile feedback <text>  send us an idea, a bug or a fix',
            '  /meanwhile support          buy us a coffee if you like meanwhile',
            '  /meanwhile leave            end your regular chats (connections stay)',
            '  /meanwhile version          show your version and whether an update is out',
            '  /meanwhile terms              what you agree to (terms and privacy)',
            '  /meanwhile setup <nickname> <w|m|x> <w|m|a> 18+ agree   quick setup: your gender (woman, man, prefer not to say), who to meet (women, men, anyone); 18+ confirms your age',
            '  /meanwhile profile <name>   give this window a separate identity',
            '',
            'What the other person writes only shows in the panel; your Claude session never reads it.',
          ].join('\n'),
        )
      }
      if (komut === 'version') {
        await surumKontrol($)
        const g = (await read($, ekran)).guncelleme
        return sonuc(
          g
            ? `meanwhile ${SURUM}. New version: ${g.son}. To update, run this in your terminal: ${g.komut} (then restart Claude)`
            : `meanwhile ${SURUM}. You’re up to date.`,
        )
      }
      if (komut === 'setup') {
        const [rumuz, benHam, araHam, onay] = kalan
        // setup: w|m|x ve w|m|a; eski kur: k|e|x ve h|k|e. İçeride hep k/e/x.
        const eski = hamTr === 'kur'
        const ben = eski ? benHam : ({ w: 'k', m: 'e', x: 'x' } as Record<string, string>)[(benHam ?? '').toLowerCase()]
        const ara = eski ? (araHam === 'h' ? 'x' : araHam) : ({ w: 'k', m: 'e', a: 'x' } as Record<string, string>)[(araHam ?? '').toLowerCase()]
        const kabul = (kalan[4] || '').toLowerCase() === 'agree'
        if (!rumuz || !RUMUZ.test(rumuz) || !/^[kex]$/.test(ben ?? '') || !/^[kex]$/.test(ara ?? '') || onay !== '18+' || !kabul)
          return sonuc(
            'Usage: /meanwhile setup <nickname> <w|m|x> <w|m|a> 18+ agree\n' +
              RUMUZ_UYARI +
              '\nw|m|x is your gender (woman, man, prefer not to say); w|m|a is who you want to meet (women, men, anyone). "18+ agree" confirms you’re 18 or older and agree to the following:\n' +
              ONAY_MADDELERI.map(m => '• ' + m).join('\n') +
              `\nTerms: ${SARTLAR_ADRESI} · Privacy: ${GIZLILIK_ADRESI}`,
          )
        await kaydet($, { rumuz, ben: ben as Cins, ara: ara as Cins })
        await onayla($)
        return sonuc(`You’re all set, ${rumuz}. Start with /meanwhile.`)
      }
      if (komut === 'profile') {
        const ad = (kalan[0] || '').toLocaleLowerCase('tr')
        if (ad && !/^[a-z0-9_-]{1,20}$/.test(ad)) return sonuc('Profile names can use a-z, 0-9, _ and -.')
        const id = await $.session.id()
        if (!ad || ad === 'varsayilan') await $.store.delete('yuva:' + id)
        else await $.store.set('yuva:' + id, ad)
        yoklamayiDurdur($)
        await update($, ekran, () => BOS_EKRAN)
        const p = await profil($)
        await update($, form, () => ({ rumuz: '', ben: 'x' as Cins, ara: 'x' as Cins, alan: '', ruh: '', ...p, adim: 0 }))
        return sonuc(`This window now uses the "${!ad || ad === 'varsayilan' ? 'default' : ad}" profile${p ? ` (${p.rumuz})` : ''}. Start with /meanwhile.`)
      }
      if (komut === 'server') {
        if (kalan[0]) await $.store.set(await anahtar($, 'sunucu'), kalan[0])
        else await $.store.delete(await anahtar($, 'sunucu'))
        return sonuc('server: ' + (await sunucu($)))
      }
      if (komut === 'agree') {
        await onayla($)
        return sonuc('Thanks, you’re all set. Start with /meanwhile.')
      }
      if (komut === 'terms')
        return sonuc(['meanwhile: what you agree to', ...ONAY_MADDELERI.map(m => '• ' + m), `Terms: ${SARTLAR_ADRESI}`, `Privacy: ${GIZLILIK_ADRESI}`, 'To agree: /meanwhile agree'].join('\n'))
      if (komut === 'support') return sonuc(`Thanks for thinking of it ☕ ${DESTEK_ADRESI}`)
      if (komut === 'feedback') {
        const metin = kalan.join(' ')
        if (!metin) {
          await paneliAc($)
          await update($, ekran, (x: Ekran) => ({ ...x, geriBildirim: true, aktif: null }))
          return sonuc('The feedback form is in the panel. Or send it directly: /meanwhile feedback <your text>')
        }
        await geriBildirimGonder($, metin, uzaktan ? 'telefon' : 'komut')
        return sonuc('Thanks! We got your feedback.')
      }
      if (komut === 'blocked') {
        await paneliAc($)
        await engelleriAc($)
        return sonuc('Your blocked list is in the panel.')
      }
      if (komut === 'new') {
        await paneliAc($)
        await sirayaGir($)
        return sonuc('Looking for someone for you; your other chats stay open.')
      }
      if (komut === 'chats') {
        await paneliAc($)
        await sohbetAc($, null)
        return sonuc('Your chats are in the panel.')
      }
      if (komut === 'leave') {
        await ayril($)
        return sonuc('Your regular chats have ended. Your connections stay. See you soon!')
      }
      const d = await read($, ekran)
      const acik = d.sohbetler.find(s => s.id === d.aktif) ?? (d.sohbetler.filter(s => !s.bitti || s.kalici).length === 1 ? d.sohbetler.find(s => !s.bitti || s.kalici) : undefined)
      // Bilgisayarda da: "/meanwhile open 2" sohbeti panelde açar, "/meanwhile stay" bağlantı isteği yollar
      // (yoksa bu kelimeler karşı tarafa mesaj olarak giderdi).
      if (komut === 'open') {
        const no = Number(kalan[0])
        const hedef = no ? d.sohbetler[no - 1] : undefined
        if (!hedef) return sonuc('Which chat? Example: /meanwhile open 1 (numbers follow the chat list).')
        await paneliAc($)
        await sohbetAc($, hedef.id)
        return sonuc(`Opened your chat with ${hedef.karsi.rumuz} in the panel.`)
      }
      if (komut === 'stay') {
        if (!acik || acik.bitti) return sonuc('Open a chat in the panel first.')
        if (acik.kalici) return sonuc(`You’re already connected with ${acik.karsi.rumuz}.`)
        if (acik.kalBen) return sonuc(`Request already sent. Waiting for ${acik.karsi.rumuz} ★`)
        await kalIstegi($, acik.id)
        return sonuc(acik.kalO ? `You’re now connected with ${acik.karsi.rumuz} ★` : `Request sent. If ${acik.karsi.rumuz} says yes too, you’ll stay connected ★`)
      }
      const es: Record<string, Eylem> = { end: 'bitir', block: 'engelle', report: 'sikayet' }
      if (es[komut]) {
        if (!acik) return sonuc('Open a chat in the panel first.')
        await eylem($, es[komut]!, acik.id, kalan.join(' '))
        return sonuc({ bitir: acik.kalici ? 'You deleted the connection; the chat is gone for both of you.' : acik.bitti ? 'Chat deleted.' : 'You left the chat. It’ll be fully deleted once they leave too.', engelle: 'Blocked.', sikayet: 'Report received, thanks.', kapat: '' }[es[komut]!])
      }
      if (!acik || (acik.bitti && !acik.kalici)) return sonuc('You don’t have an open chat right now. Pick one in the panel or start with /meanwhile.')
      await gonder($, acik.id, args)
      if (uzaktan) {
        await yokla($)
        const sonra = (await read($, ekran)).sohbetler.find(x => x.id === acik.id)
        const u = (await read($, ekran)).uyari
        return sonuc((u ? u + '\n\n' : '') + (sonra ? metinSohbet(sonra, 6) : 'Message sent.'))
      }
      return sonuc('Message sent.')
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
    const { Box, Text, Button, Input, Select, Link } = ogeler
    const d = await read($, ekran)
    const f = await read($, form)
    const o = await read($, ortam)
    const zengin = o.zengin
    // Yüzey ve ölçü: terminal sıkı düzen; masaüstü, mobil ve VS Code ferah düzen.
    // Genişliğe göre: dar (< 64 sütun, telefon ya da dar yan panel) her şeyi alt alta dizer.
    const yuzey = e.surface
    sonYuzey = String(yuzey || '')
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
      if (zengin && ogeler.Svg) return <ogeler.Svg key={anahtarAd} source={avatarSvg(rumuz, renk)} alt={`${rumuz}’s avatar`} width={30} height={30} />
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
    const sayac = (anaEkran || d.durum === 'kurulum') && d.cevrimici >= 5 ? `${d.cevrimici} people here right now` : ''
    const ust = (
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text {...BASLIK_S}>
          meanwhile<Text color={TURUNCU}>.</Text>
        </Text>
        {sayac ? <Text {...KUCUK}>{sayac}</Text> : null}
      </Box>
    )
    const eskiNot =
      !zengin && o.surum ? (
        <Text dimColor>
          For a nicer look, update {mobil ? 'Claude Code on your computer' : masaustu ? 'the Claude desktop app' : 'Claude Code'} (you have {o.surum}, need at least {ZENGIN_SURUM}).
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
            <Text {...BASLIK_S}>You need to update meanwhile</Text>
            <Text dimColor>
              A new version is out{g.son ? ` (${g.son})` : ''}, you have {SURUM}. To continue, run this in your terminal, then restart Claude. It also turns on auto-update, so you won’t have to do this by hand again:
            </Text>
            <Text color={TURUNCU}>{g.komut}</Text>
          </Box>
          <Box flexDirection="row" gap={1}>
            <Button key="kopyala" variant="primary" label="Copy command" onPress={() => komutKopyala(g.komut)} />
          </Box>
        </Box>
      )
    }
    // Masaüstünde küçültülmüş panel: tek bakışta okunacak özet; tıklamalar ulaşmayabilir.
    if (yerlesim === 'widget') {
      const okunmamis = okunmamisToplam(d)
      const yazan = d.sohbetler.find(x => x.karsiYaziyor)
      const ozet = okunmamis
        ? `💬 ${okunmamis} unread`
        : yazan
          ? `${yazan.karsi.rumuz} is typing…`
          : d.sirada
            ? 'looking for someone…'
            : d.sohbetler.length
              ? adet(d.sohbetler.length, 'chat')
              : 'quiet'
      return (
        <Box flexDirection="column">
          <Text {...KALIN}>
            meanwhile<Text color={TURUNCU}>.</Text>
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
            <Text dimColor>New version {g.son}: </Text>
            <Text>{g.komut}</Text>
          </Text>
          <Button key="kopyala-serit" plain label="Copy" onPress={() => komutKopyala(g.komut)} />
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
          {ogeler.Svg ? <ogeler.Svg key="foto-goruntu" source={kaynak} alt="Incoming photo" width={W} height={Math.round(W * 0.75)} /> : <Text>This photo can’t be shown on this screen.</Text>}
          <Text dimColor>{fg.mod === 'tek' ? '🔥 View once: it can’t be opened again after you close it.' : '📌 This photo stays in the chat.'}</Text>
          <Button key="foto-kapat" variant="primary" label="Close" onPress={kapat} />
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
                <Text {...BASLIK_S}>Before you send a photo</Text>
                {FOTO_KURALLARI.map((k, i) => (
                  <Text key={'kural-' + i}>• {k}</Text>
                ))}
              </Box>,
            )}
            <Box flexDirection="row" gap={2} flexWrap="wrap">
              <Button key="foto-kabul" variant="primary" label="I’ve read this and I agree" onPress={() => void guvenli($, async () => {
                await $.store.set(await anahtar($, 'fotoKabul'), true)
                await update($, ekran, (x: Ekran) => ({ ...x, fotoKabul: true }))
              })} />
              <Button key="foto-vazgec" plain label="Cancel" onPress={kapat} />
            </Box>
          </Box>
        )
      }
      return (
        <Box flexDirection="column" gap={siki ? 0 : 1}>
          {ust}
          {kart(
            <Box flexDirection="column" gap={siki ? 0 : 1}>
              <Text {...BASLIK_S}>Photo for {hedefS?.karsi.rumuz ?? ''}</Text>
              <Box flexDirection="row" gap={2} flexWrap="wrap">
                <Button key="mod-tek" plain={ff.mod !== 'tek' ? true : undefined} variant={ff.mod === 'tek' ? 'primary' : undefined} label="🔥 View once" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, fotoForm: { ...ff, mod: 'tek' as const } }))} />
                <Button key="mod-kalici" plain={ff.mod !== 'kalici' ? true : undefined} variant={ff.mod === 'kalici' ? 'primary' : undefined} label="📌 Keep in chat" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, fotoForm: { ...ff, mod: 'kalici' as const } }))} />
              </Box>
              <Text dimColor>{ff.mod === 'tek' ? 'Opens once, then it’s deleted for everyone.' : 'Stays in the chat as long as you stay connected.'}</Text>
              <Box flexDirection="row" gap={1} flexWrap="wrap">
                <Button
                  key="foto-gozat"
                  variant="primary"
                  label="📁 Browse…"
                  onPress={() =>
                    void guvenli($, async () => {
                      const yol = await dosyaSec($)
                      if (yol) await fotoGonder($, ff.oda, ff.mod, yol)
                    })
                  }
                />
                <Button key="foto-pano" label="📋 Paste from clipboard" onPress={() => gonderKaynak('pano')} />
              </Box>
            </Box>,
          )}
          <Button key="foto-vazgec" plain label="Cancel" onPress={kapat} />
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
                <Text {...BASLIK_S}>You’re leaving meanwhile</Text>
                <Text>
                  {silinecek
                    ? `You’ll leave ${adet(silinecek, 'chat')} you’re not connected in. Once the others leave too, ${silinecek === 1 ? 'it’s' : 'they’re'} fully deleted.`
                    : 'You’ll leave the queue.'}
                  {kalici ? ` ★ Your ${adet(kalici, 'connection')} ${kalici === 1 ? 'stays' : 'stay'}.` : ''}
                </Text>
              </Box>,
            )}
            <Box flexDirection="row" gap={2} flexWrap="wrap">
              <Button key="ayril-evet" variant="primary" label="Sign out" onPress={() => void guvenli($, async () => {
                await update($, ekran, (x: Ekran) => ({ ...x, ayrilOnay: null }))
                await ayril($)
              })} />
              <Button key="ayril-vazgec" plain label="Cancel" onPress={vazgec} />
            </Box>
          </Box>
        )
      }
      const hs = d.sohbetler.find(x => x.id === d.ayrilOnay)
      if (hs) {
        const oGitti = !!hs.bitti && !hs.bitti.ben && !hs.kalici
        const baslik = hs.kalici
          ? `You’re deleting your connection with ${hs.karsi.rumuz}`
          : oGitti
            ? `${hs.karsi.rumuz} already left`
            : `You’re leaving the chat with ${hs.karsi.rumuz}`
        const aciklama = hs.kalici
          ? 'The connection and all its messages are deleted for both of you. This can’t be undone.'
          : oGitti
            ? 'If you leave too, this chat is fully deleted. This can’t be undone.'
            : 'You’re not connected, so this chat is fully deleted once you both leave. Before you go, you can send one last message or offer to stay connected.'
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
              <Button key="ayril-evet" variant="primary" label={hs.kalici ? 'Delete connection' : oGitti ? 'Delete and leave' : 'Leave'} onPress={evet} />
              {!hs.kalici && !oGitti ? <Button key="son-mesaj" plain label="Write one last message" onPress={vazgec} /> : null}
              {!hs.kalici && !oGitti && !hs.kalBen ? (
                <Button key="kal-oner" plain label="★ Offer to stay connected" onPress={() => void guvenli($, async () => {
                  await update($, ekran, (x: Ekran) => ({ ...x, ayrilOnay: null }))
                  await kalIstegi($, hs.id)
                })} />
              ) : null}
              <Button key="ayril-vazgec" plain label="Cancel" onPress={vazgec} />
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
              <Text {...BASLIK_S}>Tell us something</Text>
              <Text dimColor>A bug, an idea, something you don’t like… It comes straight to us. Your nickname and version are included.</Text>
              <Input
                key="geri-bildirim-yazi"
                placeholder="e.g. the bubbles are too small, this button is confusing…"
                submitLabel="Send"
                autoFocus
                {...(zengin ? { rows: 3 } : {})}
                onSubmit={(v: string) => void guvenli($, () => geriBildirimGonder($, v, String(yuzey)))}
              />
            </Box>,
          )}
          <Button key="geri-bildirim-kapat" plain label="Cancel" onPress={kapat} />
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
                <Text {...BASLIK_S}>Blocked people</Text>
                <Text dimColor>If you unblock someone, you can be matched with them again, and your report is withdrawn.</Text>
              </Box>
              {d.liste.length === 0 ? <Text dimColor>You haven’t blocked anyone.</Text> : null}
              {d.liste.map(k => (
                <Box key={'e' + k.id} flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <Text>
                    <Text color={avatar(k.rumuz).renk}>◆ </Text>
                    {Ad(k.rumuz)}
                    <Text dimColor>{k.bildirildi ? '  reported' : '  blocked'}</Text>
                  </Text>
                  <Button key={'kaldir-' + k.id} label="Unblock" onPress={() => void guvenli($, () => engelKaldir($, k.id, k.rumuz))} />
                </Box>
              ))}
            </Box>,
          )}
          <Box flexDirection="row" gap={1}>
            <Button key="liste-kapat" variant="primary" label="Done" onPress={kapat} />
          </Box>
          {uyari}
        </Box>
      )
    }

    // ---------- şartlar ve veri kullanımı ----------
    const onayMetni = (
      <Box key="onay-metni" flexDirection="column">
        <Text bold>Before you start</Text>
        {ONAY_MADDELERI.map((m, i) => (
          <Text key={'onay-' + i} dimColor>
            • {m}
          </Text>
        ))}
        <Text dimColor>
          Full terms: <Link href={SARTLAR_ADRESI} label="Terms" /> · <Link href={GIZLILIK_ADRESI} label="Privacy" />
        </Text>
      </Box>
    )
    if (d.onayGerek && d.durum !== 'kurulum') {
      return (
        <Box flexDirection="column" gap={siki ? 0 : 1}>
          {ust}
          {kart(
            <>
              <Text {...BASLIK_S}>A few things first</Text>
              {onayMetni}
            </>,
          )}
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Button key="onay-hayir" plain label="Not now" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, onayGerek: false }))} />
            <Button
              key="onay-evet"
              variant="primary"
              label="I’m 18+ and I agree"
              onPress={() =>
                void guvenli($, async () => {
                  await onayla($)
                  await sirayaGir($)
                })
              }
            />
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
        baslik = 'What should we call you?'
        govde = (
          <Box flexDirection={dar ? 'column' : 'row'} alignItems={dar ? 'flex-start' : 'center'} gap={dar ? 1 : 2}>
            <Box flexGrow={1} flexDirection="column">
              <Text dimColor>Not your real name. Your avatar is generated from it.</Text>
              <Input
                key="rumuz"
                label="Nickname"
                placeholder="e.g. midnight_coder"
                value={f.rumuz}
                submitLabel="Continue"
                autoFocus
                onInput={(v: string) => void update($, form, (x: Form) => ({ ...x, rumuz: v }))}
                onSubmit={(v: string) => rumuzDevam(v)}
              />
            </Box>
            {RUMUZ.test(f.rumuz.trim()) && (
              <Box flexDirection="column" alignItems="center">
                {Avatar(f.rumuz.trim(), 'av-onizleme')}
                <Text {...KUCUK}>your avatar</Text>
              </Box>
            )}
          </Box>
        )
      } else if (adim === 1) {
        baslik = `Nice to meet you, ${f.rumuz}.`
        govde = (
          <Box flexDirection={siki && !dar ? 'row' : 'column'} gap={siki && !dar ? 4 : 1}>
            <Select
              key="ben"
              label="Your gender"
              autoFocus
              value={f.ben}
              options={[
                { value: 'k', label: 'Woman' },
                { value: 'e', label: 'Man' },
                { value: 'x', label: 'Prefer not to say' },
              ]}
              onSelect={(v: string) => void update($, form, (x: Form) => ({ ...x, ben: v as Cins }))}
            />
            <Select
              key="ara"
              label="Looking for"
              value={f.ara}
              options={[
                { value: 'x', label: 'Anyone' },
                { value: 'k', label: 'Women' },
                { value: 'e', label: 'Men' },
              ]}
              onSelect={(v: string) => void update($, form, (x: Form) => ({ ...x, ara: v as Cins }))}
            />
            <Text dimColor>Others see your gender as a color: pink for women, blue for men. Who you’re looking for stays hidden.</Text>
          </Box>
        )
      } else {
        baslik = `All set, ${f.rumuz}.`
        govde = (
          <Box flexDirection="column" gap={siki ? 0 : 1}>
            <Box flexDirection={siki && !dar ? 'row' : 'column'} gap={siki && !dar ? 4 : 1}>
              <Select
                key="alan"
                label="Your field (optional)"
                value={f.alan ?? ''}
                options={[{ value: '', label: 'Prefer not to say' }, ...Object.entries(ALAN_AD).map(([value, label]) => ({ value, label }))]}
                onSelect={(v: string) => void update($, form, (x: Form) => ({ ...x, alan: v }))}
              />
              <Select
                key="ruh"
                label="Right now (optional)"
                value={f.ruh ?? ''}
                options={[{ value: '', label: 'Prefer not to say' }, ...Object.entries(RUH_AD).map(([value, label]) => ({ value, label }))]}
                onSelect={(v: string) => void update($, form, (x: Form) => ({ ...x, ruh: v }))}
              />
            </Box>
            <Text dimColor>The other person sees these.</Text>
            {onayMetni}
          </Box>
        )
      }

      const devam =
        adim === 0 ? null : adim === 1 ? (
          <Button key="devam" variant="primary" label="Continue" onPress={() => void ileri({})} />
        ) : (
          <Button
            key="basla"
            variant="primary"
            label="I’m 18+ and I agree, let’s go"
            onPress={() =>
              void guvenli($, async () => {
                const x = await read($, form)
                await kaydet($, { rumuz: x.rumuz, ben: x.ben, ara: x.ara, alan: x.alan ?? '', ruh: x.ruh ?? '' })
                await onayla($)
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
            <ogeler.Progress label="Setup" value={adim + 1} max={3} valueText={`${adim + 1} / 3`} color={TURUNCU} />
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
              {adim > 0 ? <Button key="geri" plain label="Back" onPress={geri} /> : <Text> </Text>}
              {devam}
            </Box>
          )}
          {uyari}
          {eskiNot}
        </Box>
      )
    }

    const saat = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const aktif = d.sohbetler.find(s => s.id === d.aktif)

    // ---------- sohbet listesi ----------
    if (!aktif) {
      const digerleri = d.sohbetler
      const aramaKarti = d.sirada ? (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" {...(masaustu ? { borderStyle: 'round', borderColor: GRI_CIZGI, paddingX: 1 } : {})}>
          <Text>
            <Text color={TURUNCU}>● </Text>
            <Text {...KALIN}>Looking for someone…</Text>
            <Text dimColor>  we’ll let you know</Text>
          </Text>
          <Button key="vazgec-ara" plain label="Cancel" onPress={() => void guvenli($, () => siradanCik($))} />
        </Box>
      ) : (
        <Box flexDirection="row" gap={1} alignItems="center">
          <Button key="ara" variant="primary" label="Meet someone new" onPress={() => void guvenli($, () => sirayaGir($))} />
          {digerleri.length === 0 && <Text dimColor>You’re not talking to anyone right now.</Text>}
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
                    ? { yazi: 'ended', vurgu: false }
                    : s.okunmamis > 0
                      ? { yazi: `● ${s.okunmamis} new`, vurgu: true }
                      : s.karsiYaziyor
                        ? { yazi: 'typing…', vurgu: false }
                        : son?.kim === 'o'
                          ? { yazi: 'your turn', vurgu: false }
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
              {digerleri.length > satirSigan && <Text dimColor>+{adet(digerleri.length - satirSigan, 'more chat')}</Text>}
            </Box>
          )}
          <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
            {!siki && f.rumuz ? Avatar(f.rumuz, 'av-ben', f.ben) : null}
            <Text dimColor>
              You appear as {f.rumuz}{tat(f) ? ` · ${tat(f)}` : ''}
            </Text>
            <Button key="profil" plain label="Edit my profile" onPress={() => void guvenli($, () => duzenlemeyeGec($))} />
            <Button key="engeller" plain label="Blocked people" onPress={() => void guvenli($, () => engelleriAc($))} />
            <Button
              key="bildirim-ayar"
              plain
              label={d.bildirimKapali ? '🔕 Notifications off (turn on)' : '🔔 Notifications on'}
              onPress={() =>
                void guvenli($, async () => {
                  const kapali = !d.bildirimKapali
                  await $.store.set(await anahtar($, 'bildirim'), kapali ? 'kapali' : 'acik')
                  await update($, ekran, (x: Ekran) => ({ ...x, bildirimKapali: kapali, uyari: kapali ? 'System notifications are off.' : 'System notifications are on.' }))
                  if (!kapali) void sistemBildirimi($, 'meanwhile', '🔔 Notifications on')
                })
              }
            />
            <Button key="foto-ayar" plain label={d.fotoAl === 'hayir' ? '📷 Not accepting photos (turn on)' : '📷 Photos: ask me first'} onPress={() => void guvenli($, () => fotoAyari($, d.fotoAl === 'hayir' ? 'sor' : 'hayir'))} />
            <Button key="geri-bildirim" plain label="Feedback" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, geriBildirim: true, uyari: '' }))} />
            <Text key="destek">
              <Link href={DESTEK_ADRESI} label="☕ Support meanwhile" />
            </Text>
            <Button key="cik" plain label="Sign out" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, ayrilOnay: 'hepsi' }))} />
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
              <Text {...BASLIK_S}>Why are you reporting {karsi}?</Text>
              <Text dimColor>You won’t be matched with them again. The chat’s last messages are kept for review.</Text>
              <Select
                key="neden"
                autoFocus
                options={[
                  { value: 'taciz', label: 'Harassment or insults' },
                  { value: 'cinsel', label: 'Unwanted sexual content' },
                  { value: 'resit-degil', label: 'Might be under 18' },
                  { value: 'spam', label: 'Spam or ads' },
                  { value: 'diger', label: 'Something else' },
                ]}
                onSelect={neden}
              />
            </>,
          )}
          <Button key="vazgec" plain label="Cancel" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, bildirForm: null }))} />
        </Box>
      )
    }

    const kalEtiket = s.kalici
      ? null
      : s.kalO && !s.kalBen
        ? { label: `★ ${karsi} wants to stay connected, accept`, primary: true }
        : s.kalBen
          ? { label: '★ Request sent', primary: false }
          : { label: '★ Stay connected', primary: false }
    const durumYazi = s.bitti && !s.kalici ? 'chat ended' : s.karsiYaziyor ? 'typing…' : s.karsiCevrimici ? 'online' : s.kalici ? 'offline · they’ll get your message' : 'offline'

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
          <Text {...SAAT}>sending…</Text>
        ) : m.durum === 'hata' ? (
          <Text color={TURUNCU}>not sent</Text>
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
    const buzKiricilar = ['What are you working on right now?', 'Tabs or spaces?', 'What’s the weirdest bug you hit today?']
    const eylemler = (
      <Box flexDirection="row" gap={2} flexWrap="wrap">
        <Button key="bitir" plain label={s.kalici ? 'Delete connection' : 'Leave'} onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, ayrilOnay: s.id }))} />
        <Button key="engelle" plain label="Block" onPress={() => void guvenli($, () => eylem($, 'engelle', s.id))} />
        <Button key="sikayet" plain label="Report" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, bildirForm: s.id }))} />
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
            <Button key="geri-liste" plain label={'← Chats' + (digerOkunmamis > 0 ? ` ● ${digerOkunmamis}` : '')} onPress={() => void sohbetAc($, null)} />
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
            sabit ? null : <Text dimColor>↑ {adet(gizli, 'older message')}</Text>
          ) : (
            <Box flexDirection="row" alignItems="center" gap={1}>
              {masaustu && f.rumuz ? Avatar(f.rumuz, 'av-es-ben', f.ben) : null}
              {masaustu ? Avatar(karsi, 'av-es-o', s.karsi.cins) : null}
              <Text dimColor>
                <Text color={TURUNCU}>♥ </Text>
                You matched with {karsi} · {saat(s.eslesme)}
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
                <ogeler.Svg key={p.key} source={p.source} width={p.width} height={p.height} alt={p.key === 'yaziyor' ? `${karsi} is typing` : `A message in your chat with ${karsi}`} isInteractive />
              ))}
            </Box>
          ) : (
            gorunen.map(mesajSatiri)
          )}
          {s.bitti && !s.kalici && sabitN == null && <Text dimColor>{s.bitti.ben ? 'You ended the chat.' : ayrilis(karsi, s.bitti.neden)}</Text>}
        </Box>

        <Box flexDirection="column" flexShrink={0} gap={siki ? 0 : 1}>
        {sabitN != null ? (
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Button
              key="en-alta"
              {...(altta > 0 ? { variant: 'primary' } : { plain: true })}
              label={`↓ Latest messages${altta > 0 ? ` (${altta})` : ''}`}
              onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, sabitN: null }))}
            />
          </Box>
        ) : null}
        {s.kalici && s.fotoIstekGeldi ? (
          <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap" borderStyle="round" borderColor={TURUNCU} paddingX={1}>
            <Text>📷 {karsi} wants to send you photos. Accept?</Text>
            <Button key="foto-evet" variant="primary" label="Yes, accept" onPress={() => void guvenli($, () => fotoIzinVer($, s.id, 'evet'))} />
            <Button key="foto-hayir" plain label="No" onPress={() => void guvenli($, () => fotoIzinVer($, s.id, 'hayir'))} />
          </Box>
        ) : null}
        {s.kalici && s.fotoBenden === 'hayir' ? (
          <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
            <Text dimColor>You’re not accepting photos from {karsi} in this chat.</Text>
            <Button key="foto-izin-ac" plain label="Allow photos" onPress={() => void guvenli($, () => fotoIzinVer($, s.id, 'evet'))} />
          </Box>
        ) : null}
        {s.mesajlar
          .filter(m => m.foto && (m.foto.mod === 'kalici' || (m.kim === 'o' && m.foto.durum !== 'goruldu')))
          .slice(-3)
          .map(m => (
            <Button
              key={'foto-' + m.foto!.id}
              plain
              label={`${m.foto!.mod === 'tek' ? '🔥 Open view-once photo' : '📷 Open photo'} · ${m.kim === 'ben' ? 'yours' : karsi} · ${new Date(m.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
              onPress={() => void guvenli($, () => fotoAc($, s.id, m.foto!.id, siki))}
            />
          ))}
        {acik && uyari}
        {acik && (
          <Input
            key={'mesaj-' + s.id + '-' + d.yazSayac + (d.kisiselOnay ? '-onay' : '')}
            {...(d.kisiselOnay ? { value: d.kisiselOnay } : {})}
            placeholder={`Write something to ${karsi}`}
            submitLabel="Send"
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
              label={s.fotoOndan === 'evet' ? '📷 Photo' : s.fotoOndan === 'hayir' ? '📷 Not accepting photos' : s.fotoIstekGitti ? '📷 Waiting for permission…' : '📷 Ask to send photos'}
              onPress={() =>
                void guvenli($, async () => {
                  if (s.fotoOndan === 'evet') await update($, ekran, (x: Ekran) => ({ ...x, fotoForm: { oda: s.id, mod: 'tek' as const }, uyari: '' }))
                  else if (s.fotoOndan === 'hayir') await uyar($, `${karsi} doesn’t want photos in this chat.`)
                  else if (s.fotoIstekGitti) await uyar($, 'Request sent; waiting for their answer.')
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
              <Text dimColor>How was it?</Text>
              <Button key="iyi" plain label={s.puanBen === 'iyi' ? '[👍]' : '👍'} onPress={() => void guvenli($, () => puanVer($, s.id, 'iyi'))} />
              <Button key="kotu" plain label={s.puanBen === 'kotu' ? '[👎]' : '👎'} onPress={() => void guvenli($, () => puanVer($, s.id, 'kotu'))} />
              <Button key="kapat" plain label="Delete and close" onPress={() => void update($, ekran, (x: Ekran) => ({ ...x, ayrilOnay: s.id }))} />
              <Button key="yeni" variant="primary" label="Meet someone new" onPress={() => void guvenli($, () => sirayaGir($))} />
            </>
          )}
          {acik && siki && !odakta && <Text dimColor>ctrl+x tab to type in the panel</Text>}
          {acik && mobil && <Text dimColor>No input box? Use /meanwhile your message</Text>}
        </Box>
        {!acik && uyari}
        {eskiNot}
        </Box>
      </Box>
    )
  })
}
