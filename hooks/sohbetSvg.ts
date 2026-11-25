// Masaüstü sohbet tuvali: mesajları tek bir SVG olarak çizer (Claude Desktop / VS Code).
// Mesajlaşma uygulaması gibi: gruplanan balonlar, yalnızca grubun son balonunda kuyruk,
// turuncu gradyanlı "ben" balonları, ince kenarlı koyu "o" balonları, karşı tarafın avatarı,
// zaman ayraçları, "yazıyor…" noktaları ve yeni gelen balonun süzülerek belirmesi.
import { avatar } from './avatar'

export type TuvalMesaj = { n: number; kim: 'ben' | 'o'; metin: string; at: number; durum?: 'gidiyor' | 'hata' }

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
const PUNTO = 13.5
const SATIR = 19 // satır yüksekliği
const HARF = 7.1 // ortalama harf genişliği (px), kelime kaydırma için
const IC_X = 12
const IC_Y = 8
const AVATAR = 24
const ARA_AYNI = 4 // aynı kişinin art arda balonları arası
const PAY = 4 // her parçanın altındaki gölge payı (sonraki aralıktan düşülür)
const ARA_FARKLI = 14 // konuşan değişince
const ARA_SAAT = 12 // saat ayracından önce

const kac = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const saat = (t: number) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

// Kelime kelime satırlara böl; çok uzun kelimeyi parçala.
function satirlar(metin: string, en: number): string[] {
  const sonuc: string[] = []
  for (const paragraf of metin.split('\n')) {
    let satir = ''
    for (const kelime of paragraf.split(/\s+/)) {
      let k = kelime
      while ([...k].length > en) {
        if (satir) sonuc.push(satir), (satir = '')
        sonuc.push([...k].slice(0, en).join(''))
        k = [...k].slice(en).join('')
      }
      if (!satir) satir = k
      else if ([...(satir + ' ' + k)].length <= en) satir += ' ' + k
      else sonuc.push(satir), (satir = k)
    }
    sonuc.push(satir)
  }
  return sonuc
}

// Yuvarlak köşeli balon yolu; köşe yarıçapları [sol-üst, sağ-üst, sağ-alt, sol-alt], isteğe bağlı kuyruk.
function balonYolu(x: number, y: number, w: number, h: number, r: [number, number, number, number], kuyruk: 'sol' | 'sag' | null) {
  const [a, b, c, d] = r
  let p = `M${x + a},${y} H${x + w - b} Q${x + w},${y} ${x + w},${y + b} V${y + h - c}`
  if (kuyruk === 'sag') p += ` Q${x + w},${y + h} ${x + w + 7},${y + h} Q${x + w - 3},${y + h} ${x + w - c - 2},${y + h}`
  else p += ` Q${x + w},${y + h} ${x + w - c},${y + h}`
  p += ` H${x + d}`
  if (kuyruk === 'sol') p += ` Q${x + 3},${y + h} ${x - 7},${y + h} Q${x},${y + h} ${x},${y + h - d - 2}`
  else p += ` Q${x},${y + h} ${x},${y + h - d}`
  p += ` V${y + a} Q${x},${y} ${x + a},${y} Z`
  return p
}

function avatarCiz(rumuz: string, renk: string, x: number, y: number, boyut: number) {
  const { izgara } = avatar(rumuz, renk)
  const kare = (boyut - 4) / 5
  let s = `<rect x="${x}" y="${y}" width="${boyut}" height="${boyut}" rx="7" fill="#26262b"/>`
  izgara.forEach((satir, yy) =>
    satir.forEach((dolu, xx) => {
      if (dolu) s += `<rect x="${(x + 2 + xx * kare).toFixed(1)}" y="${(y + 2 + yy * kare).toFixed(1)}" width="${kare.toFixed(1)}" height="${kare.toFixed(1)}" fill="${renk}"/>`
    }),
  )
  return s
}

export type TuvalParca = { key: string; source: string; width: number; height: number }

