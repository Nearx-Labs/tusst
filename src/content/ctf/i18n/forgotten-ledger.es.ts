import type { CtfTextOverlay } from "../localize";

// es translation of level 06. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const forgottenLedgerText: CtfTextOverlay = {
  title: "El Libro Mayor Olvidado",
  tagline:
    "Un sello único que caduca en silencio mientras el contrato queda inactivo.",
  story:
    "El Archivo de San Stroop fue sellado el día que abrió. El sello valía un día. Nadie lo renovó, porque nadie recordó que podía agotarse.\n\nEl archivo se ve exactamente igual. El sello simplemente desapareció, y ni siquiera el Stroopbeholder puede ver una expiración.",
  brief:
    "## El objetivo\n\n`src/level.rs` es un archivo. `initialize` nombra al admin y se niega a ejecutarse una segunda vez. Recuerda que ya se ejecutó en una entrada de storage **temporary**; el admin vive en storage **persistent**.\n\n## Tu trabajo\n\n`src/exploit.rs` exporta una función:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nEl evaluador despliega el archivo, lo inicializa con `victim` como admin y elimina todos los mocks de autorización. Un segundo `initialize` se rechaza hoy. Haz que `attacker` sea el admin de todos modos.\n\n## Reglas\n\n- Puedes editar **únicamente** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` y `src/level.rs` son fijos del nivel.\n- Mantén la firma de `solve` exactamente como está.\n- `attacker` no tiene ninguna firma. En una red real no puedes mover el reloj; solo puedes esperar. El entorno de pruebas deja que `solve` haga la espera.\n\n## Leyendo el estado\n\n`admin()` es una vista pública. Úsala para comprobar quién tiene las llaves.",
  hints: [
    "Enumera dónde se guarda cada valor y por cuánto tiempo. ¿En qué entrada se apoya `initialize` para rechazar una segunda llamada, y algo la extiende alguna vez?",
    "El sello es una entrada temporal con un TTL de unos 17.280 ledgers. El admin, en storage persistente, dura mucho más. Cuando el sello caduca, `has(&DataKey::Sealed)` vuelve a ser falso.",
    "Deja pasar el tiempo dentro de la prueba: `env.ledger().with_mut(|l| l.sequence_number += ...)` (importa `soroban_sdk::testutils::Ledger`). Luego llama a `initialize` con `attacker`.",
  ],
};
