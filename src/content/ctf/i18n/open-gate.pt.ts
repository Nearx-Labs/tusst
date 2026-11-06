import type { CtfTextOverlay } from "../localize";

// pt-BR translation of level 01. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const openGateText: CtfTextOverlay = {
  title: "O Portão Aberto",
  tagline:
    "Um cofre que pede a assinatura de quem deposita — e depois deixa qualquer um gastar o depósito.",
  story:
    "O Portão de São Stroop resiste há cem ledgers. Seu guardião dorme, o cofre está cheio, e a única coisa entre os moradores e suas economias é uma linha de Rust que nunca foi escrita.\n\nVocê é o auditor que o guardião nunca contratou.",
  brief:
    "## O alvo\n\n`src/level.rs` é um cofre pequeno. `deposit` pede uma assinatura a quem deposita. `withdraw` move fundos entre duas contas — e não pede nada.\n\n## Sua tarefa\n\n`src/exploit.rs` exporta uma função:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nO avaliador implanta um cofre novo, financia `victim` com **1.000**, remove todos os mocks de autorização e então chama seu `solve`. Faça o `attacker` sair com o saldo da vítima.\n\n## Regras\n\n- Você pode editar **apenas** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` e `src/level.rs` são fixos do nível.\n- Mantenha a assinatura de `solve` exatamente como está.\n- O teste oculto roda na mesma sandbox da Forja: sem rede, sem chaves, sem acesso ao sistema de arquivos do host.\n\n## Lendo o ledger\n\n`balance_of(who)` é uma view pública. Use-a para descobrir quanto há antes de mover.",
  hints: [
    "Compare `deposit` e `withdraw` linha por linha. Qual delas chama `require_auth`?",
    "`withdraw(from, to, amount)` confia no argumento `from`. O cofre nunca verifica se quem chama é o `from`.",
    "Você não precisa de assinatura. Precisa dos argumentos certos: a vítima como `from`, o atacante como `to` e o saldo da vítima como `amount`.",
  ],
};
