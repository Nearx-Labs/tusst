import type { CtfTextOverlay } from "../localize";

// fr translation of level 02. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const secondComingText: CtfTextOverlay = {
  title: "Le Second Avènement",
  tagline:
    "Un initialiseur que n'importe qui peut relancer, bien après l'emménagement du propriétaire.",
  story:
    "Le Registre de Saint Stroop a été déployé, initialisé puis oublié. Son propriétaire a signé l'acte le premier jour et ne l'a plus jamais regardé.\n\nPersonne n'a jamais demandé si l'acte pouvait être signé deux fois.",
  brief:
    "## La cible\n\n`src/level.rs` est un registre minuscule. `transfer_admin` change l'admin et exige la signature de l'admin actuel. `initialize` sert à nommer le premier admin.\n\n## Votre mission\n\n`src/exploit.rs` exporte une fonction :\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nLe correcteur déploie un registre neuf, l'initialise avec `victim` comme admin, retire tous les mocks d'autorisation, puis appelle votre `solve`. Faites d'`attacker` l'admin.\n\n## Règles\n\n- Vous ne pouvez modifier **que** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` et `src/level.rs` sont fixés par le niveau.\n- Gardez la signature de `solve` exactement telle quelle.\n- `attacker` ne détient aucune signature. Tout ce qui exige `require_auth` échouera.\n\n## Lire l'état\n\n`admin()` est une vue publique. Utilisez-la pour vérifier qui détient les clés.",
  hints: [
    "Lisez les deux fonctions qui écrivent `DataKey::Admin`. L'une vérifie quelque chose avant d'écrire. L'autre non.",
    "`initialize` n'a ni `require_auth` ni vérification « déjà initialisé ». Rien n'empêche un second appel.",
    "Vous n'avez pas besoin de signature. Appelez `initialize` vous-même, avec `attacker` comme nouvel admin.",
  ],
};
