import type { CtfTextOverlay } from "../localize";

// pt-BR translation of level 03. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const borrowedBadgeText: CtfTextOverlay = {
  title: "O Crachá Emprestado",
  tagline:
    "Um cofre que confere se o crachá está assinado — e nunca de quem é o crachá.",
  story:
    "O cobrador de pedágio de São Stroop confere todos os crachás no balcão. Está carimbado? A assinatura é recente? Diligência admirável.\n\nEle nunca perguntou se o nome no crachá é o nome do contrato.",
  brief:
    "## O alvo\n\n`src/level.rs` é um cofre de taxas. Na implantação ele guarda um admin e uma pilha de taxas. `withdraw_fees(admin)` paga as taxas a quem for nomeado como `admin`.\n\n## Sua tarefa\n\n`src/exploit.rs` exporta uma função:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nO cofre guarda **1.000** em taxas para `victim`, seu admin. O avaliador deixa `attacker` assinar **exatamente uma chamada**: `withdraw_fees(attacker)`. Ninguém mais pode assinar. Faça o `attacker` sair com as taxas.\n\n## Regras\n\n- Você pode editar **apenas** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` e `src/level.rs` são fixos do nível.\n- Mantenha a assinatura de `solve` exatamente como está.\n- Nomear `victim` como admin exige a assinatura de `victim`, que você não tem.\n\n## Lendo o ledger\n\n`fees()` e `balance_of(who)` são views públicas. Use-as para conferir o resultado.",
  hints: [
    "`withdraw_fees` recebe `admin` como argumento. Onde o contrato compara esse argumento com o admin guardado em `DataKey::Admin`?",
    "`admin.require_auth()` prova que quem foi nomeado assinou. Não diz nada sobre o endereço nomeado ser o admin de verdade.",
    "Você pode assinar por `attacker`. Nomeie `attacker` como admin: `withdraw_fees(&attacker)`.",
  ],
};
