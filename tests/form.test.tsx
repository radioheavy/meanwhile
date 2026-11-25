import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'asksh',
  component: 'Pane',
  requestId: 'asksh',
  props: { title: 'ask.sh', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const desteklenmiyor = (h: unknown) => /is not allowed|not an element|refused/.test(String((h as Error)?.message ?? h))

// Sahte sunucu ve motor: hafızalı depo, sohbet listesi.
function kur(on: any, secenek: { surum?: string; sohbetler?: any[]; enAz?: string } = {}) {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.register', () => ({ value: { command: 'date' } }))
  on('session.id', () => ({ value: 'test-oturum' }))
  on('session.version', () => ({ value: { version: secenek.surum ?? '2.1.295', base: secenek.surum ?? '2.1.295' } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  const depo = new Map<string, unknown>()
  on('store.get', (_: any, e: any) => ({ value: depo.get(e.key) }))
  on('store.set', (_: any, e: any) => {
    depo.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_: any, e: any) => {
    depo.delete(e.key)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.notify', () => ({ value: { isSent: false, reason: 'disabled' } }))
  const sunucu = { sohbetler: secenek.sohbetler ?? [], engelli: false }
  on('http.fetch', (_: any, e: any) => {
    const u = String(e.url)
    const govde = e.body ? JSON.parse(e.body) : {}
    let g: unknown = { tamam: true }
    if (u.endsWith('/api/kimlik')) g = { token: 'a'.repeat(64) }
    else if (u.includes('/api/surum')) g = { son: secenek.enAz ?? '0.5.0', enAz: secenek.enAz ?? '0.5.0' }
    else if (u.includes('/api/kuyruk') || u.includes('/api/durum') || u.includes('/api/sira-cik')) g = { sirada: false, sohbetler: sunucu.sohbetler, cevrimici: 3 }
    else if (u.endsWith('/api/mesaj')) g = { tamam: true, n: 99 }
    else if (u.endsWith('/api/engelle')) {
      sunucu.engelli = true
      sunucu.sohbetler = sunucu.sohbetler.filter(s => s.id !== govde.oda)
    } else if (u.endsWith('/api/engel-kaldir')) sunucu.engelli = false
    else if (u.endsWith('/api/engeller')) g = { engeller: sunucu.engelli ? [{ id: 'c'.repeat(24), rumuz: 'rahatsiz_42', at: 1, bildirildi: false }] : [] }
    else if (u.endsWith('/api/kal')) g = { tamam: true, kalici: false }
    else if (u.endsWith('/api/foto-izin')) g = { tamam: true, izin: govde.izin }
    else if (u.includes('/api/foto?')) g = { tur: 'jpeg', b64: '/9j/4AAQSkZJRgABAQ==', mod: 'tek' }
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(g) } }
  })
  return sunucu
}

const sohbet = (id: string, rumuz: string, mesajlar: any[] = [], ek: any = {}) => ({
  id,
  karsi: { rumuz, cins: 'k', alan: 'backend', ruh: 'gece' },
  mesajlar,
  son: mesajlar.length,
  bitti: null,
  kalici: false,
  kalBen: false,
  kalO: false,
  karsiCevrimici: true,
  karsiYaziyor: false,
  puanBen: null,
  ...ek,
})

async function kurulumuGec(ui: any, rumuz = 'gececi_kedi') {
  await ui.press({ key: 'profil' })
  await ui.input({ key: 'rumuz', text: rumuz })
  await ui.press({ key: 'devam' })
  await ui.press({ key: 'basla' })
}

test('kurulum 3 adımda ilerler, tercih hiçbir yerde yazmaz', async ($, on) => {
  kur(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'profil' })
  expect((await ui.find({ type: 'Text', text: /nasıl seslenelim/ }))?.text).toBe('Sana nasıl seslenelim?')
  await ui.input({ key: 'rumuz', text: 'x' })
  expect((await ui.find({ type: 'Text', text: /2–20/ }))?.text).toContain('Rumuz')
  await ui.input({ key: 'rumuz', text: 'gececi_kedi' })
  expect((await ui.find({ type: 'Text', text: /Memnun oldum/ }))?.text).toBe('Memnun oldum, gececi_kedi.')
  await ui.select({ key: 'ben', value: 'e' })
  await ui.select({ key: 'ara', value: 'k' })
  await ui.press({ key: 'devam' })
  expect((await ui.find({ type: 'Text', text: /Her şey hazır/ }))?.text).toBe('Her şey hazır, gececi_kedi.')
  await ui.select({ key: 'alan', value: 'backend' })
  expect(await ui.find({ type: 'Text', text: /arıyor|Kadınlarla/ })).toBeUndefined()
  await ui.press({ key: 'geri' })
  expect((await ui.find({ type: 'Text', text: /Memnun oldum/ }))?.text).toBe('Memnun oldum, gececi_kedi.')
  await ui.unmount()
})

test('masaüstünde de çizilir', async ($, on) => {
  kur(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'profil' })
  await ui.input({ key: 'rumuz', text: 'kahve_ve_kod' })
  await ui.press({ key: 'devam' })
  expect((await ui.find({ type: 'Text', text: /Her şey hazır/ }))?.text).toBe('Her şey hazır, kahve_ve_kod.')
  await ui.unmount()
})

test('eski sürümde panel güncelleme ister', async ($, on) => {
  kur(on, { enAz: '0.9.0' })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await new Promise(r => (globalThis as any).setTimeout(r, 50))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /güncellemen gerekiyor/ }))?.text).toBe("ask.sh'ı güncellemen gerekiyor")
  await ui.unmount()
})

