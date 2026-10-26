# Existing house ads production release

This carrier runs the original `house-ads-server-site` publisher against
`ads.561.group`. Production was still serving the former 12-entry catalog after
the host and advertising quota repair merged. This release installs the exact
selected `0.3.0-dev.2` package and publishes its already-qualified 24-entry
catalog. Ordinary house traffic writes aggregate `AD_ACTIVITY` observations
and consumes no `AD_RECEIPTS` KV PUTs. The existing paid receipt requirements,
quota hold/reset, publisher restrictions and inactive game records remain in
the original supplier.

The package registry does not yet publish advertising `0.3.0-dev.2`. The archive
here is `npm pack --ignore-scripts` from the merged supplier commit in
`release.json`. Its SHA1 is `3c0bdbc0747dfab1be0cff6f7e69e9846a6f3d5b`, matching
the original host qualification. This is a source-built release, as supported
by the host README. The host's exact dependency declaration remains unchanged;
the release lock resolves that declaration to this immutable archive. Every
other package has its original registry URL, exact version and integrity.
The source carrier stores the archive as canonical base64 text. Preparation
decodes it and checks both original archive digests before writing the exact
tarball consumed by the unchanged lock.

The workflow reuses this repository's established Cloudflare runner credential.
PR runs only install, run the original checks and compare the compiled Worker.
Reviewed main changes to this carrier deploy using the original host's
`npm run deploy`, then read the active provider version and exact public
`/health` and `/catalog`. These reads generate no ad, view or click events.
The existing active version is retained for rollback. The Worker handler,
source catalog and host configuration are not copied into another application.

To update this release, receive a new original host/supplier commit, regenerate
the exact archive and dependency lock, qualify the original host and dry run,
then update the release manifest and workflow source pin together. Review and
merge those changes through the same PR path. Manual runs are main-only.
