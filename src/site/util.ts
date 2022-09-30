export function assert(
  statement: boolean,
  message = ""
): asserts statement is true {
  if (!statement) throw new Error("Assertion failed: " + message);
}