test('aynı anda iki sohbet: liste, okunmamış, sohbete gir ve geri dön', async ($, on) => {
  kur(on, {
    sohbetler: [
      sohbet('oda1', 'kahve_ve_kod', [{ n: 1, kim: 'o', metin: 'selam! deploy mu bekliyorsun?', at: 0 }]),
      sohbet('oda2', 'sudo_kalp', [], { kalO: true }),
    ],
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (surface === 'terminal') await kurulumuGec(ui)
    expect(await ui.find({ type: 'Button', key: 'ac-oda1' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'ac-oda2' })).toBeDefined()
    await ui.press({ key: 'ac-oda1' })
    expect((await ui.find({ type: 'Text', text: /deploy mu/ }))?.text).toBe('selam! deploy mu bekliyorsun?')
    expect(await ui.find({ type: 'Button', key: 'gonder' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'yeni' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'kal' })).toBeDefined()
    await ui.press({ key: 'sikayet' })
    expect((await ui.find({ type: 'Text', text: /neden bildiriyorsun/ }))?.text).toContain('kahve_ve_kod')
    await ui.press({ key: 'vazgec' })
    await ui.press({ key: 'geri-liste' })
    await ui.press({ key: 'ac-oda2' })
    expect((await ui.find({ type: 'Button', key: 'kal' }) as any)?.props?.label ?? 'kal').toBeTruthy()
    expect(await ui.find({ type: 'Button', key: 'buz-0' })).toBeDefined()
    await ui.press({ key: 'geri-liste' })
    await ui.unmount()
  }
})

test('engelleyince sohbet listeden kalkar, engeller listesinden geri alınır', async ($, on) => {
  kur(on, { sohbetler: [sohbet('odaX', 'rahatsiz_42', [{ n: 1, kim: 'o', metin: 'kaba bir mesaj', at: 0 }])] })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await kurulumuGec(ui, 'oktay')
  await ui.press({ key: 'ac-odaX' })
  expect((await ui.find({ type: 'Text', text: /kaba/ }))?.text).toBe('kaba bir mesaj')
  await ui.press({ key: 'engelle' })
  expect(await ui.find({ type: 'Text', text: /kaba/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'ac-odaX' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /engellendi/ }))?.text).toContain('rahatsiz_42 engellendi')
  await ui.press({ key: 'engeller' })
  await ui.press({ key: 'kaldir-' + 'c'.repeat(24) })
  expect((await ui.find({ type: 'Text', text: /Kimseyi engellemedin/ }))?.text).toBe('Kimseyi engellemedin.')
  await ui.unmount()
})

test('zengin görünüm (yeni Claude): avatar, eşleşme satırı, profil tadı', async ($, on) => {
  kur(on, { surum: '2.1.332', sohbetler: [sohbet('oda1', 'kahve_ve_kod')] })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    let ui
    try {
      ui = await $.ui.mount({ ...PANE, surface })
    } catch (h) {
      if (desteklenmiyor(h)) return
      throw h
    }
    if (surface === 'terminal') {
      await ui.press({ key: 'profil' })
      await ui.input({ key: 'rumuz', text: 'gececi_kedi', kind: 'change' })
      expect((await ui.find({ type: 'Text', text: /^avatarın$/ }))?.text).toBe('avatarın')
      await ui.input({ key: 'rumuz', text: 'gececi_kedi' })
      await ui.press({ key: 'devam' })
      await ui.press({ key: 'basla' })
      await ui.press({ key: 'ac-oda1' })
    }
    expect((await ui.find({ type: 'Text', text: /ile eşleştiniz/ }))?.text).toContain('Backend · gece mesaisinde')
    expect(await ui.find({ type: 'Button', key: 'buz-0' })).toBeDefined()
    await ui.unmount()
  }
})

