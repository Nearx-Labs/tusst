import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_TRUSTED_PROXY_HOPS,
  SHARED_ANON_KEY,
  clientIpConfigFromEnv,
  clientKeyFromHeaders,
  normalizeClientIp,
  parseTrustedProxyHops,
  type ClientIpConfig,
} from "./client-ip";

const vps = (trustedProxyHops: number): ClientIpConfig => ({ onVercel: false, trustedProxyHops });
const vercel = (trustedProxyHops = 0): ClientIpConfig => ({ onVercel: true, trustedProxyHops });

function headers(entries: Array<[string, string]>): Headers {
  const h = new Headers();
  for (const [name, value] of entries) h.append(name, value);
  return h;
}

const xff = (value: string) => headers([["x-forwarded-for", value]]);

describe("parseTrustedProxyHops", () => {
  it("defaults to 0 when absent or empty", () => {
    assert.equal(parseTrustedProxyHops(undefined), 0);
    assert.equal(parseTrustedProxyHops(""), 0);
    assert.equal(parseTrustedProxyHops("   "), 0);
  });

  it("rejects non-integer, negative and non-decimal values", () => {
    for (const raw of ["abc", "-1", "1.5", "+1", "1e0", "0x1", "1 2", "Infinity", "NaN"]) {
      assert.equal(parseTrustedProxyHops(raw), 0, raw);
    }
  });

  it("accepts integers within the ceiling", () => {
    assert.equal(parseTrustedProxyHops("0"), 0);
    assert.equal(parseTrustedProxyHops("1"), 1);
    assert.equal(parseTrustedProxyHops(" 2 "), 2);
    assert.equal(parseTrustedProxyHops(String(MAX_TRUSTED_PROXY_HOPS)), MAX_TRUSTED_PROXY_HOPS);
  });

  it("treats values above the ceiling as 0", () => {
    assert.equal(parseTrustedProxyHops(String(MAX_TRUSTED_PROXY_HOPS + 1)), 0);
    assert.equal(parseTrustedProxyHops("99999999999999999999"), 0);
  });

  it("builds the config from env", () => {
    assert.deepEqual(clientIpConfigFromEnv({}), { onVercel: false, trustedProxyHops: 0 });
    assert.deepEqual(clientIpConfigFromEnv({ TRUSTED_PROXY_HOPS: "1" }), {
      onVercel: false,
      trustedProxyHops: 1,
    });
    assert.deepEqual(clientIpConfigFromEnv({ VERCEL: "1", TRUSTED_PROXY_HOPS: "abc" }), {
      onVercel: true,
      trustedProxyHops: 0,
    });
    assert.equal(clientIpConfigFromEnv({ VERCEL: "" }).onVercel, false);
  });
});

