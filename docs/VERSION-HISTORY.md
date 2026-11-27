# SmartyNote version history

Product display format: `00.00.000` (major, feature cycle, original GitHub build number).
A device-installed milestone closes its cycle; the following build starts the
next feature cycle. The last three digits always match the original build ID,
including unsuccessful builds. A build's version does not reset within a cycle.
Intermediate successful packages are development prereleases, not claims of
device acceptance. GitHub Actions run numbers remain immutable.

| Closing milestone | Original builds | New version range |
|---|---:|---|
| 00.01.015 | 1–15 | 00.01.001–00.01.015 |
| 00.02.033 | 16–33 | 00.02.016–00.02.033 |
| 00.03.044 | 34–44 | 00.03.034–00.03.044 |
| 00.04.048 | 45–48 | 00.04.045–00.04.048 |
| 00.05.055 | 49–55 | 00.05.049–00.05.055 |
| 00.06.057 | 56–57 | 00.06.056–00.06.057 |
| 00.07.062 | 58–62 | 00.07.058–00.07.062 |
| 00.08.068 | 63–68 | 00.08.063–00.08.068 |
| Four-quadrant development (open) | 69 onward | 00.09.069 onward |
| First accepted public release | TBD | 01.00.BBB (original build ID) |

The mapping follows the user-selected historical milestones; it is not a
certification of device testing. Historical images explicitly show 62 and 68;
other historical device-test identifications require confirmation.

## Build-by-build mapping through build 111

