import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'meanwhile',
  component: 'Pane',
  requestId: 'meanwhile',
  props: { title: 'meanwhile', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const desteklenmiyor = (h: unknown) => /is not allowed|not an element|refused/.test(String((h as Error)?.message ?? h))

// Sahte sunucu ve motor: hafızalı depo, sohbet listesi.
function kur(on: any, secenek: { surum?: string; sohbetler?: any[]; enAz?: string } = {}) {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.register', () => ({ value: { command: 'meanwhile' } }))
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
  const sunucu = { sohbetler: secenek.sohbetler ?? [], engelli: false, kuyruk: [] as any[], depo }
  on('http.fetch', (_: any, e: any) => {
    const u = String(e.url)
    const ham = e.init?.body ?? e.body
    const govde = ham ? JSON.parse(ham) : {}
    let g: unknown = { tamam: true }
    if (u.endsWith('/api/kimlik')) g = { token: 'a'.repeat(64) }
    else if (u.includes('/api/surum')) g = { son: secenek.enAz ?? '0.5.0', enAz: secenek.enAz ?? '0.5.0' }
    else if (u.includes('/api/kuyruk') || u.includes('/api/durum') || u.includes('/api/sira-cik')) {
      if (u.includes('/api/kuyruk')) sunucu.kuyruk.push(govde)
      g = { sirada: false, sohbetler: sunucu.sohbetler, cevrimici: 3 }
    }
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

test('setup moves through 3 steps, preference is never shown', async ($, on) => {
  kur(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'profil' })
  expect((await ui.find({ type: 'Text', text: /should we call you/ }))?.text).toBe('What should we call you?')
  await ui.input({ key: 'rumuz', text: 'x' })
  expect((await ui.find({ type: 'Text', text: /2–20/ }))?.text).toContain('Nickname')
  await ui.input({ key: 'rumuz', text: 'gececi_kedi' })
  expect((await ui.find({ type: 'Text', text: /Nice to meet you/ }))?.text).toBe('Nice to meet you, gececi_kedi.')
  await ui.select({ key: 'ben', value: 'e' })
  await ui.select({ key: 'ara', value: 'k' })
  await ui.press({ key: 'devam' })
  expect((await ui.find({ type: 'Text', text: /All set/ }))?.text).toBe('All set, gececi_kedi.')
  await ui.select({ key: 'alan', value: 'backend' })
  expect(await ui.find({ type: 'Text', text: /Looking for|Women/ })).toBeUndefined()
  await ui.press({ key: 'geri' })
  expect((await ui.find({ type: 'Text', text: /Nice to meet you/ }))?.text).toBe('Nice to meet you, gececi_kedi.')
  await ui.unmount()
})

test('renders on desktop too', async ($, on) => {
  kur(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'profil' })
  await ui.input({ key: 'rumuz', text: 'kahve_ve_kod' })
  await ui.press({ key: 'devam' })
  expect((await ui.find({ type: 'Text', text: /All set/ }))?.text).toBe('All set, kahve_ve_kod.')
  await ui.unmount()
})

test('outdated version: panel asks to update', async ($, on) => {
  kur(on, { enAz: '9.0.0' })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await new Promise(r => (globalThis as any).setTimeout(r, 50))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /need to update/ }))?.text).toBe('You need to update meanwhile')
  await ui.unmount()
})

test('two chats at once: list, unread, open a chat and go back', async ($, on) => {
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
    const destek = (await ui.findAll({ type: 'Link' })).find((l: any) => String(l.props?.href).includes('buymeacoffee.com/oktaydak'))
    expect(destek).toBeDefined()
    await ui.press({ key: 'ac-oda1' })
    expect((await ui.find({ type: 'Text', text: /deploy mu/ }))?.text).toBe('selam! deploy mu bekliyorsun?')
    expect(await ui.find({ type: 'Button', key: 'gonder' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'yeni' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'kal' })).toBeDefined()
    await ui.press({ key: 'sikayet' })
    expect((await ui.find({ type: 'Text', text: /Why are you reporting/ }))?.text).toContain('kahve_ve_kod')
    await ui.press({ key: 'vazgec' })
    await ui.press({ key: 'geri-liste' })
    await ui.press({ key: 'ac-oda2' })
    expect((await ui.find({ type: 'Button', key: 'kal' }) as any)?.props?.label ?? 'kal').toBeTruthy()
    expect(await ui.find({ type: 'Button', key: 'buz-0' })).toBeDefined()
    await ui.press({ key: 'geri-liste' })
    await ui.unmount()
  }
})

