const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 3004;

console.log('🚀 Démarrage du serveur...');

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    console.log(`📝 Requête: ${req.method} ${req.url}`);
    
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'text/plain';
    
    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
        console.log(`❌ Fichier non trouvé: ${filePath}`);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>');
        return;
    }
    
    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(content);
        console.log(`✅ Fichier servi: ${filePath}`);
    } catch (err) {
        console.error(`❌ Erreur lecture fichier: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>500 - Server Error</h1>');
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`✅ Serveur démarré avec succès !`);
    console.log(`🌐 Interface accessible sur:`);
    console.log(`   - http://localhost:${port}`);
    console.log(`   - http://127.0.0.1:${port}`);
    console.log(`   - http://0.0.0.0:${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} déjà utilisé`);
        console.log(`🔄 Tentative sur le port ${port + 1}...`);
        
        server.listen(port + 1, '0.0.0.0', () => {
            console.log(`✅ Serveur démarré sur le port alternatif !`);
            console.log(`🌐 Interface accessible sur:`);
            console.log(`   - http://localhost:${port + 1}`);
            console.log(`   - http://127.0.0.1:${port + 1}`);
        });
    } else {
        console.error(`❌ Erreur serveur:`, err);
        process.exit(1);
    }
});

// Empêcher le serveur de se fermer
process.on('SIGTERM', () => {
    console.log('🛑 Arrêt du serveur...');
    server.close(() => {
        console.log('✅ Serveur arrêté proprement');
        process.exit(0);
    });
});