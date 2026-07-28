DNS misconfigurations on OPPO infrastructure: RFC1918 internal IPs and 127.0.0.1 published in public DNS

Assets:
  Finding 1 — webexexpe.oppo.com, expe1.oppo.com (subdomains of oppo.com)
  Finding 2 — safe.heytap.com (in scope per HackerOne program — Critical eligible)
  All records served by the authoritative nameservers ns3.dnsv5.com and ns4.dnsv5.com (DNSPod / Tencent Cloud)

Weakness: CWE-200 (Information Disclosure), specifically CWE-668 (Exposure of Resource to Wrong Sphere) via DNS misconfiguration. Adjacent: BCP 5 / RFC 1918 §3 ("If an enterprise uses the private address space, ... it is strongly recommended that DNS data not be propagated outside the enterprise to avoid leaking internal addresses.") and CWE-441 (Unintended Proxy or Intermediary, "Confused Deputy") for the loopback case.

Severity:
  Finding 1: Low (CVSS 3.1 AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N = 5.3, Medium by CVSS but typically scored Low for pure information disclosure with no direct impact).
  Finding 2: Low to Critical depending on whether any first-party HeyTap product treats safe.heytap.com as an authoritative endpoint (see "Remaining unknown" below). Filing as Low for triage and noting the path to escalate severity.


Finding 1 — Internal RFC1918 IP addresses published in public DNS

Two subdomains under oppo.com publish A records that resolve to RFC1918 private-network IP addresses, queryable by anyone over the public internet. This leaks OPPO's internal subnet structure to external parties:

- webexexpe.oppo.com  →  172.16.103.195  (RFC1918 172.16.0.0/12)
- expe1.oppo.com      →  172.16.58.102   (RFC1918 172.16.0.0/12)

Both records are returned consistently by every major public resolver (Google 8.8.8.8, Cloudflare 1.1.1.1, Quad9 9.9.9.9, OpenDNS 208.67.222.222), confirming the records live in OPPO's authoritative DNS rather than being a per-resolver artifact.

Reproduction:

```
$ dig @8.8.8.8 webexexpe.oppo.com +short
172.16.103.195

$ dig @1.1.1.1 webexexpe.oppo.com +short
172.16.103.195

$ dig @9.9.9.9 webexexpe.oppo.com +short
172.16.103.195

$ dig @208.67.222.222 webexexpe.oppo.com +short
172.16.103.195

$ dig @8.8.8.8 expe1.oppo.com +short
172.16.58.102

$ dig @1.1.1.1 expe1.oppo.com +short
172.16.58.102

$ dig @8.8.8.8 oppo.com NS +short
ns3.dnsv5.com.
ns4.dnsv5.com.
```

The authoritative nameservers (ns3.dnsv5.com / ns4.dnsv5.com — DNSPod / Tencent Cloud) serve these records, so the leak is in OPPO's primary DNS configuration, not in any individual resolver's cache.


Finding 2 — safe.heytap.com publishes a 127.0.0.1 (loopback) A record in public DNS

safe.heytap.com is listed as an in-scope asset on the OPPO HackerOne program (Critical eligible). It currently resolves to 127.0.0.1 on every major public DNS resolver:

- safe.heytap.com  →  127.0.0.1  (IPv4 loopback)

Reproduction:

```
$ dig @8.8.8.8 safe.heytap.com +short
127.0.0.1

$ dig @1.1.1.1 safe.heytap.com +short
127.0.0.1

$ dig @9.9.9.9 safe.heytap.com +short
127.0.0.1

$ dig @8.8.8.8 safe.heytap.com +noall +answer
safe.heytap.com.    600    IN    A    127.0.0.1
```

The Wayback Machine shows safe.heytap.com served real HTML content from at least 2020 through October 2022, redirecting "/" to "/webapp/" — that is, this hostname previously hosted a real webapp. At some point afterward, the public A record was changed to 127.0.0.1.

The risk model for any in-scope hostname that publicly resolves to loopback is:

If any first-party HeyTap or OPPO client product still hardcodes safe.heytap.com as an endpoint and acts on the response, then anyone who can run a service on a victim's localhost (a malicious app, a development server, or a compromised local process) can serve responses to that HeyTap product as if those responses came from OPPO's infrastructure. Depending on what the endpoint is used for, the impact ranges from minor configuration leak through to credentialed-trust bypass, depending on what the consuming app does with the data.

I performed a static-grep audit of five in-scope HeyTap/OPPO Android packages to look for hardcoded references to safe.heytap.com:

