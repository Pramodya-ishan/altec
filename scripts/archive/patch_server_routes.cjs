const fs = require('fs');
let file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
// Dummy routes for compatibility
app.get("/api/notifications", (req, res) => res.json({ notifications: [] }));
app.post("/api/notifications/trigger", (req, res) => res.json({ success: true }));
app.post("/api/notifications/read", (req, res) => res.json({ success: true }));
app.post("/api/notifications/delete", (req, res) => res.json({ success: true }));
app.get("/api/profile", (req, res) => res.json({ profile: {} }));
app.get("/api/data", (req, res) => res.json({}));
app.post("/api/data", (req, res) => res.json({ success: true }));
app.get("/api/cookies", (req, res) => res.json({}));

app.use('/api/auth', authRoutes);
`;

content = content.replace(/app\.use\('\/api\/auth', authRoutes\);/, replacement);
fs.writeFileSync(file, content);
