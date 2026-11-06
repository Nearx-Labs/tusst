import type { CtfTextOverlay } from "../localize";

// es translation of level 04. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const negativeSpaceText: CtfTextOverlay = {
  title: "Espacio Negativo",
  tagline:
    "Una transferencia que comprueba que el remitente puede pagar — y nunca que el monto sea real.",
  story:
    "El Cofre de San Stroop lleva libros honestos. Cada transferencia se comprueba: ¿tiene el remitente suficiente? Si es así, los números se mueven.\n\nEl escribiente que redactó la comprobación nunca imaginó a un cliente pidiendo enviar menos que nada. Raven, posado en el mostrador, sí lo imaginó, y desde entonces no deja de graznar al respecto.",
  brief:
    "## El objetivo\n\n`src/level.rs` es un libro mayor. `transfer(from, to, amount)` exige la firma de `from`, comprueba que `from` puede pagar `amount` y luego lo mueve.\n\n## Tu trabajo\n\n`src/exploit.rs` exporta una función:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nEl cofre guarda **1.000** para `victim` y nada para `attacker`. El evaluador deja que toda llamada sea firmada y luego comprueba el estado final: `victim` debe **seguir** teniendo 1.000, y `attacker` debe tener **al menos 1.000**.\n\n## Reglas\n\n- Puedes editar **únicamente** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` y `src/level.rs` son fijos del nivel.\n- Mantén la firma de `solve` exactamente como está.\n- Quitarle las monedas a la víctima la deja más pobre, así que no cuenta. Otro tiene que pagar.\n\n## Leyendo el ledger\n\n`balance_of(who)` es una vista pública. Cualquier dirección puede tener saldo, incluida la del propio cofre.",
  hints: [
    "Mira qué comprueba `transfer` sobre `amount`. Comprueba que el remitente puede pagarlo. ¿Comprueba que `amount` sea positivo?",
    "Con un `amount` negativo, `from_balance - amount` crece y `to_balance + amount` disminuye. La transferencia corre al revés.",
    "Firmas como `attacker`, así que `attacker` puede ser `from`. Elige cualquier dirección que no sea la víctima como `to`, incluso la del propio cofre, y envía `-1_000`.",
  ],
};
