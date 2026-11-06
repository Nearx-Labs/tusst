import type { CtfTextOverlay } from "../localize";

// pt-BR translation of level 06. Code identifiers, the fixed files and the
// markdown structure must stay identical to the English source.
export const forgottenLedgerText: CtfTextOverlay = {
  title: "O Livro-Razão Esquecido",
  tagline:
    "Um selo único que expira em silêncio enquanto o contrato fica parado.",
  story:
    "O Arquivo de São Stroop foi lacrado no dia em que abriu. O selo valia por um dia. Ninguém o renovou, porque ninguém lembrou que ele podia acabar.\n\nO arquivo parece exatamente o mesmo. O selo simplesmente sumiu.",
  brief:
    "## O alvo\n\n`src/level.rs` é um arquivo. `initialize` nomeia o admin e se recusa a rodar uma segunda vez. Ele lembra que já rodou numa entrada de storage **temporary**; o admin fica em storage **persistent**.\n\n## Sua tarefa\n\n`src/exploit.rs` exporta uma função:\n\n```rust\npub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)\n```\n\nO avaliador implanta o arquivo, o inicializa com `victim` como admin e remove todos os mocks de autorização. Um segundo `initialize` é recusado hoje. Faça o `attacker` virar o admin mesmo assim.\n\n## Regras\n\n- Você pode editar **apenas** `src/exploit.rs`. `Cargo.toml`, `src/lib.rs` e `src/level.rs` são fixos do nível.\n- Mantenha a assinatura de `solve` exatamente como está.\n- `attacker` não tem nenhuma assinatura. Numa rede real você não consegue mover o relógio; só pode esperar. O ambiente de teste deixa o `solve` fazer a espera.\n\n## Lendo o estado\n\n`admin()` é uma view pública. Use-a para conferir quem tem as chaves.",
  hints: [
    "Liste onde cada valor é guardado e por quanto tempo. Em qual entrada `initialize` se apoia para recusar uma segunda chamada, e algo chega a estendê-la?",
    "O selo é uma entrada temporária com TTL de cerca de 17.280 ledgers. O admin, em storage persistente, dura muito mais. Depois que o selo expira, `has(&DataKey::Sealed)` volta a ser falso.",
    "Deixe o tempo passar dentro do teste: `env.ledger().with_mut(|l| l.sequence_number += ...)` (importe `soroban_sdk::testutils::Ledger`). Depois chame `initialize` com `attacker`.",
  ],
};
