import { Project, SyntaxKind, VariableStatement } from 'ts-morph';

async function main() {
    const project = new Project();
    const sf = project.addSourceFileAtPath('server.ts');

    const toRemoveGlobal = ['DB_FILE', 'DB_DIR', 'ENCRYPTION_KEY', 'encrypt', 'decrypt', 'getUserFile', 'readUser', 'writeUser'];
    const nodesToRemove: any[] = [];

    sf.getStatements().forEach(s => {
        if (s.getKind() === SyntaxKind.VariableStatement) {
            const vs = s as VariableStatement;
            const dlist = vs.getDeclarationList();
            const names = dlist.getDeclarations().map(d => d.getName());
            if (names.some(n => toRemoveGlobal.includes(n))) {
                nodesToRemove.push(s);
            }
        }
        if (s.getKind() === SyntaxKind.FunctionDeclaration) {
            const name = (s as any).getName();
            if (toRemoveGlobal.includes(name)) {
                nodesToRemove.push(s);
            }
        }
        if (s.getKind() === SyntaxKind.IfStatement && s.getText().includes('DB_FILE')) {
            nodesToRemove.push(s);
        }
        if (s.getKind() === SyntaxKind.IfStatement && s.getText().includes('mkdirSync(DB_DIR')) {
            nodesToRemove.push(s);
        }
    });

    nodesToRemove.forEach(n => n.remove());

    sf.insertImportDeclaration(sf.getImportDeclarations().length, {
        namedImports: ['encrypt', 'decrypt', 'getUserFile', 'readUser', 'writeUser'],
        moduleSpecifier: './server/data/userRepository'
    });

    await project.save();
    console.log("Success");
}
main().catch(console.error);
