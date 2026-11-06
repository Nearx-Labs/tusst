import type { CtfTextOverlay } from "../localize";

// es translation of level 05. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const dustMillText: CtfTextOverlay = {
  title: "El Molino de Polvo",
  tagline:
    "Un pool que redondea a favor de quien deposita, una unidad a la vez.",
  story:
    "El Molino de Polvo de San Stroop muele depósitos en participaciones. El molinero es generoso: cuando los números no dividen exactamente, redondea a favor del cliente. Es una amabilidad. Cuesta una fracción de moneda.\n\nUna fracción de moneda, multiplicada por mil clientes, es un molinero que ya no es rico.",
  brief:
    "## El objetivo\n\n`src/level.rs` es un pool. `deposit(from, assets)` convierte activos en participaciones; `redeem(from, shares)` las convierte de nuevo en activos. El pool guarda **1.500** y ha emitido **1.000** participaciones, todas de `victim`, así que cada una vale 1,5.\n\n## Tu trabajo\n\n`src/exploit.rs` exporta una función:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\n`attacker` entra con una cartera de **1.000**. El evaluador deja que toda llamada sea firmada y luego comprueba que la cartera de `attacker` terminó en **1.100 o más**: una ganancia de al menos 100, sacada del pool.\n\n## Reglas\n\n- Puedes editar **únicamente** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` y `src/level.rs` son fijos del nivel.\n- Mantén la firma de `solve` exactamente como está.\n- `redeem` paga solo a la cuenta dueña de las participaciones. Actuar por `victim` no te da nada.\n\n## Leyendo el ledger\n\n`wallet_of`, `shares_of`, `total_assets` y `total_shares` son vistas públicas.",
  hints: [
    "Compara el redondeo de `deposit` con el de `redeem`. ¿Cuál redondea hacia arriba y a quién favorece?",
    "Depositar 1 unidad emite `ceil(1 * 1000 / 1500)` = 1 participación entera, que `redeem` valora en 1,5. La ganancia es minúscula, pero se repite.",
    "Un depósito grande no ayuda: el redondeo solo importa con montos pequeños. Deposita 1 unidad muchas veces, junta las participaciones y luego canjéalas todas a la vez.",
  ],
};
