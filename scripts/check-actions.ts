import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

function getFilesRecursively(dir: string, pattern: RegExp): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath, pattern));
    } else if (pattern.test(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkActionFile(filePath: string): string[] {
  const code = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true,
  );
  const errors: string[] = [];

  ts.forEachChild(sourceFile, (node) => {
    // Check for exported variable statements
    if (ts.isVariableStatement(node)) {
      const isExported = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      );
      if (isExported) {
        for (const decl of node.declarationList.declarations) {
          const exportName = decl.name.getText(sourceFile);
          const init = decl.initializer;
          if (!init || !ts.isCallExpression(init)) {
            errors.push(
              `${filePath}: Export '${exportName}' must be initialized with defineAction(...)`,
            );
            continue;
          }
          const callText = init.expression.getText(sourceFile);
          if (
            callText !== "defineAction" &&
            !callText.endsWith(".defineAction")
          ) {
            errors.push(
              `${filePath}: Export '${exportName}' is initialized with '${callText}', expected defineAction(...)`,
            );
          }
        }
      }
    } else if (ts.isFunctionDeclaration(node)) {
      const isExported = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      );
      if (isExported && node.name) {
        errors.push(
          `${filePath}: Exported function '${node.name.getText(sourceFile)}' is not allowed in actions.ts. All exports must be created with defineAction(...)`,
        );
      }
    }
  });

  return errors;
}

function checkRouteFile(filePath: string): string[] {
  const code = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true,
  );
  const errors: string[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      const isExported = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      );
      if (isExported) {
        for (const decl of node.declarationList.declarations) {
          const exportName = decl.name.getText(sourceFile);
          if (HTTP_METHODS.has(exportName)) {
            const init = decl.initializer;
            if (!init || !ts.isCallExpression(init)) {
              errors.push(
                `${filePath}: Route handler '${exportName}' must be initialized with defineRoute(...)`,
              );
              continue;
            }
            const callText = init.expression.getText(sourceFile);
            if (
              callText !== "defineRoute" &&
              !callText.endsWith(".defineRoute")
            ) {
              errors.push(
                `${filePath}: Route handler '${exportName}' is initialized with '${callText}', expected defineRoute(...)`,
              );
            }
          }
        }
      }
    } else if (ts.isFunctionDeclaration(node)) {
      const isExported = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      );
      if (
        isExported &&
        node.name &&
        HTTP_METHODS.has(node.name.getText(sourceFile))
      ) {
        errors.push(
          `${filePath}: Route handler '${node.name.getText(sourceFile)}' must be defined via 'export const ${node.name.getText(sourceFile)} = defineRoute(...)', not a function declaration.`,
        );
      }
    }
  });

  return errors;
}

function main() {
  console.log("Checking actions and API v1 route conventions via AST...");

  const rootDir = process.cwd();
  const modulesDir = path.join(rootDir, "src/modules");
  const actionFiles = getFilesRecursively(modulesDir, /actions\.ts$/);

  const apiDir = path.join(rootDir, "src/app/api/v1");
  const routeFiles = getFilesRecursively(apiDir, /route\.ts$/);

  const allErrors: string[] = [];

  for (const file of actionFiles) {
    allErrors.push(...checkActionFile(file));
  }

  for (const file of routeFiles) {
    allErrors.push(...checkRouteFile(file));
  }

  if (allErrors.length > 0) {
    console.error(`\n❌ Found ${allErrors.length} violation(s):`);
    for (const err of allErrors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `✓ Verified ${actionFiles.length} actions file(s) and ${routeFiles.length} /api/v1 route(s). All conform to defineAction/defineRoute.`,
  );
}

main();