describe("clientKeyFromHeaders outside Vercel", () => {
  it("ignores forged X-Forwarded-For and X-Real-IP when hops=0", () => {
    const h = headers([
      ["x-forwarded-for", "1.2.3.4"],
      ["x-real-ip", "5.6.7.8"],
    ]);
    assert.equal(clientKeyFromHeaders(h, null, vps(0)), SHARED_ANON_KEY);
    assert.equal(clientKeyFromHeaders(new Headers(), null, vps(0)), SHARED_ANON_KEY);
  });

  it("hops=1 takes the rightmost entry regardless of client-supplied prefixes", () => {
    assert.equal(clientKeyFromHeaders(xff("203.0.113.7"), null, vps(1)), "ip:203.0.113.7");
    assert.equal(clientKeyFromHeaders(xff("1.1.1.1, 203.0.113.7"), null, vps(1)), "ip:203.0.113.7");
    assert.equal(
      clientKeyFromHeaders(xff("9.9.9.9, 8.8.8.8, 1.1.1.1, 203.0.113.7"), null, vps(1)),
      "ip:203.0.113.7",
    );
  });

  it("hops=2 takes the second entry from the right", () => {
    assert.equal(
      clientKeyFromHeaders(xff("203.0.113.7, 10.0.0.2"), null, vps(2)),
      "ip:203.0.113.7",
    );
    assert.equal(
      clientKeyFromHeaders(xff("6.6.6.6, 7.7.7.7, 203.0.113.7, 10.0.0.2"), null, vps(2)),
      "ip:203.0.113.7",
    );
  });

  it("joins multiple X-Forwarded-For headers before counting from the right", () => {
    const h = headers([
      ["x-forwarded-for", "6.6.6.6, 7.7.7.7"],
      ["x-forwarded-for", "203.0.113.7"],
    ]);
    assert.equal(clientKeyFromHeaders(h, null, vps(1)), "ip:203.0.113.7");
    assert.equal(clientKeyFromHeaders(h, null, vps(2)), "ip:7.7.7.7");
  });

  it("falls back to the shared bucket when XFF has fewer entries than hops", () => {
    assert.equal(clientKeyFromHeaders(xff("203.0.113.7"), null, vps(2)), SHARED_ANON_KEY);
    assert.equal(clientKeyFromHeaders(new Headers(), null, vps(1)), SHARED_ANON_KEY);
  });

  it("never falls back to X-Real-IP when hops>0", () => {
    const h = headers([["x-real-ip", "5.6.7.8"]]);
    assert.equal(clientKeyFromHeaders(h, null, vps(1)), SHARED_ANON_KEY);
  });

  it("sends an invalid trusted entry to the shared bucket instead of moving left", () => {
    assert.equal(clientKeyFromHeaders(xff("203.0.113.7, garbage"), null, vps(1)), SHARED_ANON_KEY);
    assert.equal(clientKeyFromHeaders(xff("203.0.113.7, "), null, vps(1)), SHARED_ANON_KEY);
  });

  it("refuses out-of-range hops handed in directly", () => {
    for (const hops of [-1, 1.5, MAX_TRUSTED_PROXY_HOPS + 1, Number.NaN]) {
      assert.equal(clientKeyFromHeaders(xff("1.1.1.1, 2.2.2.2"), null, vps(hops)), SHARED_ANON_KEY);
    }
  });
});

describe("clientKeyFromHeaders on Vercel", () => {
  it("uses x-vercel-forwarded-for and ignores X-Forwarded-For and TRUSTED_PROXY_HOPS", () => {
    const h = headers([
      ["x-vercel-forwarded-for", "203.0.113.7"],
      ["x-forwarded-for", "1.2.3.4, 5.6.7.8"],
      ["x-real-ip", "9.9.9.9"],
    ]);
    assert.equal(clientKeyFromHeaders(h, null, vercel(0)), "ip:203.0.113.7");
    assert.equal(clientKeyFromHeaders(h, null, vercel(2)), "ip:203.0.113.7");
  });

  it("falls back to x-real-ip when the platform header is missing", () => {
    const h = headers([
      ["x-real-ip", "203.0.113.9"],
      ["x-forwarded-for", "1.2.3.4"],
    ]);
    assert.equal(clientKeyFromHeaders(h, null, vercel()), "ip:203.0.113.9");
  });

  it("uses the shared bucket when no platform header is present", () => {
    assert.equal(clientKeyFromHeaders(xff("1.2.3.4"), null, vercel(1)), SHARED_ANON_KEY);
  });

  it("takes the rightmost entry if the platform header is ever a list", () => {
    const h = headers([["x-vercel-forwarded-for", "6.6.6.6, 203.0.113.7"]]);
    assert.equal(clientKeyFromHeaders(h, null, vercel()), "ip:203.0.113.7");
  });

  it("sends an invalid platform header to the shared bucket", () => {
    const h = headers([
      ["x-vercel-forwarded-for", "unknown"],
      ["x-real-ip", "203.0.113.9"],
    ]);
    assert.equal(clientKeyFromHeaders(h, null, vercel()), SHARED_ANON_KEY);
  });
});

