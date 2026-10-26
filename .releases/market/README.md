# Existing Market release carrier

This directory adds only the Market-specific receiver to the Group's existing private carrier and Cloudflare credential lane. Play, the Group site, Koios, static application publishers and other targets are unchanged.

After the original Market artifact and original receiver have been qualified, the reviewed Group source selects an actual carrier with `selection.json`:

| Key | Value |
|---|---|
| `kind` | `561.market-worker-carrier-selection/v1` |
| `repository` | `561-group/561-group-frontdoor-services-section` |
| `revision` | The actual immutable carrier commit |
| `directory` | One directory under `.service-releases/market/` |
| `manifestSha256` | SHA-256 of the exact original Market `manifest.json` |

There is deliberately no fabricated selection file. Without a real selected artifact, source checks report that no provider access is selected. A dispatch cannot supply an unreviewed alternative repository, path, artifact digest or target.

`deploy-market.yml` uses the established `SITE_CONTENT_DEPLOY_KEY` to read that pinned private carrier and the established `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` only in its release step. The Group transport checks every file before executing the original Market receiver. A preceding uncredentialled step invokes the receiver's actual `--verify` path. Source, version, byte, binding, merchant, promotion and rollback policy remain the original Market and Cloudflare owners.

The native producer's carrier contains fifteen exact files: seven common artifacts and eight source-custody artifacts, including its original `parameterSourceManifest`. The original Market receiver checks that manifest's bytes and its declared Public Git binding against the selected Public edition. The older retained-producer carrier remains seven files. An incomplete fourteen-file native carrier is refused instead of dropping the Parameters source custody.

For recovery of an already staged version, the Market owner can select one additional `priorReleaseReceipt` artifact, bounded to 128 KiB and received by the same exact length/hash/path rules. This produces sixteen native files or eight retained-producer files. An unrelated extra artifact is not admitted as a recovery receipt. The Group transports that original receipt; the original Market receiver owns its meaning, unchanged-traffic proof, live baseline agreement, exact staged-byte receiving and promotion/rollback decisions. The manifest may separately pin the original receiver's source commit while preserving the Worker's original source, build and native execution evidence.

Large artifacts may travel as standard gzip files named exactly `<selected-path>.gz` in the same pinned carrier. The original manifest, uncompressed digests, source editions and fifteen-file closure remain unchanged. The explicit `receive` command restores only missing raw files before the existing read-only `verify` command. It bounds compressed input to 16 MiB, bounds native decompression to the exact selected output length, checks that length and SHA-256, and writes exclusively through a contained non-symlink parent. Existing raw files must already match and are never replaced by their compressed siblings. Malformed, truncated, oversized, escaping or altered material is refused; there is no archive extraction or new transport index. Both receiving and verification run before the workflow exposes Cloudflare credentials.

The original Market receipt is retained as a workflow artifact. It is not a settlement receipt or a customer-paid revenue claim. No credential values, provider error bodies or secret values are printed or retained.