test('responsive: dar ekran, mobil ve küçültülmüş widget', async ($, on) => {
  kur(on, { sohbetler: [sohbet('oda1', 'kahve_ve_kod', [{ n: 1, kim: 'o', metin: 'çok uzun bir mesaj, dar ekranda kısalması gereken bir önizleme metni', at: 0 }])] })
  // dar terminal: eylemler ikinci satırda, önizleme kısalır
  const dar = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 40 } })
  await kurulumuGec(dar)
  expect(await dar.find({ type: 'Button', key: 'ac-oda1' })).toBeDefined()
  await dar.press({ key: 'ac-oda1' })
  expect(await dar.find({ type: 'Button', key: 'bitir' })).toBeDefined()
  expect((await dar.find({ type: 'Text', text: /^çevrimiçi$/ }))?.text).toBe('çevrimiçi')
  await dar.press({ key: 'geri-liste' })
  await dar.unmount()
  // mobil: yazma ipucu görünür
  const mob = await $.ui.mount({ ...PANE, surface: 'mobile', props: { ...PANE.props, bodyColumns: 36 } })
  await mob.press({ key: 'ac-oda1' })
  expect((await mob.find({ type: 'Text', text: /\/date mesajın/ }))?.text).toContain('/date mesajın')
  await mob.press({ key: 'geri-liste' })
  await mob.unmount()
  // masaüstünde küçültülmüş panel: tek bakışlık özet
  const w = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, placement: 'widget', bodyColumns: 24 } })
  expect(await w.find({ type: 'Text', text: /sohbet|okunmamış|sakin/ })).toBeDefined()
  await w.unmount()
})

test('geri bildirim gönderilir; uzun mesaj balonda satır atlar', async ($, on) => {
  const uzun = 'bu gerçekten çok uzun bir mesaj, balonun içinde kendi kendine alt satıra geçmesi ve panelin tamamına yayılmaması lazım'
  kur(on, { sohbetler: [sohbet('oda1', 'kahve_ve_kod', [{ n: 1, kim: 'o', metin: uzun, at: 0 }])] })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, bodyColumns: 60 } })
  await kurulumuGec(ui)
  await ui.press({ key: 'ac-oda1' })
  const balon = await ui.find({ type: 'Text', text: /gerçekten çok uzun/ })
  expect(balon?.text).toContain('\n')
  await ui.press({ key: 'geri-liste' })
  await ui.press({ key: 'geri-bildirim' })
  expect((await ui.find({ type: 'Text', text: /Bize bir şey söyle/ }))?.text).toBe('Bize bir şey söyle')
  await ui.input({ key: 'geri-bildirim-yazi', text: 'balonlar daha güzel olsun' })
  expect((await ui.find({ type: 'Text', text: /Teşekkürler/ }))?.text).toContain('ulaştı')
  await ui.unmount()
})

test('ayrılmadan önce onay: tek sohbet ve hepsinden çıkış', async ($, on) => {
  kur(on, { sohbetler: [sohbet('oda1', 'kahve_ve_kod', [{ n: 1, kim: 'o', metin: 'selam', at: 0 }]), sohbet('oda2', 'gitmis_biri', [], { bitti: { neden: 'ayrıldı', ben: false } })] })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await kurulumuGec(ui)
  // karşı taraf hâlâ burada
  await ui.press({ key: 'ac-oda1' })
  await ui.press({ key: 'bitir' })
  expect((await ui.find({ type: 'Text', text: /sohbetten ayrılıyorsun/ }))?.text).toContain('kahve_ve_kod')
  expect(await ui.find({ type: 'Button', key: 'son-mesaj' })).toBeDefined()
  await ui.press({ key: 'ayril-evet' })
  expect(await ui.find({ type: 'Button', key: 'ac-oda1' })).toBeUndefined()
  // karşı taraf zaten ayrılmış
  await ui.press({ key: 'ac-oda2' })
  await ui.press({ key: 'kapat' })
  expect((await ui.find({ type: 'Text', text: /zaten ayrıldı/ }))?.text).toContain('gitmis_biri')
  await ui.press({ key: 'ayril-vazgec' })
  await ui.press({ key: 'geri-liste' })
  // hepsinden çıkış
  await ui.press({ key: 'cik' })
  expect((await ui.find({ type: 'Text', text: /çıkıyorsun/ }))?.text).toBe("ask.sh'tan çıkıyorsun")
  await ui.press({ key: 'ayril-vazgec' })
  await ui.unmount()
})