describe("normalizeClientIp", () => {
  it("keeps valid IPv4 as-is", () => {
    assert.equal(normalizeClientIp("203.0.113.7"), "203.0.113.7");
    assert.equal(normalizeClientIp("  203.0.113.7  "), "203.0.113.7");
  });

  it("strips ports", () => {
    assert.equal(normalizeClientIp("203.0.113.7:5678"), "203.0.113.7");
    assert.equal(normalizeClientIp("[::1]:443"), "::/64");
    assert.equal(normalizeClientIp("[2001:db8::1]"), "2001:db8::/64");
    assert.equal(normalizeClientIp("[2001:db8::1]:8080"), "2001:db8::/64");
  });

  it("unwraps IPv4-mapped IPv6", () => {
    assert.equal(normalizeClientIp("::ffff:203.0.113.7"), "203.0.113.7");
    assert.equal(normalizeClientIp("::FFFF:203.0.113.7"), "203.0.113.7");
    assert.equal(normalizeClientIp("::ffff:cb00:7107"), "203.0.113.7");
    assert.equal(normalizeClientIp("0:0:0:0:0:ffff:203.0.113.7"), "203.0.113.7");
    assert.equal(normalizeClientIp("[::ffff:203.0.113.7]:443"), "203.0.113.7");
  });

  it("normalizes IPv6 to a canonical /64", () => {
    assert.equal(normalizeClientIp("2001:db8:abcd:12::1"), "2001:db8:abcd:12::/64");
    assert.equal(normalizeClientIp("2001:db8::"), "2001:db8::/64");
    assert.equal(normalizeClientIp("fe80::1%eth0"), "fe80::/64");
    assert.equal(normalizeClientIp("1:0:0:1:0:0:0:1"), "1:0:0:1::/64");
  });

  it("rejects garbage", () => {
    for (const raw of [
      "",
      "   ",
      "unknown",
      "999.1.1.1",
      "999.1.1.1:80",
      "01.2.3.4",
      "1.2.3",
      "localhost",
      "1.2.3.4, 5.6.7.8",
      "1::2::3",
      "[1.2.3.4]",
      "<script>",
      null,
      undefined,
    ]) {
      assert.equal(normalizeClientIp(raw), null, String(raw));
    }
  });
});

describe("clientKeyFromHeaders IPv6 bucketing", () => {
  const key = (ip: string) => clientKeyFromHeaders(xff(ip), null, vps(1));

  it("gives different spellings of the same /64 the same key", () => {
    const expected = "ip:2001:db8:abcd:12::/64";
    assert.equal(key("2001:db8:abcd:12::1"), expected);
    assert.equal(key("2001:0DB8:ABCD:0012:ffff:ffff:ffff:ffff"), expected);
    assert.equal(key("2001:db8:abcd:12:0:0:0:2"), expected);
    assert.equal(key("[2001:db8:abcd:12::99]:443"), expected);
  });

  it("gives different /64 prefixes different keys", () => {
    assert.notEqual(key("2001:db8:abcd:12::1"), key("2001:db8:abcd:13::1"));
    assert.notEqual(key("2001:db8:abcd:12::1"), key("2001:db9:abcd:12::1"));
  });

  it("maps IPv4-mapped IPv6 onto the IPv4 key", () => {
    assert.equal(key("::ffff:203.0.113.7"), key("203.0.113.7"));
  });
});

describe("clientKeyFromHeaders user precedence", () => {
  it("keys signed-in users by id regardless of headers or config", () => {
    const h = headers([
      ["x-forwarded-for", "1.2.3.4, 203.0.113.7"],
      ["x-vercel-forwarded-for", "203.0.113.8"],
    ]);
    assert.equal(clientKeyFromHeaders(h, "u_123", vps(0)), "user:u_123");
    assert.equal(clientKeyFromHeaders(h, "u_123", vps(1)), "user:u_123");
    assert.equal(clientKeyFromHeaders(h, "u_123", vercel()), "user:u_123");
  });

  it("treats an empty user id as anonymous", () => {
    assert.equal(clientKeyFromHeaders(xff("203.0.113.7"), "", vps(1)), "ip:203.0.113.7");
  });
});