| Original build | Product version | CI outcome | Published release | Commit |
|---:|---|---|---|---|
| 1 | 00.01.001 | failure | — | 42988e1e |
| 2 | 00.01.002 | failure | — | 7db608c3 |
| 3 | 00.01.003 | failure | — | e154163a |
| 4 | 00.01.004 | success | — | 082e227d |
| 5 | 00.01.005 | success | — | e110a64e |
| 6 | 00.01.006 | success | — | 5e7b8a5d |
| 7 | 00.01.007 | success | — | 18377340 |
| 8 | 00.01.008 | success | — | d5924669 |
| 9 | 00.01.009 | success | — | f05d2299 |
| 10 | 00.01.010 | success | — | 23f9a4c8 |
| 11 | 00.01.011 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-11) | 5645321a |
| 12 | 00.01.012 | failure | — | 91e6ad5d |
| 13 | 00.01.013 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-13) | 85335353 |
| 14 | 00.01.014 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-14) | 574f46a5 |
| 15 | 00.01.015 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-15) | e1d72eaf |
| 16 | 00.02.016 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-16) | 45025f17 |
| 17 | 00.02.017 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-17) | 71e8e7fb |
| 18 | 00.02.018 | failure | — | 5fa2e91d |
| 19 | 00.02.019 | failure | — | 06eea26d |
| 20 | 00.02.020 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-20) | 0bc16752 |
| 21 | 00.02.021 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-21) | b95e3c9d |
| 22 | 00.02.022 | failure | — | 92f95ea5 |
| 23 | 00.02.023 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-23) | 79ea47d0 |
| 24 | 00.02.024 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-24) | 16578c2e |
| 25 | 00.02.025 | failure | — | b4c53126 |
| 26 | 00.02.026 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-26) | 45fa6091 |
| 27 | 00.02.027 | failure | — | dde7dbae |
| 28 | 00.02.028 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-28) | 1917e328 |
| 29 | 00.02.029 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-29) | 987edd5c |
| 30 | 00.02.030 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-30) | 5ca7dcdd |
| 31 | 00.02.031 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-31) | 60e922cf |
| 32 | 00.02.032 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-32) | ab740027 |
| 33 | 00.02.033 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-33) | 90d47f6c |
| 34 | 00.03.034 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-34) | 1e15929f |
| 35 | 00.03.035 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-35) | 59e70600 |
| 36 | 00.03.036 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-36) | cbafc3af |
| 37 | 00.03.037 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-37) | 8eabffbc |
| 38 | 00.03.038 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-38) | 0319d323 |
| 39 | 00.03.039 | failure | — | aac25493 |
| 40 | 00.03.040 | failure | — | 9535e22f |
| 41 | 00.03.041 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-41) | 32a42a9f |
| 42 | 00.03.042 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-42) | dc40cbd3 |
| 43 | 00.03.043 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-43) | 64137ad6 |
| 44 | 00.03.044 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-44) | 938a32c9 |
| 45 | 00.04.045 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-45) | a11d4585 |
| 46 | 00.04.046 | failure | — | f3993382 |
| 47 | 00.04.047 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-47) | a942909c |
| 48 | 00.04.048 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-48) | 1885fc4d |
| 49 | 00.05.049 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-49) | a60ec691 |
| 50 | 00.05.050 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-50) | f692bf0b |
| 51 | 00.05.051 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-51) | 1a0b6d77 |
| 52 | 00.05.052 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-52) | f630e4af |
| 53 | 00.05.053 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-53) | bb33fdec |
| 54 | 00.05.054 | failure | — | 5d7d480e |
| 55 | 00.05.055 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-55) | 23c32ac8 |
| 56 | 00.06.056 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-56) | eac89022 |
| 57 | 00.06.057 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-57) | ffa5ff79 |
| 58 | 00.07.058 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-58) | 3165a353 |
| 59 | 00.07.059 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-59) | 80a2cc6b |
| 60 | 00.07.060 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-60) | 40f6f469 |
| 61 | 00.07.061 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-61) | 28f8f0b5 |
| 62 | 00.07.062 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-62) | 3b8468ff |
| 63 | 00.08.063 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-63) | 95cb756a |
| 64 | 00.08.064 | failure | — | fa4b5cc8 |
| 65 | 00.08.065 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-65) | 5bac46ca |
| 66 | 00.08.066 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-66) | fe3cbb67 |
| 67 | 00.08.067 | failure | — | 59c5b1e4 |
| 68 | 00.08.068 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-68) | c3e9eddd |
| 69 | 00.09.069 | failure | — | df3e1c7e |
| 70 | 00.09.070 | failure | — | c5030fa2 |
| 71 | 00.09.071 | failure | — | 625e7493 |
| 72 | 00.09.072 | failure | — | af5285d8 |
| 73 | 00.09.073 | failure | — | f00360ad |
| 74 | 00.09.074 | failure | — | 05c2aaff |
| 75 | 00.09.075 | failure | — | 82917026 |
| 76 | 00.09.076 | failure | — | 5fb7837a |
| 77 | 00.09.077 | success | — | 5e229dad |
| 78 | 00.09.078 | success | — | aa688839 |
| 79 | 00.09.079 | success | — | 6f34d94e |
| 80 | 00.09.080 | failure | — | a3df90bd |
| 81 | 00.09.081 | success | — | afaf148c |
| 82 | 00.09.082 | success | — | a090dc0e |
| 83 | 00.09.083 | success | — | fd75ac6a |
| 84 | 00.09.084 | success | — | d6a84d94 |
| 85 | 00.09.085 | failure | — | 1b88b0ab |
| 86 | 00.09.086 | success | — | cae01b05 |
| 87 | 00.09.087 | success | — | cd632701 |
| 88 | 00.09.088 | success | — | fe98fe2e |
| 89 | 00.09.089 | success | — | 828ab64f |
| 90 | 00.09.090 | success | — | 2528c140 |
| 91 | 00.09.091 | success | — | f93a5520 |
| 92 | 00.09.092 | success | — | 0ac227be |
| 93 | 00.09.093 | success | — | 386754aa |
| 94 | 00.09.094 | success | — | 79a27af7 |
| 95 | 00.09.095 | success | — | fe3ecd51 |
| 96 | 00.09.096 | success | — | e6cf298d |
| 97 | 00.09.097 | success | — | efc752b5 |
| 98 | 00.09.098 | success | — | 494b686b |
| 99 | 00.09.099 | success | — | b7eafdf8 |
| 100 | 00.09.100 | success | — | 299a6986 |
| 101 | 00.09.101 | cancelled | — | 190aaf80 |
| 102 | 00.09.102 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-102) | 279ee137 |
| 103 | 00.09.103 | cancelled | — | e92c511c |
| 104 | 00.09.104 | cancelled | — | e71e32cf |
| 105 | 00.09.105 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-105) | c338b5a0 |
| 106 | 00.09.106 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-106) | 3a8ea177 |
| 107 | 00.09.107 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-107) | 940b0ab0 |
| 108 | 00.09.108 | failure | — | d41ce97c |
| 109 | 00.09.109 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-109) | db3305f6 |
| 110 | 00.09.110 | success | [Package](https://github.com/bvmccune/MySuperPrettyDashboard/releases/tag/dev-build-110) | e921a6aa |
| 111 | 00.09.111 | failure | — | 7c43786c |

Historical releases retain their original `dev-build-N` tags and unchanged package bytes for backward-compatible downloads. The migration attempts to rename release titles only; GitHub permissions may prevent it. Previously installed packages retain their embedded version numbers. New builds use the padded product version in the dashboard and plugin metadata, and the original build number as the numeric plugin version code. npm uses an unpadded equivalent because SemVer disallows leading zeroes.
