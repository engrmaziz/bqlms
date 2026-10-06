import "dotenv/config";
import readline from "node:readline";
import { createUserWithProfile, getUserByEmail } from "../src/modules/identity";

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index !== -1 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  return undefined;
}

async function main() {
  console.log("=== Initial Super Admin Creation (create-owner) ===\n");

  // Allow CLI arguments or ENV variables for automated testing/scripts, or fallback to interactive prompts
  const name =
    getArg("--name") ||
    process.env.OWNER_NAME ||
    (await prompt("Enter super admin full name: "));

  const email =
    getArg("--email") ||
    process.env.OWNER_EMAIL ||
    (await prompt("Enter super admin email address: "));

  const password =
    getArg("--password") ||
    process.env.OWNER_PASSWORD ||
    (await prompt("Enter secure password (min 8 chars): "));

  if (!name || !email || !password) {
    console.error("❌ Name, email, and password are all required.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("❌ Password must be at least 8 characters long.");
    process.exit(1);
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    console.log(`ℹ️ User with email ${email} already exists.`);
    process.exit(0);
  }

  const { user, profile } = await createUserWithProfile({
    name,
    email,
    password,
    roles: ["super_admin"],
    status: "active",
  });

  console.log("\n✓ First Super Admin created successfully!");
  console.log(`  User ID: ${user.id}`);
  console.log(`  Email:   ${user.email}`);
  console.log(`  Roles:   ${profile.roles.join(", ")}`);
  console.log(`  Status:  ${profile.status}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to create super admin:", err);
  process.exit(1);
});
