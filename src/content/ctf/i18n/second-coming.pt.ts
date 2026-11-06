import type { CtfTextOverlay } from "../localize";

// pt-BR translation of level 02. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const secondComingText: CtfTextOverlay = {
  title: "A Segunda Vinda",
  tagline:
    "Um inicializador que qualquer um pode executar de novo, muito depois de o dono se mudar.",
  story:
    "O Registro de São Stroop foi implantado, inicializado e esquecido. O dono assinou a escritura no primeiro dia e nunca mais olhou para ela.\n\nO Stroopbeholder leu a assinatura do dono mil vezes. Ninguém jamais perguntou se a escritura podia ser assinada duas vezes.",
  brief:
    "## O alvo\n\n`src/level.rs` é um registro minúsculo. `transfer_admin` troca o admin e exige a assinatura do admin atual. `initialize` é como o primeiro admin é nomeado.\n\n## Sua tarefa\n\n`src/exploit.rs` exporta uma função:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nO avaliador implanta um registro novo, o inicializa com `victim` como admin, remove todos os mocks de autorização e então chama seu `solve`. Faça o `attacker` virar o admin.\n\n## Regras\n\n- Você pode editar **apenas** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` e `src/level.rs` são fixos do nível.\n- Mantenha a assinatura de `solve` exatamente como está.\n- `attacker` não tem nenhuma assinatura. Qualquer coisa que exija `require_auth` vai falhar.\n\n## Lendo o estado\n\n`admin()` é uma view pública. Use-a para conferir quem tem as chaves.",
  hints: [
    "Leia as duas funções que escrevem `DataKey::Admin`. Uma delas verifica algo antes de escrever. A outra não.",
    "`initialize` não tem `require_auth` nem verificação de \"já inicializado\". Nada impede uma segunda chamada.",
    "Você não precisa de assinatura. Chame `initialize` você mesmo, com `attacker` como novo admin.",
  ],
};
