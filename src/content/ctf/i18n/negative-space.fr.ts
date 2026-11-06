import type { CtfTextOverlay } from "../localize";

// fr translation of level 04. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const negativeSpaceText: CtfTextOverlay = {
  title: "Espace Négatif",
  tagline:
    "Un transfert qui vérifie que l'expéditeur peut payer — et jamais que le montant est réel.",
  story:
    "Le Coffre de Saint Stroop tient des livres honnêtes. Chaque transfert est vérifié : l'expéditeur a-t-il assez ? Si oui, les chiffres bougent.\n\nLe commis qui a écrit la vérification n'a jamais imaginé qu'un client demande d'envoyer moins que rien. Raven, perché sur le comptoir, l'a imaginé, et croasse à ce sujet depuis.",
  brief:
    "## La cible\n\n`src/level.rs` est un registre. `transfer(from, to, amount)` exige la signature de `from`, vérifie que `from` peut payer `amount`, puis le déplace.\n\n## Votre mission\n\n`src/exploit.rs` exporte une fonction :\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nLe coffre contient **1 000** pour `victim` et rien pour `attacker`. Le correcteur laisse signer tous les appels, puis vérifie l'état final : `victim` doit **encore** détenir 1 000, et `attacker` doit en détenir **au moins 1 000**.\n\n## Règles\n\n- Vous ne pouvez modifier **que** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` et `src/level.rs` sont fixés par le niveau.\n- Gardez la signature de `solve` exactement telle quelle.\n- Prendre les pièces de la victime l'appauvrit, donc cela ne compte pas. Quelqu'un d'autre doit payer.\n\n## Lire le ledger\n\n`balance_of(who)` est une vue publique. N'importe quelle adresse peut avoir un solde, y compris celle du coffre lui-même.",
  hints: [
    "Regardez ce que `transfer` vérifie sur `amount`. Il vérifie que l'expéditeur peut payer. Vérifie-t-il que `amount` est positif ?",
    "Avec un `amount` négatif, `from_balance - amount` augmente et `to_balance + amount` diminue. Le transfert s'exécute à l'envers.",
    "Vous signez en tant qu'`attacker`, donc `attacker` peut être `from`. Choisissez comme `to` n'importe quelle adresse autre que la victime, même celle du coffre, et envoyez `-1_000`.",
  ],
};
