const { ESLint } = require('eslint');

const budget = Number(process.argv[2]);
if (!Number.isInteger(budget) || budget < 0) {
  throw new Error('Usage: node scripts/check-explicit-any-budget.cjs <budget>');
}

async function main() {
  const eslint = new ESLint({
    overrideConfig: {
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
      },
    },
  });
  const results = await eslint.lintFiles(['src/**/*.ts']);
  const count = results.reduce(
    (total, result) => total + result.messages.filter(
      (message) => message.ruleId === '@typescript-eslint/no-explicit-any',
    ).length,
    0,
  );

  if (count > budget) {
    console.error(`Explicit any budget exceeded: ${count} > ${budget}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Explicit any budget: ${count}/${budget}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
