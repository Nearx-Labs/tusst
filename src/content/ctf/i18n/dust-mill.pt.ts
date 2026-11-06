import type { CtfTextOverlay } from "../localize";

// pt-BR translation of level 05. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const dustMillText: CtfTextOverlay = {
  title: "O Moinho de Pó",
  tagline:
    "Um pool que arredonda a favor de quem deposita, uma unidade de cada vez.",
  story:
    "O Moinho de Pó de São Stroop mói depósitos em cotas. O moleiro é generoso: quando os números não dividem exatamente, ele arredonda a favor do cliente. É uma gentileza. Custa uma fração de moeda.\n\nUma fração de moeda, vezes mil clientes, é um moleiro que deixou de ser rico.",
  brief:
    "## O alvo\n\n`src/level.rs` é um pool. `deposit(from, assets)` transforma ativos em cotas; `redeem(from, shares)` transforma cotas de volta em ativos. O pool guarda **1.500** e emitiu **1.000** cotas, todas de `victim`, então cada cota vale 1,5.\n\n## Sua tarefa\n\n`src/exploit.rs` exporta uma função:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\n`attacker` chega com uma carteira de **1.000**. O avaliador deixa toda chamada ser assinada e então confere se a carteira de `attacker` terminou com **1.100 ou mais**: um lucro de pelo menos 100, tirado do pool.\n\n## Regras\n\n- Você pode editar **apenas** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` e `src/level.rs` são fixos do nível.\n- Mantenha a assinatura de `solve` exatamente como está.\n- `redeem` paga apenas a conta dona das cotas. Agir por `victim` não rende nada.\n\n## Lendo o ledger\n\n`wallet_of`, `shares_of`, `total_assets` e `total_shares` são views públicas.",
  hints: [
    "Compare o arredondamento de `deposit` com o de `redeem`. Qual arredonda para cima, e quem isso favorece?",
    "Depositar 1 unidade gera `ceil(1 * 1000 / 1500)` = 1 cota inteira, que `redeem` avalia em 1,5. O ganho é minúsculo, mas se repete.",
    "Um depósito grande não ajuda: o arredondamento só importa em valores pequenos. Deposite 1 unidade muitas vezes, junte as cotas e depois resgate todas de uma vez.",
  ],
};
