/**
 * Renders a JSON-LD graph.
 *
 * Deliberately **not** a client component. Structured data has to be present in
 * the server-rendered HTML; a `"use client"` version would be injected by the
 * hydration bundle, which is later than a crawler is guaranteed to read and
 * invisible to anything that does not execute JavaScript.
 *
 * Two details in the serialisation are load-bearing rather than stylistic:
 *
 * - **`<`, `>` and `&` are escaped to their `\uXXXX` forms.** `JSON.stringify`
 *   does not neutralise a string containing `</script>`, so any value that came
 *   from a database column can close the script element and inject markup. This
 *   is the escape Next's own `json-ld` guide prescribes, and it is what makes it
 *   safe to interpolate an untrusted blog excerpt here.
 * - **U+2028 and U+2029 are escaped too.** They are literal line terminators in
 *   JavaScript but ordinary characters in JSON, so an unescaped one in a title
 *   turns the payload into a syntax error in any consumer that evaluates it.
 *   They are why `JSON.stringify` alone is not enough even after the `<` fix.
 *
 * `suppressHydrationWarning` is set because dates are serialised on the server
 * and re-serialised on the client; a value that renders identically can still be
 * compared as a different string.
 */

const ESCAPES: [RegExp, string][] = [
  [/</g, "\\u003c"],
  [/>/g, "\\u003e"],
  [/&/g, "\\u0026"],
  [/\u2028/g, "\\u2028"],
  [/\u2029/g, "\\u2029"],
];

export function serializeJsonLd(data: Record<string, unknown>): string {
  let json = JSON.stringify(data);
  for (const [pattern, replacement] of ESCAPES) {
    json = json.replace(pattern, replacement);
  }
  return json;
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  if (!data || !Object.keys(data).length) return null;

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