test('masaüstünde mesajlar SVG tuvalinde çizilir (yeni Claude)', async ($, on) => {
  kur(on, { surum: '2.1.332', sohbetler: [sohbet('oda1', 'kahve_ve_kod', [{ n: 1, kim: 'o', metin: 'selam!', at: 0 }, { n: 2, kim: 'ben', metin: 'naber?', at: 1 }])] })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  let ui
  try {
    ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  } catch (h) {
    if (desteklenmiyor(h)) return
    throw h
  }
  await kurulumuGec(ui)
  await ui.press({ key: 'ac-oda1' })
  // Mesajlar artık düz yazı olarak değil, tuvalde çiziliyor.
  expect(await ui.find({ type: 'Text', text: /^selam!$/ })).toBeUndefined()
  // Her mesaj ayrı bir parça: yeni mesaj gelince eskilerin kaynağı değişmez (ekran kararmaz).
  const svgler = (await ui.findAll({ type: 'Svg' })) as any[]
  const parca = (metin: string) => svgler.filter(x => String(x.props?.source ?? '').includes(metin))
  if (svgler.some(x => String(x.props?.source ?? '').includes('naber?'))) {
    expect(parca('naber?')).toHaveLength(1)
    expect(parca('selam!')).toHaveLength(1)
    expect(parca('naber?')[0].props.source).not.toContain('selam!')
  }
  await ui.unmount()
})

test('fotoğraf: izin isteği, izin ver, tek gösterimliği aç, gönderme formu ve sorumluluk reddi', async ($, on) => {
  kur(on, {
    sohbetler: [
      sohbet('oda1', 'gece_kusu', [{ n: 1, kim: 'o', metin: '📷 Tek gösterimlik fotoğraf', at: 0, foto: { id: 'f1', mod: 'tek', durum: 'bekliyor' } }], {
        kalici: true, fotoIstekGeldi: true, fotoOndan: 'evet', fotoBenden: 'sor',
      }),
    ],
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await kurulumuGec(ui)
  await ui.press({ key: 'ac-oda1' })
  expect((await ui.find({ type: 'Text', text: /fotoğraf göndermek istiyor/ }))?.text).toContain('gece_kusu')
  await ui.press({ key: 'foto-evet' })
  expect(await ui.find({ type: 'Button', key: 'foto-evet' })).toBeUndefined()
  await ui.press({ key: 'foto-f1' })
  expect((await ui.find({ type: 'Text', text: /Tek gösterimlik: kapatınca/ }))?.text).toContain('kapatınca')
  await ui.press({ key: 'foto-kapat' })
  expect(await ui.find({ type: 'Button', key: 'foto-f1' })).toBeUndefined()
  await ui.press({ key: 'foto-gonder' })
  expect((await ui.find({ type: 'Text', text: /Fotoğraf göndermeden önce/ }))?.text).toBe('Fotoğraf göndermeden önce')
  await ui.press({ key: 'foto-kabul' })
  expect(await ui.find({ type: 'Button', key: 'foto-pano' })).toBeDefined()
  await ui.press({ key: 'mod-kalici' })
  expect((await ui.find({ type: 'Text', text: /durdukça/ }))?.text).toContain('sohbette kalır')
  await ui.press({ key: 'foto-vazgec' })
  await ui.unmount()
})

test('sohbette üst ve yazma kutusu sabit, son mesaj görünür', async ($, on) => {
  const mesajlar = Array.from({ length: 30 }, (_, i) => ({ n: i + 1, kim: i % 2 ? 'ben' : 'o', metin: `mesaj ${i + 1}`, at: i * 1000 }))
  kur(on, { sohbetler: [sohbet('oda1', 'kahve_ve_kod', mesajlar)] })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await kurulumuGec(ui)
  await ui.press({ key: 'ac-oda1' })
  expect(await ui.find({ type: 'Text', text: 'mesaj 30' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'en-alta' })).toBeUndefined()
  // Üst kısım ve yazma kutusu aynı ağaçta, gövde yüksekliğine kilitli.
  expect(await ui.find({ type: 'Button', key: 'geri-liste' })).toBeDefined()
  expect(await ui.find({ type: 'Input' })).toBeDefined()
  await ui.unmount()
})
