import type { CtfTextOverlay } from "../localize";

// tr translation of level 04. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const negativeSpaceText: CtfTextOverlay = {
  title: "Negatif Alan",
  tagline:
    "Göndericinin ödeyebildiğine bakan — ama tutarın gerçek olup olmadığına hiç bakmayan bir transfer.",
  story:
    "Aziz Stroop Kasası dürüst defterler tutar. Her transfer kontrol edilir: gönderenin yeterli parası var mı? Varsa rakamlar yer değiştirir.\n\nKontrolü yazan katip, bir müşterinin hiçbir şeyden az göndermek isteyeceğini hiç düşünmedi.",
  brief:
    "## Hedef\n\n`src/level.rs` bir defter. `transfer(from, to, amount)` `from`'a imza attırır, `from`'un `amount` tutarını karşılayabildiğini kontrol eder, sonra taşır.\n\n## Görevin\n\n`src/exploit.rs` tek bir fonksiyon dışa aktarır:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nKasa `victim` için **1.000** tutuyor, `attacker` için hiçbir şey. Değerlendirici her çağrının imzalanmasına izin verir, sonra son durumu kontrol eder: `victim` **hâlâ** 1.000'e sahip olmalı ve `attacker` **en az 1.000**'e sahip olmalı.\n\n## Kurallar\n\n- Yalnızca `src/exploit.rs` dosyasını düzenleyebilirsin. `Cargo.toml`, `src/lib.rs` ve `src/level.rs` seviye tarafından sabitlenmiştir.\n- `solve` imzasını aynen koru.\n- Kurbanın paralarını almak onu daha yoksul bırakır, bu yüzden sayılmaz. Başka biri ödemek zorunda.\n\n## Ledger'ı okumak\n\n`balance_of(who)` herkese açık bir görünümdür. Her adres bakiyeye sahip olabilir, kasanın kendi adresi dahil.",
  hints: [
    "`transfer`'ın `amount` hakkında neyi kontrol ettiğine bak. Göndericinin ödeyebildiğini kontrol ediyor. `amount`'ın pozitif olduğunu kontrol ediyor mu?",
    "Negatif bir `amount` ile `from_balance - amount` büyür ve `to_balance + amount` küçülür. Transfer tersine çalışır.",
    "`attacker` olarak imzalıyorsun, yani `attacker` `from` olabilir. `to` olarak kurban dışında herhangi bir adres seç, kasanın kendi adresi bile olur, ve `-1_000` gönder.",
  ],
};
