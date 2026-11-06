import type { CtfTextOverlay } from "../localize";

// Spanish translation of level 01. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const openGateText: CtfTextOverlay = {
  title: "La Puerta Abierta",
  tagline:
    "Una bóveda que pide la firma del depositante — y luego deja que cualquiera gaste el depósito.",
  story:
    "La Puerta de San Stroop lleva cien ledgers en pie. Su guardián duerme, la bóveda está llena, y lo único que separa a los aldeanos de sus ahorros es una línea de Rust que nunca se escribió.\n\nTú eres el auditor que el guardián nunca contrató.",
  brief:
    "## El objetivo\n\n`src/level.rs` es una pequeña bóveda. `deposit` pide una firma al depositante. `withdraw` mueve fondos entre dos cuentas — y no pide nada.\n\n## Tu trabajo\n\n`src/exploit.rs` exporta una función:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nEl evaluador despliega una bóveda nueva, financia a `victim` con **1.000**, elimina todos los mocks de autorización y luego llama a tu `solve`. Haz que `attacker` se lleve el saldo de la víctima.\n\n## Reglas\n\n- Solo puedes editar **únicamente** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` y `src/level.rs` son fijos del nivel.\n- Mantén la firma de `solve` exactamente como está.\n- La prueba oculta corre en la misma sandbox que la Forja: sin red, sin claves, sin acceso al sistema de archivos del host.\n\n## Leyendo el ledger\n\n`balance_of(who)` es una vista pública. Úsala para descubrir cuánto hay antes de moverlo.",
  hints: [
    "Compara `deposit` y `withdraw` línea por línea. ¿Cuál llama a `require_auth`?",
    "`withdraw(from, to, amount)` confía en el argumento `from`. La bóveda nunca verifica que quien llama sea `from`.",
    "No necesitas una firma. Necesitas los argumentos correctos: la víctima como `from`, el atacante como `to` y el saldo de la víctima como `amount`.",
  ],
};
