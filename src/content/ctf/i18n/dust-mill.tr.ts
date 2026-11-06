import type { CtfTextOverlay } from "../localize";

// tr translation of level 05. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const dustMillText: CtfTextOverlay = {
  title: "Toz Değirmeni",
  tagline:
    "Yatırıcının lehine yuvarlayan bir havuz, her seferinde bir birim.",
  story:
    "Aziz Stroop Toz Değirmeni mevduatları paylara öğütür. Değirmenci cömerttir: rakamlar tam bölünmediğinde müşterinin lehine yuvarlar. Bu bir nezaket. Bir paranın küçük bir kesrine mal olur.\n\nBir paranın kesri, bin müşteriyle çarpılınca, artık zengin olmayan bir değirmenci eder.",
  brief:
    "## Hedef\n\n`src/level.rs` bir havuz. `deposit(from, assets)` varlıkları paylara çevirir; `redeem(from, shares)` payları tekrar varlığa çevirir. Havuzda **1.500** var ve hepsi `victim`'e ait **1.000** pay çıkarılmış, yani her pay 1,5 değerinde.\n\n## Görevin\n\n`src/exploit.rs` tek bir fonksiyon dışa aktarır:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\n`attacker` **1.000**'lik bir cüzdanla gelir. Değerlendirici her çağrının imzalanmasına izin verir, sonra `attacker`'ın cüzdanının **1.100 veya daha fazla** ile bittiğini kontrol eder: havuzdan alınmış en az 100'lük bir kâr.\n\n## Kurallar\n\n- Yalnızca `src/exploit.rs` dosyasını düzenleyebilirsin. `Cargo.toml`, `src/lib.rs` ve `src/level.rs` seviye tarafından sabitlenmiştir.\n- `solve` imzasını aynen koru.\n- `redeem` yalnızca payların sahibi hesaba ödeme yapar. `victim` adına hareket etmek sana bir şey kazandırmaz.\n\n## Ledger'ı okumak\n\n`wallet_of`, `shares_of`, `total_assets` ve `total_shares` herkese açık görünümlerdir.",
  hints: [
    "`deposit`'teki yuvarlamayı `redeem`'dekiyle karşılaştır. Hangisi yukarı yuvarlıyor ve bu kimin lehine?",
    "1 birim yatırmak `ceil(1 * 1000 / 1500)` = 1 tam pay basar; `redeem` bunu 1,5 değerler. Kazanç çok küçük ama tekrar eder.",
    "Tek seferde büyük tutar işe yaramaz: yuvarlama yalnızca küçük tutarlarda önemlidir. 1 birimi defalarca yatır, payları biriktir, sonra hepsini bir seferde bozdur.",
  ],
};
