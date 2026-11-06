import type { CtfTextOverlay } from "../localize";

// tr translation of level 03. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const borrowedBadgeText: CtfTextOverlay = {
  title: "Ödünç Alınan Rozet",
  tagline:
    "Rozetin imzalı olduğuna bakan — ama kimin rozeti olduğuna hiç bakmayan bir kasa.",
  story:
    "Aziz Stroop'un harç memuru tezgâhta her rozeti kontrol eder. Damgalı mı? İmza taze mi? Takdire değer bir titizlik.\n\nStroopbeholder bir damga görüp başını çevirdi. Memur rozetteki ismin sözleşmedeki isim olup olmadığını hiç sormadı.",
  brief:
    "## Hedef\n\n`src/level.rs` bir ücret kasası. Kurulumda bir admin ve bir yığın ücret saklar. `withdraw_fees(admin)` ücretleri `admin` olarak adlandırılan kişiye öder.\n\n## Görevin\n\n`src/exploit.rs` tek bir fonksiyon dışa aktarır:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nKasa, adminı `victim` için **1.000** ücret tutuyor. Değerlendirici `attacker`'ın **tam olarak tek bir çağrıyı** imzalamasına izin verir: `withdraw_fees(attacker)`. Başka kimse imzalayamaz. `attacker` ücretlerle ayrılsın.\n\n## Kurallar\n\n- Yalnızca `src/exploit.rs` dosyasını düzenleyebilirsin. `Cargo.toml`, `src/lib.rs` ve `src/level.rs` seviye tarafından sabitlenmiştir.\n- `solve` imzasını aynen koru.\n- `victim`'i admin olarak adlandırmak `victim`'in imzasını gerektirir; sende o yok.\n\n## Ledger'ı okumak\n\n`fees()` ve `balance_of(who)` herkese açık görünümlerdir. Sonucu kontrol etmek için kullan.",
  hints: [
    "`withdraw_fees` argüman olarak `admin` alır. Sözleşme bu argümanı `DataKey::Admin`'de saklanan admin ile nerede karşılaştırıyor?",
    "`admin.require_auth()` adı geçenin imzaladığını kanıtlar. Adı geçen adresin gerçek admin olup olmadığı hakkında hiçbir şey söylemez.",
    "`attacker` adına imzalayabilirsin. `attacker`'ı admin olarak adlandır: `withdraw_fees(&attacker)`.",
  ],
};
