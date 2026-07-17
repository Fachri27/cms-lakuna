type Class = string | false | null | undefined;

/** Minimal className joiner — filters falsy values and joins with spaces. */
export function cn(...classes: Class[]): string {
  return classes.filter(Boolean).join(" ");
}