import { sql } from "drizzle-orm";

/**
 * Binds a JS string array as ONE PostgreSQL array literal.
 * (Drizzle would otherwise expand a JS array inside sql`` into a list of parameters, which breaks `= ANY(...)`.)
 * Usage: sql`id = ANY(${pgTextArray(ids)}::uuid[])`
 */
export const pgTextArray = (values: string[]) =>
  sql`${`{${values.map((v) => `"${v.replace(/["\\]/g, "\\$&")}"`).join(",")}}`}`;
