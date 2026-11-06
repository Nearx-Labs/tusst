import type { CtfTextOverlay } from "../localize";

// pt-BR translation of level 04. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const negativeSpaceText: CtfTextOverlay = {
  title: "Espaço Negativo",
  tagline:
    "Uma transferência que confere se o remetente pode pagar — e nunca se o valor é real.",
  story:
    "O Cofre de São Stroop mantém livros honestos. Toda transferência é conferida: o remetente tem o suficiente? Se sim, os números se movem.\n\nO escriturário que escreveu a verificação nunca imaginou um cliente pedindo para enviar menos que nada. Raven, empoleirado no balcão, imaginou, e desde então não para de grasnar sobre isso.",
  brief:
    "## O alvo\n\n`src/level.rs` é um livro-razão. `transfer(from, to, amount)` exige a assinatura de `from`, confere se `from` pode pagar `amount` e então move o valor.\n\n## Sua tarefa\n\n`src/exploit.rs` exporta uma função:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nO cofre guarda **1.000** para `victim` e nada para `attacker`. O avaliador deixa toda chamada ser assinada e então confere o estado final: `victim` deve **ainda** ter 1.000, e `attacker` deve ter **pelo menos 1.000**.\n\n## Regras\n\n- Você pode editar **apenas** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` e `src/level.rs` são fixos do nível.\n- Mantenha a assinatura de `solve` exatamente como está.\n- Pegar as moedas da vítima a deixa mais pobre, então não conta. Outra pessoa precisa pagar.\n\n## Lendo o ledger\n\n`balance_of(who)` é uma view pública. Qualquer endereço pode ter saldo, inclusive o do próprio cofre.",
  hints: [
    "Veja o que `transfer` confere sobre `amount`. Ele confere se o remetente pode pagar. Confere se `amount` é positivo?",
    "Com um `amount` negativo, `from_balance - amount` cresce e `to_balance + amount` diminui. A transferência corre ao contrário.",
    "Você assina como `attacker`, então `attacker` pode ser `from`. Escolha qualquer endereço que não seja a vítima como `to`, até o do próprio cofre, e envie `-1_000`.",
  ],
};
