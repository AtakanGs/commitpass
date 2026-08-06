const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ts = require("typescript");

const repositoryRoot = path.resolve(__dirname, "..");
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "commitpass-session-tests-"),
);

const files = [
  "lib/sessionPolicy.ts",
  "lib/sessionReceipt.ts",
  "test/sessionPolicy.test.ts",
];

try {
  for (const relativePath of files) {
    const sourcePath = path.join(repositoryRoot, relativePath);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing session policy test input: ${relativePath}`);
    }

    const source = fs.readFileSync(sourcePath, "utf8");
    const result = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        strict: true,
      },
      fileName: relativePath,
      reportDiagnostics: true,
    });

    const diagnostics = result.diagnostics ?? [];

    if (diagnostics.length > 0) {
      const messages = diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          "\n",
        ),
      );

      throw new Error(
        `${relativePath} could not be transpiled:\n${messages.join("\n")}`,
      );
    }

    const outputPath = path.join(
      temporaryRoot,
      relativePath.replace(/\.ts$/, ".js"),
    );

    fs.mkdirSync(path.dirname(outputPath), {
      recursive: true,
    });
    fs.writeFileSync(outputPath, result.outputText);
  }

  const testFile = path.join(
    temporaryRoot,
    "test/sessionPolicy.test.js",
  );
  const run = spawnSync(
    process.execPath,
    ["--test", testFile],
    {
      cwd: repositoryRoot,
      stdio: "inherit",
    },
  );

  if (run.error) {
    throw run.error;
  }

  process.exitCode = run.status ?? 1;
} finally {
  fs.rmSync(temporaryRoot, {
    recursive: true,
    force: true,
  });
}
