# ask.sh

Kod yazarken biriyle tanış. Claude Code'da `/date` yaz; o an burada olan biriyle eşleş ve işini bırakmadan yan panelde konuş.

https://ask.oktaydak.com

## Kurulum

Terminalde tek komut:

```
curl -fsSL https://ask.oktaydak.com/kur.sh | sh
```

Eklentiyi kurar (kuruluysa günceller) ve ask.sh için otomatik güncellemeyi açar: yeni sürümler Claude'u her açışında kendiliğinden gelir. Betik kısa, önce okumak istersen: https://ask.oktaydak.com/kur.sh

Claude Code içinden kurmak istersen:

```
/plugin install asksh --marketplace radioheavy/asksh
```

ardından `/plugin` → Marketplaces → asksh → Enable auto-update.

Masaüstü uygulamasında: istem kutusunun yanındaki + → Plugins → Add marketplace → `radioheavy/asksh` → Add plugin.

## Güncelleme

ask.sh yalnızca en son sürümle çalışır; eski sürümde kalan panel "güncelle" ekranı gösterir. Otomatik güncelleme açıksa Claude'u yeniden başlatman yeter. Değilse kurulum komutunu tekrar çalıştır:

```
curl -fsSL https://ask.oktaydak.com/kur.sh | sh
```

Hangi sürümde olduğunu `/date sürüm` gösterir.

## Kullanım

```
/date                  paneli aç, tanışmaya başla
/date yeni             sohbetlerin sürerken yeni biriyle tanış
/date sohbetler        sohbet listesine dön
/date <mesaj>          açık sohbete mesaj gönder (panelden de yazabilirsin)
/date bitir            açık sohbeti bitir (kalıcı bağlantıyı siler)
/date engelle          bu kişiyle bir daha karşılaşma
/date bildir [neden]   rahatsız edeni bildir
/date engellediklerim  engellediklerini gör, istersen engeli kaldır
/date ayrıl            sıradan sohbetleri bitir (kalıcı bağlantılar durur)
/date sürüm            sürümün ve güncelleme durumu
/date yardım           bütün komutlar
```

İlk açılışta bir rumuz, cinsiyetin ve kimlerle tanışmak istediğin sorulur. Cinsiyetin karşındakine renkle görünür (kadın pembe, erkek mavi; söylemek istemezsen nötr bir renk). Kimlerle tanışmak istediğin hiç görünmez, sadece eşleştirmede kullanılır. İstersen alanını (Frontend, Backend…) ve şu anki halini (deploy bekliyor, gece mesaisinde…) da ekleyebilirsin; bunlar karşındakine görünür.

Aynı anda birden fazla kişiyle konuşabilirsin: panelde bir sohbet listesi, her birinde okunmamış sayısı ve "yazıyor…" durumu var. Panele geçmek için `ctrl+x tab`.

**★ Bağlantıda kal:** İki taraf da isterse sohbet kalıcı olur. Claude'u kapatıp açsan da sohbet durur, karşın çevrimdışıyken yazdığın mesaj onu bekler. Bağlantıyı silen olursa mesajlarıyla birlikte silinir.

## Fotoğraf

Fotoğraf yalnızca **★ bağlantıda kaldığınız** kişilere gönderilebilir ve önce **karşı tarafın izni** istenir ("📷 Aslı sana fotoğraf göndermek istiyor. Almak ister misin?"). Hayır dersen o sohbette ondan fotoğraf gelmez; istediğin zaman "Fotoğraflara izin ver" ile açabilirsin. Sohbet listesinin altından genel olarak fotoğraf almayı kapatabilirsin.

Gönderirken sen seçersin: **🔥 Tek gösterim** (bir kez açılır, sonra herkesten silinir) ya da **📌 Sohbette kalsın** (bağlantı durdukça kalır). Panodaki ekran görüntüsünü ya da bir dosyayı gönderebilirsin; fotoğraf gönderilmeden önce küçültülür ve içindeki konum gibi bilgiler silinir (ffmpeg, ImageMagick ya da macOS'ta sips gerekir).

**Sorumluluk reddi:**
- Gönderdiğin fotoğraftan yalnızca sen sorumlusun.
- Çıplaklık ya da cinsel içerik, başkasına ait ya da izinsiz çekilmiş görüntüler ve 18 yaşından küçükleri gösteren her türlü görüntü yasaktır. Bildirilen fotoğraflar incelenir; kural ihlalinde erişim kapatılır ve gerekirse yetkililere bildirilir.
- Tek gösterimlik fotoğraf açıldıktan sonra silinir, ama karşındaki ekran görüntüsü alabilir; ask.sh bunu engelleyemez.

## Gizlilik ve güvenlik

- Gerçek ad, e-posta ya da fotoğraf istenmez; sadece rumuzun görünür.
- Sıradan sohbetler sunucunun belleğinde durur ve bitince silinir. İki tarafın da istediği kalıcı bağlantıların mesajları, biri bağlantıyı silene kadar saklanır. Bildirilen sohbetlerin son mesajları inceleme için saklanır.
- Bildirimlerde mesajın kendisi görünmez; telefon, e-posta ya da link yazarsan göndermeden önce uyarılırsın.
- **Karşındakinin yazdıkları Claude'a hiç gitmez.** Mesajlar yalnızca panelde ve bildirimlerde görünür; komut çıktıları modele gönderilmeyecek şekilde işaretlidir. Kimse senin Claude'una senin adına bir şey yaptıramaz.
- 18 yaş ve üzeri içindir.

## Notlar

Bu eklenti Claude Code'un yeni "mod" altyapısını (komut, panel, bildirim) kullanır. Bu altyapı erken erişimde olduğu için Claude Code güncellemelerinde değişebilir.

Telif hakkı © 2026 radioheavy. Tüm hakları saklıdır.