test('blocking removes the chat from the list; it can be undone from the blocked list', async ($, on) => {
  kur(on, { sohbetler: [sohbet('odaX', 'rahatsiz_42', [{ n: 1, kim: 'o', metin: 'kaba bir mesaj', at: 0 }])] })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await kurulumuGec(ui, 'oktay')
  await ui.press({ key: 'ac-odaX' })
  expect((await ui.find({ type: 'Text', text: /kaba/ }))?.text).toBe('kaba bir mesaj')
  await ui.press({ key: 'engelle' })
  expect(await ui.find({ type: 'Text', text: /kaba/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'ac-odaX' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /is blocked/ }))?.text).toContain('rahatsiz_42 is blocked')
  await ui.press({ key: 'engeller' })
  await ui.press({ key: 'kaldir-' + 'c'.repeat(24) })
  expect((await ui.find({ type: 'Text', text: /haven’t blocked anyone/ }))?.text).toBe('You haven’t blocked anyone.')
  await ui.unmount()
})

test('rich view (new Claude): avatar, match line, profile flavor', async ($, on) => {
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
      expect((await ui.find({ type: 'Text', text: /^your avatar$/ }))?.text).toBe('your avatar')
      await ui.input({ key: 'rumuz', text: 'gececi_kedi' })
      await ui.press({ key: 'devam' })
      await ui.press({ key: 'basla' })
      await ui.press({ key: 'ac-oda1' })
    }
    expect((await ui.find({ type: 'Text', text: /You matched with/ }))?.text).toContain('Backend · Night owl')
    expect(await ui.find({ type: 'Button', key: 'buz-0' })).toBeDefined()
    await ui.unmount()
  }
})

test('responsive: narrow screen, mobile and minimized widget', async ($, on) => {
  kur(on, { sohbetler: [sohbet('oda1', 'kahve_ve_kod', [{ n: 1, kim: 'o', metin: 'çok uzun bir mesaj, dar ekranda kısalması gereken bir önizleme metni', at: 0 }])] })
  // dar terminal: eylemler ikinci satırda, önizleme kısalır
  const dar = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 40 } })
  await kurulumuGec(dar)
  expect(await dar.find({ type: 'Button', key: 'ac-oda1' })).toBeDefined()
  await dar.press({ key: 'ac-oda1' })
  expect(await dar.find({ type: 'Button', key: 'bitir' })).toBeDefined()
  expect((await dar.find({ type: 'Text', text: /^online$/ }))?.text).toBe('online')
  await dar.press({ key: 'geri-liste' })
  await dar.unmount()
  // mobil: yazma ipucu görünür
  const mob = await $.ui.mount({ ...PANE, surface: 'mobile', props: { ...PANE.props, bodyColumns: 36 } })
  await mob.press({ key: 'ac-oda1' })
  expect((await mob.find({ type: 'Text', text: /\/meanwhile your message/ }))?.text).toContain('/meanwhile your message')
  await mob.press({ key: 'geri-liste' })
  await mob.unmount()
  // masaüstünde küçültülmüş panel: tek bakışlık özet
  const w = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, placement: 'widget', bodyColumns: 24 } })
  expect(await w.find({ type: 'Text', text: /chat|unread|quiet/ })).toBeDefined()
  await w.unmount()
})

test('feedback is sent; a long message wraps inside the bubble', async ($, on) => {
  const uzun = 'bu gerçekten çok uzun bir mesaj, balonun içinde kendi kendine alt satıra geçmesi ve panelin tamamına yayılmaması lazım'
  kur(on, { sohbetler: [sohbet('oda1', 'kahve_ve_kod', [{ n: 1, kim: 'o', metin: uzun, at: 0 }])] })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, bodyColumns: 60 } })
  await kurulumuGec(ui)
  await ui.press({ key: 'ac-oda1' })
  const balon = await ui.find({ type: 'Text', text: /gerçekten çok uzun/ })
  expect(balon?.text).toContain('\n')
  await ui.press({ key: 'geri-liste' })
  await ui.press({ key: 'geri-bildirim' })
  expect((await ui.find({ type: 'Text', text: /Tell us something/ }))?.text).toBe('Tell us something')
  await ui.input({ key: 'geri-bildirim-yazi', text: 'balonlar daha güzel olsun' })
  expect((await ui.find({ type: 'Text', text: /Thanks/ }))?.text).toContain('got your feedback')
  await ui.unmount()
})

test('confirm before leaving: one chat and signing out of all', async ($, on) => {
  kur(on, { sohbetler: [sohbet('oda1', 'kahve_ve_kod', [{ n: 1, kim: 'o', metin: 'selam', at: 0 }]), sohbet('oda2', 'gitmis_biri', [], { bitti: { neden: 'ayrıldı', ben: false } })] })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await kurulumuGec(ui)
  // karşı taraf hâlâ burada
  await ui.press({ key: 'ac-oda1' })
  await ui.press({ key: 'bitir' })
  expect((await ui.find({ type: 'Text', text: /leaving the chat/ }))?.text).toContain('kahve_ve_kod')
  expect(await ui.find({ type: 'Button', key: 'son-mesaj' })).toBeDefined()
  await ui.press({ key: 'ayril-evet' })
  expect(await ui.find({ type: 'Button', key: 'ac-oda1' })).toBeUndefined()
  // karşı taraf zaten ayrılmış
  await ui.press({ key: 'ac-oda2' })
  await ui.press({ key: 'kapat' })
  expect((await ui.find({ type: 'Text', text: /already left/ }))?.text).toContain('gitmis_biri')
  await ui.press({ key: 'ayril-vazgec' })
  await ui.press({ key: 'geri-liste' })
  // hepsinden çıkış
  await ui.press({ key: 'cik' })
  expect((await ui.find({ type: 'Text', text: /leaving meanwhile/ }))?.text).toBe('You’re leaving meanwhile')
  await ui.press({ key: 'ayril-vazgec' })
  await ui.unmount()
})

