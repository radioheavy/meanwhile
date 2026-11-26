export type Cins = 'k' | 'e' | 'x'
export type Foto = { id: string; mod: 'tek' | 'kalici'; durum: 'bekliyor' | 'goruldu' }
export type Mesaj = { n: number; kim: 'ben' | 'o'; metin: string; at: number; durum?: 'gidiyor' | 'hata'; foto?: Foto }
export type Karsi = { rumuz: string; cins?: string; alan?: string; ruh?: string }
export type Sohbet = {
  id: string
  karsi: Karsi
  mesajlar: Mesaj[]
  son: number
  bitti: { neden: string; ben: boolean } | null
  kalici: boolean
  kalBen: boolean
  kalO: boolean
  karsiCevrimici: boolean
  karsiYaziyor: boolean
  puanBen: string | null
  fotoBenden?: string
  fotoOndan?: string
  fotoIstekGeldi?: boolean
  fotoIstekGitti?: boolean
  okunmamis: number
  eslesme: number
}
export type Ekran = {
  durum: 'kurulum' | 'ana'
  onayGerek?: boolean
  saat?: { aktif: boolean; bas: number; bit: number } | null
  sirada: boolean
  sohbetler: Sohbet[]
  aktif: string | null
  cevrimici: number
  uyari: string
  yazSayac: number
  // Sohbette yukarı kaydırınca en altta görünen mesajın n'si; null = en yeniyi takip et.
  sabitN?: number | null
  taslak?: string
  kisiselOnay?: string
  bildirForm?: string | null
  geriBildirim?: boolean
  ayrilOnay?: string | null
  fotoAl?: string
  fotoForm?: { oda: string; mod: 'tek' | 'kalici' } | null
  fotoGoster?: { oda: string; id: string; tur: string; b64: string; mod: string } | null
  fotoKabul?: boolean
  bildirimKapali?: boolean
  liste?: { id: string; rumuz: string; at: number; bildirildi: boolean }[] | null
  guncelleme?: { durum: 'var' | 'zorunlu'; son: string; komut: string } | null
}
export type Ortam = { zengin: boolean; surum: string }
export type Form = { rumuz: string; ben: Cins; ara: Cins; alan?: string; ruh?: string; adim?: number }

declare module 'claude-code' {
  interface PluginState {
    meanwhile: { ekran: Shaped<Ekran>; form: Shaped<Form>; ortam: Shaped<Ortam> }
  }
}
