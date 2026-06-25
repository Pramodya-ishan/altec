import { Project, SyntaxKind } from 'ts-morph';

async function main() {
    const project = new Project();
    project.addSourceFilesAtPaths("src/**/*.tsx");
    project.addSourceFilesAtPaths("src/**/*.ts");

    const fetchInvocations = [];

    // Find all CallExpressions of 'fetch'
    project.getSourceFiles().forEach(sf => {
        sf.forEachDescendant(node => {
            if (node.getKind() === SyntaxKind.CallExpression) {
                const callExpr = node as any;
                const expr = callExpr.getExpression();
                if (expr.getText() === 'fetch') {
                    const args = callExpr.getArguments();
                    if (args.length > 0 && typeof args[0].getText === 'function') {
                        const url = args[0].getText();
                        if (url.includes('/api/')) {
                            fetchInvocations.push(callExpr);
                        }
                    }
                }
            }
        });
    });

    for (const callExpr of fetchInvocations) {
        const sf = callExpr.getSourceFile();
        // check if `import { getAuthToken } from '@/lib/api'` exists
        let importDecl = sf.getImportDeclaration(d => d.getModuleSpecifierValue() === '@/lib/api' || d.getModuleSpecifierValue() === '../../lib/api' || d.getModuleSpecifierValue() === '../lib/api');
        
        const pathLevel = sf.getFilePath().split('src/')[1].split('/').length - 1;
        const prefix = pathLevel === 0 ? './' : '../'.repeat(pathLevel);
        const modulePath = prefix + 'lib/api';

        if (!importDecl) {
            sf.insertImportDeclaration(0, {
                namedImports: ['apiFetch'],
                moduleSpecifier: modulePath
            });
        } else {
             const named = importDecl.getNamedImports().find(n => n.getName() === 'apiFetch');
             if (!named) importDecl.addNamedImport('apiFetch');
        }

        callExpr.getExpression().replaceWithText('apiFetch');
    }

    await project.save();
    console.log("Refactored fetch to apiFetch");
}
main();
