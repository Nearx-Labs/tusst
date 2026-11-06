import type { CtfTextOverlay } from "../localize";

// fr translation of level 05. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const dustMillText: CtfTextOverlay = {
  title: "Le Moulin à Poussière",
  tagline:
    "Un pool qui arrondit en faveur du déposant, une unité à la fois.",
  story:
    "Le Moulin à Poussière de Saint Stroop broie les dépôts en parts. Le meunier est généreux : quand les chiffres ne tombent pas juste, il arrondit en faveur du client. C'est une gentillesse. Elle coûte une fraction de pièce.\n\nUne fraction de pièce, multipliée par mille clients, c'est un meunier qui n'est plus riche.",
  brief:
    "## La cible\n\n`src/level.rs` est un pool. `deposit(from, assets)` transforme des actifs en parts ; `redeem(from, shares)` retransforme des parts en actifs. Le pool contient **1 500** et a émis **1 000** parts, toutes à `victim`, donc chaque part vaut 1,5.\n\n## Votre mission\n\n`src/exploit.rs` exporte une fonction :\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\n`attacker` arrive avec un portefeuille de **1 000**. Le correcteur laisse signer tous les appels, puis vérifie que le portefeuille d'`attacker` termine à **1 100 ou plus** : un profit d'au moins 100, prélevé sur le pool.\n\n## Règles\n\n- Vous ne pouvez modifier **que** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` et `src/level.rs` sont fixés par le niveau.\n- Gardez la signature de `solve` exactement telle quelle.\n- `redeem` ne paie que le compte propriétaire des parts. Agir pour `victim` ne vous rapporte rien.\n\n## Lire le ledger\n\n`wallet_of`, `shares_of`, `total_assets` et `total_shares` sont des vues publiques.",
  hints: [
    "Comparez l'arrondi de `deposit` avec celui de `redeem`. Lequel arrondit vers le haut, et qui cela avantage-t-il ?",
    "Déposer 1 unité émet `ceil(1 * 1000 / 1500)` = 1 part entière, que `redeem` valorise à 1,5. Le gain est minuscule, mais il se répète.",
    "Un gros dépôt n'aide pas : l'arrondi ne compte que sur de petits montants. Déposez 1 unité de nombreuses fois, collectez les parts, puis rachetez-les toutes d'un coup.",
  ],
};
