import type { CtfTextOverlay } from "../localize";

// Turkish translation of level 01. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const openGateText: CtfTextOverlay = {
  title: "Açık Kapı",
  tagline:
    "Mevduat sahibinden imza isteyen — sonra herkesin mevduatı harcamasına izin veren bir kasa.",
  story:
    "Paslı Ada'daki Aziz Stroop Kapısı yüz ledger boyunca ayakta durdu. Bekçisi uyuyor, kasa dolu ve köylülerle birikimleri arasındaki tek şey hiç yazılmamış bir Rust satırı.\n\nStroopbeholder onu ilk ledger'dan beri arıyor ve sayısız gözü bir yokluğu göremiyor. Sen bekçinin hiç işe almadığı denetçisin.",
  brief:
    "## Hedef\n\n`src/level.rs` küçük bir kasa. `deposit` mevduat sahibinden imza ister. `withdraw` iki hesap arasında para taşır — ve hiçbir şey istemez.\n\n## Görevin\n\n`src/exploit.rs` tek bir fonksiyon dışa aktarır:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nDeğerlendirici yeni bir kasa kurar, `victim` hesabına **1.000** yatırır, tüm yetkilendirme mock'larını kaldırır ve sonra senin `solve` fonksiyonunu çağırır. `attacker` kurbanın bakiyesiyle ayrılsın.\n\n## Kurallar\n\n- Yalnızca `src/exploit.rs` dosyasını düzenleyebilirsin. `Cargo.toml`, `src/lib.rs` ve `src/level.rs` seviye tarafından sabitlenmiştir.\n- `solve` imzasını aynen koru.\n- Gizli test Forge ile aynı sandbox'ta çalışır: ağ yok, anahtar yok, ana makine dosya sistemi yok.\n\n## Ledger'ı okumak\n\n`balance_of(who)` herkese açık bir görünümdür. Taşımadan önce ne kadar olduğunu öğrenmek için kullan.",
  hints: [
    "`deposit` ve `withdraw` fonksiyonlarını satır satır karşılaştır. Hangisi `require_auth` çağırıyor?",
    "`withdraw(from, to, amount)` `from` argümanına güvenir. Kasa, çağıranın `from` olduğunu asla doğrulamaz.",
    "İmzaya ihtiyacın yok. Doğru argümanlara ihtiyacın var: `from` olarak kurban, `to` olarak saldırgan ve `amount` olarak kurbanın bakiyesi.",
  ],
};