- com.heytap.browser (HeyTap Browser, v45.14.0.1) — no hits across 19 DEX files, all assets, all native libs, all resources
- com.coloros.findmyphone (v9.5.1) — no hits
- com.heytap.cloud (v10.10.5) — no hits
- com.oplus.account (v9.17.18) — no hits
- com.finshell.wallet (v5.24.1) — no hits

The negative result rules out static-string references in those five packages. It does not rule out (a) other in-scope packages I did not analyze, (b) endpoints loaded indirectly via the HeyTap "nearx" remote configuration service (which delivers endpoint URLs at runtime and would be invisible to static grep), (c) ColorOS system components not distributed as standalone APKs, (d) HeyTap or OPPO desktop / browser-extension products. Any of those could still hardcode the hostname.

Recommendations to OPPO triage:

1. Confirm whether the 127.0.0.1 record is intentional (sinkhole for a deprecated service) or a misconfiguration. If accidental, repoint or remove the record.
2. If intentional, audit the OPPO/HeyTap nearx / remote-config service for any feature flag or downstream endpoint that names safe.heytap.com. If any such reference exists in production config, ship a config update that removes it.
3. Either way, consider returning NXDOMAIN for the hostname rather than 127.0.0.1 — the loopback record is materially riskier than no record at all.


Combined Impact

Finding 1 is a defense-in-depth weakness: it leaks topology data that aids an attacker who has already gained a foothold elsewhere. Standalone severity is Low.

Finding 2 is also Low at minimum (publishing loopback on a Critical-tier asset is a misconfiguration in itself), and rises to substantially higher severity if any consumer product treats the host as authoritative — that case is Critical-tier per OPPO's stated bounty bands for safe.heytap.com. Confirming or refuting that question is largely an internal exercise for OPPO (audit the nearx config and any remaining client-app references). I am filing as Low and noting the unknown so triage can verify on its side.

Both findings share the same root cause class — OPPO's public authoritative DNS publishes records that should not be reachable from the public internet — and would likely be addressed together by a DNS hygiene audit on the oppo.com and heytap.com zones.


Recommendation

For Finding 1:
1. Audit the oppo.com zone on DNSPod for any other A records pointing into private RFC1918 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) or into reserved ranges (169.254.0.0/16, 0.0.0.0/8, 100.64.0.0/10). A simple zone export and grep for the relevant prefixes finds them.
2. For each leaked record, either delete it from the public zone, move it to an internal DNS server reachable only from inside OPPO's corporate network, or repoint to a public-routable IP if the service is intended to be externally reachable.
3. As a long-term control, configure DNSPod to reject A records pointing to private/reserved address space, or run a periodic zone audit (open-source tooling like dnsx + grep-cidr makes this a one-line cron job).

For Finding 2:
1. Confirm whether the 127.0.0.1 record is intentional. If not, either repoint it or change the response to NXDOMAIN.
2. Audit the nearx remote configuration store for any reference to safe.heytap.com.
3. If safe.heytap.com is genuinely deprecated, consider also revoking any wildcard or hostname-specific certs that still cover it (visible in CT logs), to reduce the surface for a future attacker who controls the CA flow.


Other observations during this investigation (informational, no action requested)

Enumerating subdomains of oppo.com / heytap.com / myoppo.com / oppoit.com via certificate transparency logs and resolving each surfaced 27 hostnames that have prior CT certs but currently return NXDOMAIN — i.e., decommissioned services with stale public cert history. None of these are exploitable as-is (NXDOMAIN means no current target). Listed below in case any are unexpected and warrant cleanup of stale certs:

```
account.oppo.com, www.account.oppo.com, andes.oppo.com, bbspre.oppo.com,
brandhub.myoppo.com, d.theme.exapi.oppo.com, en.oppo.com, mx.oppo.com,
www.mx.oppo.com, mail9988.oppo.com, mmevents-hd.oppo.com, myevents-hd.oppo.com,
ruevents-hd.oppo.com, gkm-s3cdn-sg.oppo.com, oldcms.oppo.com (resolves but
nginx returns "domain is not configured"), olearning-sgp-replay.myoppo.com,
os-rmstest.myoppo.com, payment.heytap.com, rmsdev.myoppo.com, rmstest.myoppo.com,
rmspre.myoppo.com, seebeyond.oppo.com, sgtm-in.oppo.com, sgtm-sgp.oppo.com,
www.expe1.oppo.com, htsg-storeapi-sg.heytap.com, htsg-payapi-sg.heytap.com,
rydeen-qpon-gl.heytap.com, aem.heytap.com
```

Some appear to be former production hosts (account.oppo.com, payment.heytap.com); confirming they should remain offline is a useful hygiene check.
