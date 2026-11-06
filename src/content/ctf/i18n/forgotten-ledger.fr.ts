import type { CtfTextOverlay } from "../localize";

// fr translation of level 06. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const forgottenLedgerText: CtfTextOverlay = {
  title: "Le Registre Oublié",
  tagline:
    "Un sceau à usage unique qui expire en silence pendant que le contrat dort.",
  story:
    "Les Archives de Saint Stroop ont été scellées le jour de leur ouverture. Le sceau valait un jour. Personne ne l'a renouvelé, car personne ne se rappelait qu'il pouvait expirer.\n\nLes archives ont exactement le même aspect. Le sceau, lui, a simplement disparu, et même le Stroopbeholder ne peut voir une expiration.",
  brief:
    "## La cible\n\n`src/level.rs` est une archive. `initialize` nomme l'admin et refuse de s'exécuter une seconde fois. Elle se souvient d'avoir déjà tourné dans une entrée de stockage **temporary** ; l'admin vit dans le stockage **persistent**.\n\n## Votre mission\n\n`src/exploit.rs` exporte une fonction :\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nLe correcteur déploie l'archive, l'initialise avec `victim` comme admin et retire tous les mocks d'autorisation. Un second `initialize` est refusé aujourd'hui. Faites quand même d'`attacker` l'admin.\n\n## Règles\n\n- Vous ne pouvez modifier **que** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` et `src/level.rs` sont fixés par le niveau.\n- Gardez la signature de `solve` exactement telle quelle.\n- `attacker` ne détient aucune signature. Sur un vrai réseau, vous ne pouvez pas avancer l'horloge ; vous ne pouvez qu'attendre. L'environnement de test laisse `solve` faire l'attente.\n\n## Lire l'état\n\n`admin()` est une vue publique. Utilisez-la pour vérifier qui détient les clés.",
  hints: [
    "Listez où chaque valeur est stockée et pour combien de temps. Sur quelle entrée `initialize` s'appuie-t-il pour refuser un second appel, et quelque chose la prolonge-t-il jamais ?",
    "Le sceau est une entrée temporaire avec un TTL d'environ 17 280 ledgers. L'admin, en stockage persistant, dure bien plus longtemps. Une fois le sceau expiré, `has(&DataKey::Sealed)` redevient faux.",
    "Laissez le temps passer dans le test : `env.ledger().with_mut(|l| l.sequence_number += ...)` (importez `soroban_sdk::testutils::Ledger`). Puis appelez `initialize` avec `attacker`.",
  ],
};
