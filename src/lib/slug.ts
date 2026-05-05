export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')      // strip non-word chars (keep hyphen + whitespace)
    .replace(/[_\s]+/g, '-')         // whitespace/underscore → hyphen
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-|-$/g, '');          // trim
}
