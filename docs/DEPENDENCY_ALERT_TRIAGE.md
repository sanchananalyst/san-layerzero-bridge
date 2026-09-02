# Dependency Alert Triage

## Snapshot and conclusion

Read-only GitHub GraphQL inspection on 2026-09-03 returned **99 open alerts**:
1 critical, 41 high, 47 moderate, and 10 low. GitHub's REST Dependabot list was
not available to this token (404), while vulnerability-alert access and GraphQL
were available. The 99 GraphQL records are represented below; repeated GHSA IDs
are separate vulnerable-version records.

No dependency was upgraded in Phase 5A.3. No alert reaches a new arbitrary SAN
mint, escrow release, pause bypass, peer bypass, or deployed EVM runtime. The
production `SanOFT` import is OpenZeppelin `5.6.1`; vulnerable OpenZeppelin 3.x/
4.x copies are transitive Chainlink/LayerZero tooling or library-source trees
and are not selected by the production artifact. NPM alerts are off-chain
build/test/governance/checker dependencies. Two low Rust alerts enter the
Solana dependency graph, but their vulnerable functions/features are not used
by the SBF program. Blind transitive upgrades could change audited bytecode and
are deferred to a separately reviewed dependency-update branch.

## Complete grouped alert ledger

| Package                               |          Severity / records | GHSA records                                                                                                                                                                                                                                                                                                                                                                                                                               | Reachability and decision                                                                                                                                                                                                                                                        |
| ------------------------------------- | --------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@openzeppelin/contracts`             |          HIGH 6; MODERATE 6 | 88g8-f5mf-f5rj, qh9x-gcfh-pcrw, 4g63-c64m-25w9, xrc4-737v-9q75, 4h98-2769-gh6h, 93hq-5wgc-jc82; 9c22-pwxw-p6hx, m6w8-fq7v-ph4m, 7grf-83vw-6f5x, mx2q-35m2-x2rh, 5h3x-9wvq-w4m2, g4vp-m682-qqmp                                                                                                                                                                                                                                             | Vulnerable 3.4.2/4.3.3 are transitive source/tooling; production import resolves 5.6.1. Not runtime reachable.                                                                                                                                                                   |
| `@openzeppelin/contracts-upgradeable` |          HIGH 1; MODERATE 5 | 93hq-5wgc-jc82; mx2q-35m2-x2rh, 5h3x-9wvq-w4m2, wprv-93r4-jj2p, g4vp-m682-qqmp, 9vx6-7xxf-x967                                                                                                                                                                                                                                                                                                                                             | Vulnerable 4.7.3 is transitive Chainlink tooling; 5.6.1 is current. SanOFT is non-proxy.                                                                                                                                                                                         |
| `adm-zip`                             |                      HIGH 1 | xcpc-8h2w-3j85                                                                                                                                                                                                                                                                                                                                                                                                                             | 0.4.16 in Hardhat/LayerZero tooling; crafted archive DoS, no deployed runtime. Defer.                                                                                                                                                                                            |
| `axios`                               | HIGH 17; MODERATE 19; LOW 2 | jr5f-v2jv-69x6, 43fc-jf86-j433, q8qp-cvcw-x6jj, pmwg-cvhr-8vh7 (2), 6chq-wfr3-2hj9 (2), pf86-5x62-jrwf (2), pjwm-pj3p-43mv, 35jp-ww65-95wh, 3g43-6gmg-66jw (2), j5f8-grm9-p9fc (2), p92q-9vqr-4j8v (2); wf5p-g6vw-rhxx, fvcv-3m26-pcqx (2), 3p68-rc4w-qgx5 (2), 3w6x-2g7m-8v23, w9j2-pvgh-6h63 (2), xx6v-rp6x-q39c (2), m7pr-hjqh-92cm (2), 445q-vr5w-6q77, 898c-q2cr-xwhg (2), mmx7-hfxf-jppx (2), 7q8q-rj6j-mhjq (2); xhjh-pmcv-23jw (2) | 0.21.4/1.13.6 are transitive deployment/devtools; 1.20.0 also present. Risks concern attacker-controlled URLs/proxy/config/prototypes. Production tooling accepts reviewed RPC/official API URLs only; no deployed runtime. Keep open and isolate network inputs.                |
| `bigint-buffer`                       |                      HIGH 1 | 3gc7-fjrx-p6mg                                                                                                                                                                                                                                                                                                                                                                                                                             | 1.1.5 via Solana/LayerZero/Squads tooling; no fix. Buffer-overflow primitive is relevant to hostile buffer inputs but Phase 5A uses read-only reviewed endpoints and no key/signing path. Open tooling risk; avoid native helper on untrusted buffers.                           |
| `cookie`                              |                       LOW 1 | pxg6-pf52-xh8x                                                                                                                                                                                                                                                                                                                                                                                                                             | Vulnerable 0.4.2 is transitive legacy tooling; 0.7.2 also present. No server/runtime. Defer.                                                                                                                                                                                     |
| `decode-uri-component`                |                  MODERATE 1 | vcc3-ghjq-m6fr                                                                                                                                                                                                                                                                                                                                                                                                                             | 0.2.2 legacy tooling; malformed-input DoS, not deployed runtime. Defer.                                                                                                                                                                                                          |
| `elliptic`                            |                       LOW 1 | 848j-6mx2-7j84                                                                                                                                                                                                                                                                                                                                                                                                                             | 6.6.1 transitive crypto tooling, no fix. No production signer use in Phase 5A. Open tooling risk.                                                                                                                                                                                |
| `form-data`                           |          CRITICAL 1; HIGH 1 | fjxv-7rqg-78g4; hmw2-7cc7-3qxx                                                                                                                                                                                                                                                                                                                                                                                                             | 2.3.3 via deprecated `request`/Safe-web3 tooling; 4.0.6 also present. Boundary entropy/CRLF issues do not reach deployed contracts, but transaction/governance tooling must not process attacker-controlled multipart fields. Open tooling risk; replace legacy path separately. |
| `js-yaml`                             |          HIGH 2; MODERATE 1 | 52cp-r559-cp3m, 5p4m-2wfm-xmqj; h67p-54hq-rp68                                                                                                                                                                                                                                                                                                                                                                                             | 4.1.1 vulnerable; 4.3.2 and 3.15.2 also present. DoS on hostile YAML in build/devtools. Repository-owned config only. Defer.                                                                                                                                                     |
| `lodash`                              |          HIGH 1; MODERATE 1 | r5fr-rjxr-66jc; f23m-r3pf-42rh                                                                                                                                                                                                                                                                                                                                                                                                             | 4.17.23 vulnerable and 4.18.1 present. Tooling-only prototype/template input risk. Defer.                                                                                                                                                                                        |
| `qs`                                  |                  MODERATE 1 | 6rw7-vpxm-498p                                                                                                                                                                                                                                                                                                                                                                                                                             | 6.5.5/6.15.3 vulnerable; 6.16.0 present. Legacy HTTP tooling, no deployed service. Defer.                                                                                                                                                                                        |
| `request`                             |                  MODERATE 1 | p8p7-x288-28g6                                                                                                                                                                                                                                                                                                                                                                                                                             | 2.88.2, no fix; legacy Safe/web3 tooling SSRF surface. No user-controlled URL or deployed runtime. Replace path separately.                                                                                                                                                      |
| `serialize-javascript`                |          HIGH 1; MODERATE 1 | 5c6j-r48x-rmvq; qj8w-gfj5-8c6v                                                                                                                                                                                                                                                                                                                                                                                                             | 6.0.2 in test tooling; hostile-object RCE/DoS, no production runtime. Defer.                                                                                                                                                                                                     |
| `tar`                                 |          HIGH 6; MODERATE 2 | 8qq5-rm4j-mr97, r6q2-hw4h-h46w, 34x7-hfp2-rc4v, 83g3-92jg-28cx, qffp-2rhf-9h96, 9ppj-qmqm-q256; vmf3-w455-68vh, w8wr-v893-vjvp                                                                                                                                                                                                                                                                                                             | 4.4.19 via legacy web3/Swarm tooling. Archive extraction hazards; no deployed runtime. Do not extract untrusted archives; replace legacy path separately.                                                                                                                        |
| `tmp`                                 |               HIGH 1; LOW 1 | ph9p-34f9-6g65; 52f5-9888-hmc6                                                                                                                                                                                                                                                                                                                                                                                                             | 0.0.33 via compiler/test tooling. Host filesystem issue, not bytecode behavior. Build only in isolated clean environment.                                                                                                                                                        |
| `tough-cookie`                        |                  MODERATE 1 | 72xf-g2v4-qvf3                                                                                                                                                                                                                                                                                                                                                                                                                             | 2.5.0 via `request`; tooling-only prototype pollution. Defer with legacy path.                                                                                                                                                                                                   |
| `undici`                              |           MODERATE 6; LOW 2 | 2mjp-6q6p-2qxm, 4992-7rv2-5pvq, p88m-4jfj-68fv, 8xcm-r25x-g524, v3r7-h72x-cjcm, m8rv-5g2x-5cg5; 35p6-xmwp-9g52, g8m3-5g58-fq7m                                                                                                                                                                                                                                                                                                             | 5.29.0 via Hardhat. HTTP parsing/cookie risks in tooling, no deployed runtime. Use reviewed endpoints only; defer.                                                                                                                                                               |
| `uuid`                                |                  MODERATE 1 | w5hq-g745-h8pq                                                                                                                                                                                                                                                                                                                                                                                                                             | Vulnerable 8.3.2 plus 9.0.1/14.0.2 present. Buffer-bounds API is not called by bridge code; tooling only. Defer.                                                                                                                                                                 |
| `web3-core-subscriptions`             |                       LOW 1 | hhf6-3xpg-pggx                                                                                                                                                                                                                                                                                                                                                                                                                             | 1.10.4, no fix, legacy web3 tooling; no deployed subscription service. Replace legacy path separately.                                                                                                                                                                           |
| `ws`                                  |                      HIGH 3 | 3h5v-q93c-6h6q, 96hv-2xvq-fx4p (2)                                                                                                                                                                                                                                                                                                                                                                                                         | Vulnerable 3.3.3 and 8.18.0; 7.5.13, 8.21.0, and fixed 8.21.3 also present. DoS applies to network-facing WebSocket servers/clients; checker uses HTTP RPC and no deployed server. Defer.                                                                                        |
| `yargs-parser`                        |                  MODERATE 1 | p9pc-299p-vxgp                                                                                                                                                                                                                                                                                                                                                                                                                             | 2.4.1 legacy CLI dependency; command-line prototype pollution, no deployed runtime. Defer.                                                                                                                                                                                       |
| Rust `keccak`                         |                       LOW 1 | 3288-p39f-rqpv                                                                                                                                                                                                                                                                                                                                                                                                                             | 0.1.5 reaches the OFT graph through Solana/sha3. Advisory is the opt-in ARMv8 assembly backend; SBF does not enable/run that backend. Updating can change the production ELF. Defer pending reproducible bytecode review.                                                        |
| Rust `rand`                           |                       LOW 1 | cq8v-f236-94qc                                                                                                                                                                                                                                                                                                                                                                                                                             | 0.7.3 reaches `solana-program` through secp256k1. Advisory requires a custom logger and `rand::rng()` interaction not used by the OFT program. Major transitive update can change ELF. Defer pending reproducible bytecode review.                                               |

## Exact open-alert records

This is the complete 99-record GraphQL snapshot, keyed by GitHub alert number.
`Affected` is the exact locked requirement reported for that alert; `fixed` is
the first patched version for the affected release line, or `none`. `Scope` and
`manifest` are GitHub's dependency metadata, not a claim of deployed runtime
reachability. Each record inherits the concrete dependency route, deployed-code
reachability, transaction-tooling exposure, and decision from its package row
above. `cargo tree -i` confirmed the two Rust routes; `pnpm why` confirmed the
NPM routes. In particular, GitHub `RUNTIME` for a lockfile entry does not
override the source/artifact analysis above.

```text
alert package affected fixed scope manifest GHSA
1 keccak =0.1.5 0.1.6 RUNTIME Cargo.lock GHSA-3288-p39f-rqpv
2 rand =0.7.3 0.8.6 RUNTIME Cargo.lock GHSA-cq8v-f236-94qc
3 yargs-parser 2.4.1 5.0.1 DEVELOPMENT pnpm-lock.yaml GHSA-p9pc-299p-vxgp
4 @openzeppelin/contracts 3.4.2 4.4.1 RUNTIME pnpm-lock.yaml GHSA-9c22-pwxw-p6hx
5 @openzeppelin/contracts 4.3.3 4.4.2 DEVELOPMENT pnpm-lock.yaml GHSA-m6w8-fq7v-ph4m
6 @openzeppelin/contracts 3.4.2 4.4.1 RUNTIME pnpm-lock.yaml GHSA-88g8-f5mf-f5rj
7 @openzeppelin/contracts 4.3.3 4.7.1 DEVELOPMENT pnpm-lock.yaml GHSA-qh9x-gcfh-pcrw
8 @openzeppelin/contracts 4.3.3 4.7.1 DEVELOPMENT pnpm-lock.yaml GHSA-4g63-c64m-25w9
9 @openzeppelin/contracts 3.4.2 4.7.2 RUNTIME pnpm-lock.yaml GHSA-7grf-83vw-6f5x
10 @openzeppelin/contracts 4.3.3 4.7.2 DEVELOPMENT pnpm-lock.yaml GHSA-xrc4-737v-9q75
11 @openzeppelin/contracts 4.3.3 4.7.3 DEVELOPMENT pnpm-lock.yaml GHSA-4h98-2769-gh6h
12 request 2.88.2 none DEVELOPMENT pnpm-lock.yaml GHSA-p8p7-x288-28g6
13 @openzeppelin/contracts 3.4.2 4.8.3 RUNTIME pnpm-lock.yaml GHSA-mx2q-35m2-x2rh
14 @openzeppelin/contracts-upgradeable 4.7.3 4.8.3 RUNTIME pnpm-lock.yaml GHSA-mx2q-35m2-x2rh
15 @openzeppelin/contracts 4.3.3 4.8.3 DEVELOPMENT pnpm-lock.yaml GHSA-93hq-5wgc-jc82
16 @openzeppelin/contracts-upgradeable 4.7.3 4.8.3 RUNTIME pnpm-lock.yaml GHSA-93hq-5wgc-jc82
17 @openzeppelin/contracts 4.3.3 4.9.1 DEVELOPMENT pnpm-lock.yaml GHSA-5h3x-9wvq-w4m2
18 @openzeppelin/contracts-upgradeable 4.7.3 4.9.1 RUNTIME pnpm-lock.yaml GHSA-5h3x-9wvq-w4m2
19 @openzeppelin/contracts-upgradeable 4.7.3 4.9.2 RUNTIME pnpm-lock.yaml GHSA-wprv-93r4-jj2p
20 tough-cookie 2.5.0 4.1.3 DEVELOPMENT pnpm-lock.yaml GHSA-72xf-g2v4-qvf3
21 @openzeppelin/contracts 4.3.3 4.9.3 DEVELOPMENT pnpm-lock.yaml GHSA-g4vp-m682-qqmp
22 @openzeppelin/contracts-upgradeable 4.7.3 4.9.3 RUNTIME pnpm-lock.yaml GHSA-g4vp-m682-qqmp
23 axios 0.21.4 0.28.0 DEVELOPMENT pnpm-lock.yaml GHSA-wf5p-g6vw-rhxx
24 @openzeppelin/contracts-upgradeable 4.7.3 4.9.6 RUNTIME pnpm-lock.yaml GHSA-9vx6-7xxf-x967
26 ws 3.3.3 5.2.4 DEVELOPMENT pnpm-lock.yaml GHSA-3h5v-q93c-6h6q
27 cookie 0.4.2 0.7.0 DEVELOPMENT pnpm-lock.yaml GHSA-pxg6-pf52-xh8x
28 axios 0.21.4 0.30.0 DEVELOPMENT pnpm-lock.yaml GHSA-jr5f-v2jv-69x6
29 bigint-buffer 1.1.5 none RUNTIME pnpm-lock.yaml GHSA-3gc7-fjrx-p6mg
30 form-data 2.3.3 2.5.4 DEVELOPMENT pnpm-lock.yaml GHSA-fjxv-7rqg-78g4
31 tmp 0.0.33 0.2.4 DEVELOPMENT pnpm-lock.yaml GHSA-52f5-9888-hmc6
32 web3-core-subscriptions 1.10.4 none DEVELOPMENT pnpm-lock.yaml GHSA-hhf6-3xpg-pggx
33 qs 6.5.5 6.14.1 DEVELOPMENT pnpm-lock.yaml GHSA-6rw7-vpxm-498p
34 elliptic 6.6.1 none DEVELOPMENT pnpm-lock.yaml GHSA-848j-6mx2-7j84
36 tar 4.4.19 7.5.3 DEVELOPMENT pnpm-lock.yaml GHSA-8qq5-rm4j-mr97
38 tar 4.4.19 7.5.4 DEVELOPMENT pnpm-lock.yaml GHSA-r6q2-hw4h-h46w
39 tar 4.4.19 7.5.7 DEVELOPMENT pnpm-lock.yaml GHSA-34x7-hfp2-rc4v
40 tar 4.4.19 7.5.8 DEVELOPMENT pnpm-lock.yaml GHSA-83g3-92jg-28cx
41 axios 0.21.4 0.30.3 DEVELOPMENT pnpm-lock.yaml GHSA-43fc-jf86-j433
43 serialize-javascript 6.0.2 7.0.3 DEVELOPMENT pnpm-lock.yaml GHSA-5c6j-r48x-rmvq
44 tar 4.4.19 7.5.10 DEVELOPMENT pnpm-lock.yaml GHSA-qffp-2rhf-9h96
45 tar 4.4.19 7.5.11 DEVELOPMENT pnpm-lock.yaml GHSA-9ppj-qmqm-q256
46 undici 5.29.0 6.24.0 DEVELOPMENT pnpm-lock.yaml GHSA-2mjp-6q6p-2qxm
47 undici 5.29.0 6.24.0 DEVELOPMENT pnpm-lock.yaml GHSA-4992-7rv2-5pvq
50 lodash 4.17.23 4.18.0 DEVELOPMENT pnpm-lock.yaml GHSA-f23m-r3pf-42rh
51 lodash 4.17.23 4.18.0 DEVELOPMENT pnpm-lock.yaml GHSA-r5fr-rjxr-66jc
52 axios 1.13.6 1.15.0 DEVELOPMENT pnpm-lock.yaml GHSA-fvcv-3m26-pcqx
53 axios 0.21.4 0.31.0 DEVELOPMENT pnpm-lock.yaml GHSA-fvcv-3m26-pcqx
54 axios 1.13.6 1.15.0 DEVELOPMENT pnpm-lock.yaml GHSA-3p68-rc4w-qgx5
55 axios 0.21.4 0.31.0 DEVELOPMENT pnpm-lock.yaml GHSA-3p68-rc4w-qgx5
56 axios 1.13.6 1.15.1 DEVELOPMENT pnpm-lock.yaml GHSA-xhjh-pmcv-23jw
57 axios 0.21.4 0.31.1 DEVELOPMENT pnpm-lock.yaml GHSA-xhjh-pmcv-23jw
58 axios 1.13.6 1.15.2 DEVELOPMENT pnpm-lock.yaml GHSA-q8qp-cvcw-x6jj
59 axios 1.13.6 1.15.2 DEVELOPMENT pnpm-lock.yaml GHSA-3w6x-2g7m-8v23
60 axios 1.13.6 1.15.1 DEVELOPMENT pnpm-lock.yaml GHSA-pmwg-cvhr-8vh7
61 axios 0.21.4 0.31.1 DEVELOPMENT pnpm-lock.yaml GHSA-pmwg-cvhr-8vh7
62 axios 1.13.6 1.15.1 DEVELOPMENT pnpm-lock.yaml GHSA-w9j2-pvgh-6h63
63 axios 0.21.4 0.31.1 DEVELOPMENT pnpm-lock.yaml GHSA-w9j2-pvgh-6h63
64 axios 1.13.6 1.15.1 DEVELOPMENT pnpm-lock.yaml GHSA-xx6v-rp6x-q39c
65 axios 0.21.4 0.31.1 DEVELOPMENT pnpm-lock.yaml GHSA-xx6v-rp6x-q39c
66 axios 1.13.6 1.15.1 DEVELOPMENT pnpm-lock.yaml GHSA-6chq-wfr3-2hj9
67 axios 0.21.4 0.31.1 DEVELOPMENT pnpm-lock.yaml GHSA-6chq-wfr3-2hj9
68 axios 1.13.6 1.15.1 DEVELOPMENT pnpm-lock.yaml GHSA-pf86-5x62-jrwf
69 axios 0.21.4 0.31.1 DEVELOPMENT pnpm-lock.yaml GHSA-pf86-5x62-jrwf
76 axios 1.13.6 1.15.1 DEVELOPMENT pnpm-lock.yaml GHSA-m7pr-hjqh-92cm
77 axios 0.21.4 0.31.1 DEVELOPMENT pnpm-lock.yaml GHSA-m7pr-hjqh-92cm
78 axios 1.13.6 1.15.1 DEVELOPMENT pnpm-lock.yaml GHSA-445q-vr5w-6q77
80 uuid 8.3.2 11.1.1 RUNTIME pnpm-lock.yaml GHSA-w5hq-g745-h8pq
81 serialize-javascript 6.0.2 7.0.5 DEVELOPMENT pnpm-lock.yaml GHSA-qj8w-gfj5-8c6v
82 tmp 0.0.33 0.2.6 DEVELOPMENT pnpm-lock.yaml GHSA-ph9p-34f9-6g65
83 axios 1.13.6 1.16.0 DEVELOPMENT pnpm-lock.yaml GHSA-898c-q2cr-xwhg
84 axios 0.21.4 0.32.0 DEVELOPMENT pnpm-lock.yaml GHSA-898c-q2cr-xwhg
85 axios 0.21.4 0.32.0 DEVELOPMENT pnpm-lock.yaml GHSA-pjwm-pj3p-43mv
86 axios 1.13.6 1.16.0 DEVELOPMENT pnpm-lock.yaml GHSA-35jp-ww65-95wh
87 axios 1.13.6 1.15.2 DEVELOPMENT pnpm-lock.yaml GHSA-3g43-6gmg-66jw
88 axios 0.21.4 0.31.1 DEVELOPMENT pnpm-lock.yaml GHSA-3g43-6gmg-66jw
89 axios 1.13.6 1.16.0 DEVELOPMENT pnpm-lock.yaml GHSA-j5f8-grm9-p9fc
90 axios 0.21.4 0.32.0 DEVELOPMENT pnpm-lock.yaml GHSA-j5f8-grm9-p9fc
91 axios 1.13.6 1.16.0 DEVELOPMENT pnpm-lock.yaml GHSA-p92q-9vqr-4j8v
92 axios 0.21.4 0.32.0 DEVELOPMENT pnpm-lock.yaml GHSA-p92q-9vqr-4j8v
96 ws 3.3.3 5.2.5 DEVELOPMENT pnpm-lock.yaml GHSA-96hv-2xvq-fx4p
97 ws 8.18.0 8.21.0 DEVELOPMENT pnpm-lock.yaml GHSA-96hv-2xvq-fx4p
98 tar 4.4.19 7.5.16 DEVELOPMENT pnpm-lock.yaml GHSA-vmf3-w455-68vh
99 form-data 2.3.3 2.5.6 DEVELOPMENT pnpm-lock.yaml GHSA-hmw2-7cc7-3qxx
100 undici 5.29.0 6.27.0 DEVELOPMENT pnpm-lock.yaml GHSA-35p6-xmwp-9g52
102 undici 5.29.0 6.27.0 DEVELOPMENT pnpm-lock.yaml GHSA-p88m-4jfj-68fv
103 undici 5.29.0 6.27.0 DEVELOPMENT pnpm-lock.yaml GHSA-g8m3-5g58-fq7m
104 js-yaml 4.1.1 4.2.0 DEVELOPMENT pnpm-lock.yaml GHSA-h67p-54hq-rp68
105 adm-zip 0.4.16 0.6.0 DEVELOPMENT pnpm-lock.yaml GHSA-xcpc-8h2w-3j85
108 js-yaml 4.1.1 4.3.0 DEVELOPMENT pnpm-lock.yaml GHSA-52cp-r559-cp3m
112 tar 4.4.19 7.5.18 DEVELOPMENT pnpm-lock.yaml GHSA-w8wr-v893-vjvp
113 axios 1.13.6 1.18.0 DEVELOPMENT pnpm-lock.yaml GHSA-mmx7-hfxf-jppx
114 axios 0.21.4 0.33.0 DEVELOPMENT pnpm-lock.yaml GHSA-mmx7-hfxf-jppx
117 axios 0.21.4 0.33.0 DEVELOPMENT pnpm-lock.yaml GHSA-7q8q-rj6j-mhjq
118 axios 1.13.6 1.18.0 DEVELOPMENT pnpm-lock.yaml GHSA-7q8q-rj6j-mhjq
120 undici 5.29.0 6.28.0 DEVELOPMENT pnpm-lock.yaml GHSA-8xcm-r25x-g524
121 undici 5.29.0 6.28.0 DEVELOPMENT pnpm-lock.yaml GHSA-v3r7-h72x-cjcm
122 undici 5.29.0 6.28.0 DEVELOPMENT pnpm-lock.yaml GHSA-m8rv-5g2x-5cg5
123 js-yaml 4.1.1 4.3.1 DEVELOPMENT pnpm-lock.yaml GHSA-5p4m-2wfm-xmqj
124 decode-uri-component 0.2.2 0.5.0 DEVELOPMENT pnpm-lock.yaml GHSA-vcc3-ghjq-m6fr
```

## Required follow-up

Open a non-production dependency-maintenance branch after the reproducible build
gate is healthy. Prefer removing legacy `request`/web3/Swarm/Safe paths and
updating Hardhat/LayerZero toolchains at their direct parents. Rebuild twice and
re-audit any dependency change that alters Solidity compilation, Cargo.lock,
Solana ELF, executable hash, generated ABI, or transaction-producing tooling.
