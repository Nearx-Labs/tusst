import type { CtfTextOverlay } from "../localize";

// es translation of level 03. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const borrowedBadgeText: CtfTextOverlay = {
  title: "La Credencial Prestada",
  tagline:
    "Una bóveda que comprueba que la credencial esté firmada — y nunca de quién es.",
  story:
    "El cobrador de peajes de San Stroop revisa cada credencial en el mostrador. ¿Está sellada? ¿La firma es reciente? Una diligencia admirable.\n\nEl Stroopbeholder vio un sello y apartó la mirada. El cobrador nunca preguntó si el nombre de la credencial es el del contrato.",
  brief:
    "## El objetivo\n\n`src/level.rs` es una bóveda de comisiones. Al desplegarse guarda un admin y un montón de comisiones. `withdraw_fees(admin)` paga las comisiones a quien se nombre como `admin`.\n\n## Tu trabajo\n\n`src/exploit.rs` exporta una función:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nLa bóveda guarda **1.000** en comisiones para `victim`, su admin. El evaluador deja que `attacker` firme **exactamente una llamada**: `withdraw_fees(attacker)`. Nadie más puede firmar. Haz que `attacker` se lleve las comisiones.\n\n## Reglas\n\n- Puedes editar **únicamente** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` y `src/level.rs` son fijos del nivel.\n- Mantén la firma de `solve` exactamente como está.\n- Nombrar a `victim` como admin requiere la firma de `victim`, que no tienes.\n\n## Leyendo el ledger\n\n`fees()` y `balance_of(who)` son vistas públicas. Úsalas para comprobar el resultado.",
  hints: [
    "`withdraw_fees` recibe `admin` como argumento. ¿Dónde compara el contrato ese argumento con el admin guardado en `DataKey::Admin`?",
    "`admin.require_auth()` prueba que quien fue nombrado firmó. No dice nada sobre si la dirección nombrada es el admin real.",
    "Puedes firmar por `attacker`. Nombra a `attacker` como admin: `withdraw_fees(&attacker)`.",
  ],
};
