import type { CtfTextOverlay } from "../localize";

// es translation of level 02. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const secondComingText: CtfTextOverlay = {
  title: "La Segunda Venida",
  tagline:
    "Un inicializador que cualquiera puede ejecutar de nuevo, mucho después de que el dueño se mudó.",
  story:
    "El Registro de San Stroop fue desplegado, inicializado y olvidado. Su dueño firmó la escritura el primer día y no volvió a mirarla.\n\nEl Stroopbeholder leyó la firma del dueño mil veces. Nadie preguntó nunca si la escritura podía firmarse dos veces.",
  brief:
    "## El objetivo\n\n`src/level.rs` es un registro diminuto. `transfer_admin` cambia el admin y exige la firma del admin actual. `initialize` es como se nombra al primer admin.\n\n## Tu trabajo\n\n`src/exploit.rs` exporta una función:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nEl evaluador despliega un registro nuevo, lo inicializa con `victim` como admin, elimina todos los mocks de autorización y luego llama a tu `solve`. Haz que `attacker` sea el admin.\n\n## Reglas\n\n- Puedes editar **únicamente** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` y `src/level.rs` son fijos del nivel.\n- Mantén la firma de `solve` exactamente como está.\n- `attacker` no tiene ninguna firma. Cualquier cosa que requiera `require_auth` fallará.\n\n## Leyendo el estado\n\n`admin()` es una vista pública. Úsala para comprobar quién tiene las llaves.",
  hints: [
    "Lee las dos funciones que escriben `DataKey::Admin`. Una verifica algo antes de escribir. La otra no.",
    "`initialize` no tiene `require_auth` ni verificación de «ya inicializado». Nada impide una segunda llamada.",
    "No necesitas firma. Llama tú mismo a `initialize`, con `attacker` como nuevo admin.",
  ],
};
