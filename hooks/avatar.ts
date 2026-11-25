// Rumuzdan doğan avatar: 5x5, dikey eksende simetrik bir piksel yüz ve rumuza özel bir renk.
// Aynı rumuz her yerde aynı avatarı verir. Terminalde Raster (yarım blok karakterler),
// masaüstünde Svg olarak çizilir.

// Pembe ve mavi cinsiyet renkleri için ayrıldı; nötr avatarlar bu tonlardan birini almaz.
const RENKLER = ['#f59e0b', '#8b5cf6', '#10b981', '#a3e635', '#14b8a6', '#eab308', '#e0475b', '#94a3b8']
const ZEMIN = '#2a2a28'

function ozet(metin: string): number {
  // FNV-1a 32 bit
  let h = 0x811c9dc5
  for (const c of metin.toLocaleLowerCase('tr')) {
    h ^= c.codePointAt(0) ?? 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function avatar(rumuz: string, renkVer?: string): { renk: string; izgara: boolean[][] } {
  const h = ozet(rumuz || '?')
  const renk = renkVer || (RENKLER[h % RENKLER.length] ?? RENKLER[0]!)
  // Sabit bir yüz: 0. satır saç (rastgele), 1. satır gözler (delik), 2. satır yanaklar,
  // 3. satır ağız (rastgele), 4. satır çene. Simetrik; böylece her avatar bir yüz gibi okunur.
  const b = (n: number) => ((h >>> n) & 1) === 1
  const ayna = (a: boolean, c: boolean, o: boolean) => [a, c, o, c, a]
  const izgara: boolean[][] = [
    ayna(b(3), b(4) || b(5), true),
    [true, false, true, false, true],
    ayna(true, true, b(6)),
    ayna(b(7), !b(8), !b(9) || b(8)),
    ayna(false, true, true),
  ]
  return { renk, izgara }
}

export function avatarSvg(rumuz: string, renkVer?: string): string {
  const { renk, izgara } = avatar(rumuz, renkVer)
  let kareler = ''
  izgara.forEach((satir, y) =>
    satir.forEach((dolu, x) => {
      if (dolu) kareler += `<rect x="${3 + x * 5}" y="${3 + y * 5}" width="5" height="5" fill="${renk}"/>`
    }),
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 31 31"><rect width="31" height="31" rx="8" fill="${ZEMIN}"/>${kareler}</svg>`
}

function renkSayi(hex: string): number {
  return parseInt(hex.slice(1), 16)
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function base64(bayt: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bayt.length; i += 3) {
    const a = bayt[i]!
    const b = bayt[i + 1]
    const c = bayt[i + 2]
    s += B64[a >> 2]
    s += B64[((a & 3) << 4) | ((b ?? 0) >> 4)]
    s += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]
    s += c === undefined ? '=' : B64[c & 63]
  }
  return s
}

// Terminal: her piksel 2 sütun genişliğinde, iki piksel satırı bir terminal satırında (▀ ▄ █).
export function avatarRaster(rumuz: string, renkVer?: string): { columns: number; rows: number; cells: string } {
  const { renk, izgara } = avatar(rumuz, renkVer)
  const r = renkSayi(renk)
  const VARSAYILAN = 0x01000000
  const columns = 10
  const rows = 3
  const kelimeler = new Uint32Array(columns * rows * 3)
  let i = 0
  for (let ty = 0; ty < rows; ty++) {
    const ust = izgara[ty * 2]
    const alt = izgara[ty * 2 + 1]
    for (let tx = 0; tx < columns; tx++) {
      const px = Math.floor(tx / 2)
      const u = !!ust?.[px]
      const a = !!alt?.[px]
      const kod = u && a ? 0x2588 : u ? 0x2580 : a ? 0x2584 : 0x20
      kelimeler[i++] = kod
      kelimeler[i++] = u || a ? r : VARSAYILAN
      kelimeler[i++] = VARSAYILAN
    }
  }
  const bayt = new Uint8Array(kelimeler.buffer)
  // little-endian garanti: Uint32Array platform sırasıyla yazar; çoğu platform little-endian.
  return { columns, rows, cells: base64(bayt) }
}
