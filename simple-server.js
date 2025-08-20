const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 3000;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);
    
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>500 - Server Error</h1>');
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content);
        }
    });
});

server.listen(port, '127.0.0.1', () => {
    console.log(`🚀 Serveur démarré sur http://127.0.0.1:${port}`);
    console.log(`📁 Interface web accessible : http://127.0.0.1:${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} occupé. Tentative sur le port ${port + 1}...`);
        server.listen(port + 1, '127.0.0.1', () => {
            console.log(`🚀 Serveur démarré sur http://127.0.0.1:${port + 1}`);
            console.log(`📁 Interface web accessible : http://127.0.0.1:${port + 1}`);
        });
    } else {
        console.error(`❌ Erreur serveur:`, err);
        process.exit(1);
    }
});