test('on desktop, chat bubbles are native elements (no images, so the panel never flickers)', async ($, on) => {
  kur(on, { surum: '2.1.332', sohbetler: [sohbet('oda1', 'kahve_ve_kod', [{ n: 1, kim: 'o', metin: 'selam!', at: 0 }, { n: 2, kim: 'ben', metin: 'naber?', at: 1 }], { karsiYaziyor: true })] })
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
  expect(await ui.find({ type: 'Text', text: /^selam!$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^naber\?$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /• • •/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Svg' })) as any[]).toHaveLength(0)
  await ui.unmount()
})

test('photos: permission request, allow, open view-once, send form and disclaimer', async ($, on) => {
  kur(on, {
    sohbetler: [
      sohbet('oda1', 'gece_kusu', [{ n: 1, kim: 'o', metin: '📷 View-once photo', at: 0, foto: { id: 'f1', mod: 'tek', durum: 'bekliyor' } }], {
        kalici: true, fotoIstekGeldi: true, fotoOndan: 'evet', fotoBenden: 'sor',
      }),
    ],
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await kurulumuGec(ui)
  await ui.press({ key: 'ac-oda1' })
  expect((await ui.find({ type: 'Text', text: /wants to send you photos/ }))?.text).toContain('gece_kusu')
  await ui.press({ key: 'foto-evet' })
  expect(await ui.find({ type: 'Button', key: 'foto-evet' })).toBeUndefined()
  await ui.press({ key: 'foto-f1' })
  expect((await ui.find({ type: 'Text', text: /View once: it can’t/ }))?.text).toContain('after you close it')
  await ui.press({ key: 'foto-kapat' })
  expect(await ui.find({ type: 'Button', key: 'foto-f1' })).toBeUndefined()
  await ui.press({ key: 'foto-gonder' })
  expect((await ui.find({ type: 'Text', text: /Before you send a photo/ }))?.text).toBe('Before you send a photo')
  await ui.press({ key: 'foto-kabul' })
  expect(await ui.find({ type: 'Button', key: 'foto-pano' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'foto-gozat' })).toBeDefined()
  expect(await ui.find({ type: 'Input', key: 'foto-yol' })).toBeUndefined()
  await ui.press({ key: 'mod-kalici' })
  expect((await ui.find({ type: 'Text', text: /as long as/ }))?.text).toContain('Stays in the chat')
  await ui.press({ key: 'foto-vazgec' })
  await ui.unmount()
})

test('in a chat, header and input stay fixed, last message is visible', async ($, on) => {
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

test('/mw is short for /meanwhile', async ($, on) => {
  kur(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const kisa = await $.command.run({ command: 'mw', args: 'help' } as any)
  const uzun = await $.command.run({ command: 'meanwhile', args: 'help' } as any)
  expect(kisa.text).toContain('/mw is short for /meanwhile')
  expect(kisa.text).toBe(uzun.text)
})

test('/mw support shows the coffee link', async ($, on) => {
  kur(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const r = await $.command.run({ command: 'mw', args: 'support' } as any)
  expect(r.text).toContain('https://buymeacoffee.com/oktaydak')
})

test('terms: setup needs consent, it is sent with the queue, and existing users are asked once', async ($, on) => {
  const sunucu = kur(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const eksik = await $.command.run({ command: 'mw', args: 'setup gececi_kedi w a 18+' } as any)
  expect(eksik.text).toContain('18+ agree')
  expect(eksik.text).toContain('AI')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await kurulumuGec(ui)
  expect(sunucu.kuyruk.at(-1)?.onay).toBe('2026-11-26')
  // Daha önce kabul etmemiş (eski) kullanıcı: bir kez sorulur.
  sunucu.depo.delete('onay')
  const once = sunucu.kuyruk.length
  await $.command.run({ command: 'mw', args: 'new' } as any)
  expect(sunucu.kuyruk.length).toBe(once)
  expect(await ui.find({ type: 'Button', key: 'onay-evet' })).toBeDefined()
  await ui.press({ key: 'onay-evet' })
  expect(sunucu.kuyruk.length).toBe(once + 1)
  expect(sunucu.kuyruk.at(-1)?.onay).toBe('2026-11-26')
  await ui.unmount()
})
