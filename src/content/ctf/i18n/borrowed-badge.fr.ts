import type { CtfTextOverlay } from "../localize";

// fr translation of level 03. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const borrowedBadgeText: CtfTextOverlay = {
  title: "Le Badge Emprunté",
  tagline:
    "Un coffre qui vérifie que le badge est signé — et jamais à qui il appartient.",
  story:
    "Le péager de Saint Stroop vérifie chaque badge au comptoir. Est-il tamponné ? La signature est-elle récente ? Une diligence admirable.\n\nLe Stroopbeholder a vu un tampon et a détourné le regard. Le péager ne s'est jamais demandé si le nom sur le badge est celui du bail.",
  brief:
    "## La cible\n\n`src/level.rs` est un coffre de frais. Au déploiement il stocke un admin et un tas de frais. `withdraw_fees(admin)` verse les frais à celui qui est nommé `admin`.\n\n## Votre mission\n\n`src/exploit.rs` exporte une fonction :\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nLe coffre contient **1 000** de frais pour `victim`, son admin. Le correcteur laisse `attacker` signer **exactement un appel** : `withdraw_fees(attacker)`. Personne d'autre ne peut signer. Faites repartir `attacker` avec les frais.\n\n## Règles\n\n- Vous ne pouvez modifier **que** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` et `src/level.rs` sont fixés par le niveau.\n- Gardez la signature de `solve` exactement telle quelle.\n- Nommer `victim` comme admin demande la signature de `victim`, que vous n'avez pas.\n\n## Lire le ledger\n\n`fees()` et `balance_of(who)` sont des vues publiques. Utilisez-les pour vérifier le résultat.",
  hints: [
    "`withdraw_fees` reçoit `admin` en argument. Où le contrat compare-t-il cet argument à l'admin stocké dans `DataKey::Admin` ?",
    "`admin.require_auth()` prouve que la personne nommée a signé. Il ne dit rien sur le fait que l'adresse nommée soit le vrai admin.",
    "Vous pouvez signer pour `attacker`. Nommez `attacker` comme admin : `withdraw_fees(&attacker)`.",
  ],
};
