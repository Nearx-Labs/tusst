import type { CtfTextOverlay } from "../localize";

// tr translation of level 06. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const forgottenLedgerText: CtfTextOverlay = {
  title: "Unutulan Defter",
  tagline:
    "Sözleşme boşta dururken sessizce süresi dolan tek seferlik bir mühür.",
  story:
    "Aziz Stroop Arşivi açıldığı gün mühürlendi. Mühür bir gün geçerliydi. Kimse yenilemedi, çünkü kimse süresinin dolabileceğini hatırlamadı.\n\nArşiv tıpkı eskisi gibi görünüyor. Mühür ise sadece yok oldu ve Stroopbeholder bile bir sürenin dolduğunu göremez.",
  brief:
    "## Hedef\n\n`src/level.rs` bir arşiv. `initialize` admini atar ve ikinci kez çalışmayı reddeder. Zaten çalıştığını **temporary** bir storage kaydında hatırlar; admin ise **persistent** storage'da yaşar.\n\n## Görevin\n\n`src/exploit.rs` tek bir fonksiyon dışa aktarır:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nDeğerlendirici arşivi kurar, `victim`'i admin olarak başlatır ve tüm yetkilendirme mock'larını kaldırır. İkinci bir `initialize` bugün reddedilir. Yine de `attacker` admin olsun.\n\n## Kurallar\n\n- Yalnızca `src/exploit.rs` dosyasını düzenleyebilirsin. `Cargo.toml`, `src/lib.rs` ve `src/level.rs` seviye tarafından sabitlenmiştir.\n- `solve` imzasını aynen koru.\n- `attacker`'ın hiçbir imzası yok. Gerçek bir ağda saati ileri alamazsın; yalnızca bekleyebilirsin. Test ortamı beklemeyi `solve`'a bırakır.\n\n## Durumu okumak\n\n`admin()` herkese açık bir görünümdür. Anahtarların kimde olduğunu kontrol etmek için kullan.",
  hints: [
    "Her değerin nerede ve ne kadar süreyle saklandığını listele. `initialize` ikinci çağrıyı reddetmek için hangi kayda dayanıyor ve onu uzatan bir şey var mı?",
    "Mühür, yaklaşık 17.280 ledger TTL'li geçici bir kayıttır. Persistent storage'daki admin çok daha uzun yaşar. Mühür dolunca `has(&DataKey::Sealed)` tekrar false olur.",
    "Testin içinde zamanın geçmesine izin ver: `env.ledger().with_mut(|l| l.sequence_number += ...)` (`soroban_sdk::testutils::Ledger`'ı içe aktar). Sonra `attacker` ile `initialize` çağır.",
  ],
};
