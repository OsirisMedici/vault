# Source checkpoint

This parentless source snapshot preserves one local workstream without publishing its historical ancestry.

Original source revision: `ef5d2bd66004fa33e38e42eceacd6192ec9b88b1`.

Private operational documents, credentials, runtime data, generated output and dependencies are excluded. Original licenses, notices, owned code and pinned vendor gitlinks are retained.

CI workflows are retained under `.source-checkpoint/inactive-workflows/` to prevent checkpoint pushes from invoking automation. Ignored standalone build helpers are retained under `.source-checkpoint/ignored-helpers/` when present.

This is source recovery evidence, not a build, deployment or app acceptance. The full path-by-path inclusion and exclusion report is retained locally by the owner.

The desktop submodule was physically unpopulated with an empty index. Its original pinned gitlink is retained; apparent mass deletions are not published as an owned source change.
