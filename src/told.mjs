// A probe's answer, told in Belnap's four values. `status` is the HTTP status
// of the first response (redirects not followed), or null when nothing answered.

export const TOLD = Object.freeze(["true", "both", "false", "neither"]);

export function toldOf(status) {
  if (status === undefined) return "neither";
  if (status === null || status >= 500) return "false";
  if (status === 401 || status === 402 || status === 403) return "both";
  if (status >= 200 && status < 400) return "true";
  return "false";
}
