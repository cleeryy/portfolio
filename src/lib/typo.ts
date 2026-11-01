/**
 * French typography, applied once at authoring time.
 *
 * A French sentence needs a non-breaking space before `:`, `;`, `!`, `?` and
 * inside guillemets. Writing `\u00a0` by hand in forty strings is how a typo
 * gets in; this helper is idempotent, so applying it twice changes nothing.
 */
export function fr(input: string): string {
  return input
    .replace(/ ([:;!?])/g, '\u00a0$1')
    .replace(/« /g, '«\u00a0')
    .replace(/ »/g, '\u00a0»')
}
