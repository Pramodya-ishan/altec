import { Project, SyntaxKind, VariableStatement } from 'ts-morph';

async function main() {
    const project = new Project();
    const sf = project.addSourceFileAtPath('server.ts');

    const aiFile = project.createSourceFile('server/ai/routes.ts', "import express from 'express';\nimport { GoogleGenAI, Type } from '@google/genai';\nimport crypto from 'crypto';\nimport { readUser, writeUser } from '../data/userRepository';\nimport { enqueueGeminiRequest, dequeueGeminiRequest, ai, requestCountPM, requestCountPD } from './queue';\nexport const aiRoutes = express.Router();\n", { overwrite: true });

    const authFile = project.createSourceFile('server/auth/routes.ts', "import express from 'express';\nimport { readUser, writeUser } from '../data/userRepository';\nexport const authRoutes = express.Router();\n", { overwrite: true });

    // Move queue logic to server/ai/queue.ts
    const queueLogic = "import { GoogleGenAI } from '@google/genai';\n" +
"export const ai = new GoogleGenAI({\n" +
"  apiKey: process.env.GEMINI_API_KEY || 'dummy-key-for-build',\n" +
"});\n" +
"export const RPM_LIMIT = 15;\n" +
"export const RPD_LIMIT = 1500;\n" +
"export let requestCountPM = 0;\n" +
"export let requestCountPD = 0;\n" +
"export let lastResetPM = Date.now();\n" +
"export let lastResetPD = Date.now();\n" +
"export const MAX_CONCURRENT_GEMINI = 1;\n" +
"export let currentGeminiRequests = 0;\n" +
"export const geminiQueue: (() => void)[] = [];\n" +
"export async function enqueueGeminiRequest() {\n" +
"  if (currentGeminiRequests >= MAX_CONCURRENT_GEMINI) {\n" +
"    await new Promise<void>((resolve) => geminiQueue.push(resolve));\n" +
"  }\n" +
"  currentGeminiRequests++;\n" +
"  if (Date.now() - lastResetPM > 60000) {\n" +
"    requestCountPM = 0;\n" +
"    lastResetPM = Date.now();\n" +
"  }\n" +
"  if (Date.now() - lastResetPD > 86400000) {\n" +
"    requestCountPD = 0;\n" +
"    lastResetPD = Date.now();\n" +
"  }\n" +
"  requestCountPM++;\n" +
"  requestCountPD++;\n" +
"}\n" +
"export function dequeueGeminiRequest() {\n" +
"  currentGeminiRequests--;\n" +
"  if (geminiQueue.length > 0) {\n" +
"    const next = geminiQueue.shift();\n" +
"    if (next) next();\n" +
"  }\n" +
"}\n";

    project.createSourceFile('server/ai/queue.ts', queueLogic, { overwrite: true });

    const startServerFunc = sf.getFunction('startServer') || sf.getVariableDeclaration('startServer')?.getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    
    let targetBlock = sf;
    if (startServerFunc) {
        targetBlock = startServerFunc.getBody() as any;
    }

    const aiPaths = ['/api/chat/history', '/api/chat', '/api/generate-image', '/api/notebook-quiz', '/api/quiz', '/api/analytics-summary', '/api/lesson-optimizer'];
    const authPaths = ['/api/auth/email-login', '/api/auth/register-start', '/api/auth/verify-code'];

    const nodesToRemove: any[] = [];

    targetBlock.getStatements().forEach(stmt => {
        if (stmt.getKind() === SyntaxKind.ExpressionStatement) {
            const text = stmt.getText();
            if (text.startsWith('app.post') || text.startsWith('app.get')) {
                const isAi = aiPaths.some(p => text.includes('"' + p + '"') || text.includes("'" + p + "'"));
                const isAuth = authPaths.some(p => text.includes('"' + p + '"') || text.includes("'" + p + "'"));
                
                if (isAi) {
                    let newText = text.replace(/^app\.(post|get)/, 'aiRoutes.$1')
                        .replace('/api/chat', '/chat')
                        .replace('/api/generate-image', '/generate-image')
                        .replace('/api/notebook-quiz', '/notebook-quiz')
                        .replace('/api/quiz', '/quiz')
                        .replace('/api/analytics-summary', '/analytics-summary')
                        .replace('/api/lesson-optimizer', '/lesson-optimizer');
                    aiFile.addStatements(newText);
                    nodesToRemove.push(stmt);
                } else if (isAuth) {
                    let newText = text.replace(/^app\.(post|get)/, 'authRoutes.$1')
                        .replace('/api/auth/email-login', '/email-login')
                        .replace('/api/auth/register-start', '/register-start')
                        .replace('/api/auth/verify-code', '/verify-code');
                    authFile.addStatements(newText);
                    nodesToRemove.push(stmt);
                }
            }
        }
    });

    const globalsToRemove = ['RPM_LIMIT', 'RPD_LIMIT', 'requestCountPM', 'requestCountPD', 'lastResetPM', 'lastResetPD', 'MAX_CONCURRENT_GEMINI', 'currentGeminiRequests', 'geminiQueue', 'enqueueGeminiRequest', 'dequeueGeminiRequest', 'ai'];
    
    sf.getStatements().forEach(s => {
        if (s.getKind() === SyntaxKind.VariableStatement) {
            const dlist = (s as VariableStatement).getDeclarationList();
            const names = dlist.getDeclarations().map(d => d.getName());
            if (names.some(n => globalsToRemove.includes(n))) {
                nodesToRemove.push(s);
            }
        }
        if (s.getKind() === SyntaxKind.FunctionDeclaration) {
            const name = (s as any).getName();
            if (globalsToRemove.includes(name)) {
                nodesToRemove.push(s);
            }
        }
    });

    nodesToRemove.forEach(n => {
       try { n.remove(); } catch(e){}
    });

    sf.insertImportDeclaration(sf.getImportDeclarations().length, {
        namedImports: ['aiRoutes'],
        moduleSpecifier: './server/ai/routes'
    });
    sf.insertImportDeclaration(sf.getImportDeclarations().length, {
        namedImports: ['authRoutes'],
        moduleSpecifier: './server/auth/routes'
    });

    targetBlock.insertStatements(0, "app.use('/api', aiRoutes);\napp.use('/api/auth', authRoutes);\n");

    await project.save();
    console.log("Success");
}
main().catch(console.error);
