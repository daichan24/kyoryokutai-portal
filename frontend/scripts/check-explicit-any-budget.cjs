const { ESLint } = require('eslint');

const explicitAnyBudget = Number(process.argv[2]);
const hooksBudget = Number(process.argv[3]);
if (
  !Number.isInteger(explicitAnyBudget)
  || explicitAnyBudget < 0
  || !Number.isInteger(hooksBudget)
  || hooksBudget < 0
) {
  throw new Error('Usage: node scripts/check-explicit-any-budget.cjs <explicit-any-budget> <hooks-budget>');
}

async function main() {
  const eslint = new ESLint({
    overrideConfig: {
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        'react-hooks/exhaustive-deps': 'error',
      },
    },
  });
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);
  const explicitAnyCount = results.reduce(
    (total, result) => total + result.messages.filter(
      (message) => message.ruleId === '@typescript-eslint/no-explicit-any',
    ).length,
    0,
  );
  const hooksCount = results.reduce(
    (total, result) => total + result.messages.filter(
      (message) => message.ruleId === 'react-hooks/exhaustive-deps',
    ).length,
    0,
  );

  if (explicitAnyCount > explicitAnyBudget || hooksCount > hooksBudget) {
    console.error(
      `Legacy lint budget exceeded: explicit-any ${explicitAnyCount}/${explicitAnyBudget}, hooks ${hooksCount}/${hooksBudget}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Legacy lint budget: explicit-any ${explicitAnyCount}/${explicitAnyBudget}, hooks ${hooksCount}/${hooksBudget}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
