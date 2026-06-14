# Strengths

-   The repo splits build-time work from request-time work.
-   The daemon caches transformed entries and shares them across clients.
-   Generators and outlets are pluggable, so bundle shape and output format stay separate.
-   Manifest output records variation, normalized id, source, and hashes, which makes runtime resolution deterministic.
-   Development and production use different request paths, so the architecture can optimize each one directly.
