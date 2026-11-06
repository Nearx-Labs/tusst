import type { CtfTextOverlay } from "../localize";

// tr translation of level 02. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const secondComingText: CtfTextOverlay = {
  title: "İkinci Geliş",
  tagline:
    "Sahibi taşındıktan çok sonra bile herkesin yeniden çalıştırabildiği bir başlatıcı.",
  story:
    "Aziz Stroop Kayıt Defteri kuruldu, başlatıldı ve unutuldu. Sahibi tapuyu ilk gün imzaladı ve bir daha bakmadı.\n\nStroopbeholder sahibin imzasını bin kez okudu. Kimse tapunun iki kez imzalanıp imzalanamayacağını sormadı.",
  brief:
    "## Hedef\n\n`src/level.rs` minik bir kayıt defteri. `transfer_admin` admini değiştirir ve mevcut adminin imzasını ister. `initialize` ilk adminin atanma yolu.\n\n## Görevin\n\n`src/exploit.rs` tek bir fonksiyon dışa aktarır:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nDeğerlendirici yeni bir kayıt defteri kurar, `victim`'i admin olarak başlatır, tüm yetkilendirme mock'larını kaldırır ve sonra senin `solve` fonksiyonunu çağırır. `attacker` admin olsun.\n\n## Kurallar\n\n- Yalnızca `src/exploit.rs` dosyasını düzenleyebilirsin. `Cargo.toml`, `src/lib.rs` ve `src/level.rs` seviye tarafından sabitlenmiştir.\n- `solve` imzasını aynen koru.\n- `attacker`'ın hiçbir imzası yok. `require_auth` gerektiren her şey başarısız olur.\n\n## Durumu okumak\n\n`admin()` herkese açık bir görünümdür. Anahtarların kimde olduğunu kontrol etmek için kullan.",
  hints: [
    "`DataKey::Admin` yazan iki fonksiyonu oku. Biri yazmadan önce bir şey kontrol ediyor. Diğeri etmiyor.",
    "`initialize` ne `require_auth` ne de \"zaten başlatıldı\" kontrolü içeriyor. İkinci bir çağrıyı hiçbir şey engellemiyor.",
    "İmzaya ihtiyacın yok. `initialize`'ı kendin çağır, yeni admin olarak `attacker` ile.",
  ],
};
