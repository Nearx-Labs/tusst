import type { CtfTextOverlay } from "../localize";

// French translation of level 01. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const openGateText: CtfTextOverlay = {
  title: "La Porte Ouverte",
  tagline:
    "Un coffre qui demande la signature du déposant — puis laisse n'importe qui dépenser le dépôt.",
  story:
    "La Porte de Saint Stroop tient depuis cent ledgers. Son gardien dort, le coffre est plein, et la seule chose qui sépare les villageois de leurs économies est une ligne de Rust qui n'a jamais été écrite.\n\nVous êtes l'auditeur que le gardien n'a jamais engagé.",
  brief:
    "## La cible\n\n`src/level.rs` est un petit coffre. `deposit` demande une signature au déposant. `withdraw` déplace des fonds entre deux comptes — et ne demande rien.\n\n## Votre mission\n\n`src/exploit.rs` exporte une fonction :\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nLe correcteur déploie un coffre neuf, crédite `victim` de **1 000**, retire tous les mocks d'autorisation, puis appelle votre `solve`. Faites en sorte qu'`attacker` reparte avec le solde de la victime.\n\n## Règles\n\n- Vous ne pouvez modifier **que** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` et `src/level.rs` sont fixés par le niveau.\n- Gardez la signature de `solve` exactement telle quelle.\n- Le test caché s'exécute dans la même sandbox que la Forge : pas de réseau, pas de clés, pas d'accès au système de fichiers de l'hôte.\n\n## Lire le ledger\n\n`balance_of(who)` est une vue publique. Utilisez-la pour découvrir combien il y a avant de le déplacer.",
  hints: [
    "Comparez `deposit` et `withdraw` ligne par ligne. Laquelle appelle `require_auth` ?",
    "`withdraw(from, to, amount)` fait confiance à l'argument `from`. Le coffre ne vérifie jamais que l'appelant est `from`.",
    "Vous n'avez pas besoin de signature. Il vous faut les bons arguments : la victime en `from`, l'attaquant en `to` et le solde de la victime en `amount`.",
  ],
};