// Her mesaj kendi küçük SVG'si: yeni mesaj gelince yalnız o eklenir, eskilerin kaynağı aynı
// kaldığı için yeniden yüklenmez (tek büyük SVG her mesajda baştan yüklenip ekranı karartıyordu).
export function sohbetSvg(o: {
  mesajlar: TuvalMesaj[]
  karsiRumuz: string
  karsiRenk: string
  yaziyor: boolean
  genislik: number
  // Mesaj süzülerek mi belirsin? Bir kez karar verilir ki kaynak sonradan değişmesin.
  canlan?: (m: TuvalMesaj) => boolean
  hareketAz?: boolean
}): { parcalar: TuvalParca[]; width: number; height: number } {
  const W = Math.max(260, Math.round(o.genislik))
  const balonMax = Math.floor(W * 0.72)
  const harfSiniri = Math.max(10, Math.floor((balonMax - IC_X * 2) / HARF))
  const solBosluk = AVATAR + 8
  let y = 8
  let govde = ''
  const parcalar: TuvalParca[] = []
  const DEFS =
    `<defs><linearGradient id="ben" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a4c"/><stop offset="1" stop-color="#ff5b14"/></linearGradient>` +
    `<filter id="golge" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000" flood-opacity="0.28"/></filter></defs>`
  let bas = 0
  const parcaKapat = (key: string) => {
    const son = Math.ceil(y + PAY)
    const h = Math.max(1, son - bas)
    parcalar.push({
      key,
      source: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 ${bas} ${W} ${h}" font-family="${FONT}">${DEFS}${govde}</svg>`,
      width: W,
      height: h,
    })
    govde = ''
    bas = son
    y = son - PAY
  }

  const n = o.mesajlar.length
  o.mesajlar.forEach((m, i) => {
    const onceki = o.mesajlar[i - 1]
    const sonraki = o.mesajlar[i + 1]
    const benim = m.kim === 'ben'
    const grupBasi = !onceki || onceki.kim !== m.kim || m.at - onceki.at > 5 * 60_000
    const grupSonu = !sonraki || sonraki.kim !== m.kim || sonraki.at - m.at > 5 * 60_000

    // Uzun bir aradan sonra ortada saat ayracı
    if (!onceki || m.at - onceki.at > 15 * 60_000) {
      if (onceki) y += ARA_SAAT
      govde += `<text x="${W / 2}" y="${y + 11}" text-anchor="middle" font-size="11" fill="#8b8b93">${saat(m.at)}</text>`
      y += 22
    } else y += grupBasi ? ARA_FARKLI : ARA_AYNI

    const sat = satirlar(m.metin, harfSiniri)
    const enUzun = Math.max(...sat.map(s => [...s].length), 1)
    const w = Math.min(balonMax, Math.ceil(enUzun * HARF + IC_X * 2))
    const h = sat.length * SATIR + IC_Y * 2 - 2
    const x = benim ? W - w - 10 : solBosluk
    // Grup içi köşeler yaslanır; kuyruk sadece grubun son balonunda.
    const R = 16
    const k = 5
    const r: [number, number, number, number] = benim
      ? [R, grupBasi ? R : k, grupSonu ? 4 : k, R]
      : [grupBasi ? R : k, R, R, grupSonu ? 4 : k]
    const kuyruk = grupSonu ? (benim ? 'sag' : 'sol') : null
    const yeni = !o.hareketAz && !!o.canlan?.(m)
    const anim = yeni
      ? `<animateTransform attributeName="transform" type="translate" from="0 10" to="0 0" dur="0.35s" fill="freeze"/><animate attributeName="opacity" from="0" to="1" dur="0.35s" fill="freeze"/>`
      : ''
    const dolgu = benim ? 'url(#ben)' : '#2b2b31'
    const kenar = benim ? '' : ' stroke="#3d3d45" stroke-width="1"'
    const opak = m.durum === 'gidiyor' ? ' opacity="0.65"' : ''
    let g = `<g${opak}>${anim}<path d="${balonYolu(x, y, w, h, r, kuyruk)}" fill="${dolgu}"${kenar} filter="url(#golge)"/>`
    sat.forEach((s, j) => {
      g += `<text x="${x + IC_X}" y="${y + IC_Y + 14 + j * SATIR}" font-size="${PUNTO}" fill="${benim ? '#ffffff' : '#ececf1'}">${kac(s)}</text>`
    })
    if (!benim && grupSonu) g += avatarCiz(o.karsiRumuz, o.karsiRenk, 4, y + h - AVATAR, AVATAR)
    g += '</g>'
    govde += g
    y += h
    // Grubun altında saat ya da gönderim durumu
    const alt = m.durum === 'gidiyor' ? 'gönderiliyor…' : m.durum === 'hata' ? 'gönderilemedi' : grupSonu ? saat(m.at) : ''
    if (alt) {
      y += 14
      govde += `<text x="${benim ? W - 12 : solBosluk + 4}" y="${y}" text-anchor="${benim ? 'end' : 'start'}" font-size="10.5" fill="${m.durum === 'hata' ? '#ff5b14' : '#7d7d86'}">${alt}</text>`
    }
    parcaKapat(`m-${m.kim}-${m.at}`)
  })

  // "yazıyor…": üç nokta, dalga gibi
  if (o.yaziyor) {
    y += n ? ARA_FARKLI : 8
    const w = 58
    const h = 32
    govde += `<path d="${balonYolu(solBosluk, y, w, h, [16, 16, 16, 4], 'sol')}" fill="#2b2b31" stroke="#3d3d45" stroke-width="1"/>`
    govde += avatarCiz(o.karsiRumuz, o.karsiRenk, 4, y + h - AVATAR, AVATAR)
    for (let i = 0; i < 3; i++) {
      const cx = solBosluk + 17 + i * 12
      const hareket = o.hareketAz
        ? ''
        : `<animate attributeName="opacity" values="0.25;1;0.25" dur="1.2s" begin="${(i * 0.18).toFixed(2)}s" repeatCount="indefinite"/><animate attributeName="cy" values="${y + 16};${y + 12};${y + 16}" dur="1.2s" begin="${(i * 0.18).toFixed(2)}s" repeatCount="indefinite"/>`
      govde += `<circle cx="${cx}" cy="${y + 16}" r="3.4" fill="#b9b9c2">${hareket}</circle>`
    }
    y += h
    parcaKapat('yaziyor')
  }

  return { parcalar, width: W, height: Math.ceil(y + PAY) }
}
