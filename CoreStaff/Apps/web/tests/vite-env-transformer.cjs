// Jest-only TypeScript AST transform. Vite's production pipeline never loads it.
const ts = require('typescript');
exports.name = 'jest-vite-env';
exports.version = 1;
exports.factory = () => context => sourceFile => {
  const visit = node => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'env' &&
        ts.isMetaProperty(node.expression) &&
        node.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
        node.expression.name.text === 'meta') {
      return ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier('globalThis'), '__JEST_VITE_ENV__');
    }
    return ts.visitEachChild(node, visit, context);
  };
  return ts.visitNode(sourceFile, visit);
};
