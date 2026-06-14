# Weaknesses

-   `mendel-config` carries a lot of policy in code, which makes config shape and validation hard to scan.
-   `mendel-pipeline` mixes orchestration, networking, caching, and watch lifecycle in one package.
-   Some development middleware code reaches deep into registry internals, which tightens coupling.
-   The manifest and browser-pack outlets both duplicate entry grouping and dependency reindexing logic.
-   Error handling often logs and exits instead of returning structured failure data.
