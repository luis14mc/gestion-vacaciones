import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adding columns to usuarios table...");
  try {
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS numero_empleado VARCHAR(50);`);
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(50);`);
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS direccion TEXT;`);
    console.log("Columns added successfully.");
  } catch (err) {
    console.error("Error adding columns:", err);
  }
  process.exit(0);
}

main();
