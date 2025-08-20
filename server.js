const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.static('.'));
app.use(express.json());

// Configuration pour l'upload de fichiers
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limite
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4',
            'audio/x-m4a', 'audio/flac', 'audio/ogg',
            'video/mp4', 'video/avi', 'video/mov', 'video/quicktime'
        ];
        
        if (allowedMimes.includes(file.mimetype) || 
            file.originalname.match(/\.(wav|mp3|m4a|flac|ogg|mp4|avi|mov)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Format de fichier non supporté'));
        }
    }
});

// Endpoint pour la transcription
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier audio fourni' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    
    try {
        console.log(`🎵 Début de transcription: ${originalName}`);
        
        // Paramètres de transcription depuis la requête
        const settings = JSON.parse(req.body.settings || '{}');
        const {
            model = 'base',
            language = 'auto',
            task = 'transcribe',
            startTime = '',
            endTime = '',
            generateSRT = false,
            speakerDetection = false
        } = settings;

        // Détecter le chemin de whisper.cpp
        const whisperPaths = [
            './Whisper_win-x64/whisper-cli.exe',
            './Whisper_lin-x64/whisper-cli',
            'whisper',
            'whisper.cpp'
        ];

        let whisperPath = null;
        for (const wPath of whisperPaths) {
            if (fs.existsSync(wPath)) {
                whisperPath = wPath;
                break;
            }
        }

        if (!whisperPath) {
            throw new Error('Whisper.cpp non trouvé. Vérifiez l\'installation.');
        }

        // Construire la commande whisper
        const modelPath = `./models/whisper/ggml-${model}.bin`;
        
        if (!fs.existsSync(modelPath)) {
            throw new Error(`Modèle ${model} non trouvé: ${modelPath}`);
        }

        const args = [
            '-m', modelPath,
            '-f', filePath,
            '-l', language === 'auto' ? 'auto' : language,
            '--output-json'
        ];

        if (task === 'translate') {
            args.push('--translate');
        }

        if (generateSRT) {
            args.push('--output-srt');
        }

        console.log(`🚀 Commande Whisper: ${whisperPath} ${args.join(' ')}`);

        // Exécuter Whisper avec streaming des résultats
        const whisperProcess = spawn(whisperPath, args);
        
        let transcriptionData = '';
        let errorData = '';

        // Configurer le streaming des résultats
        res.writeHead(200, {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        whisperProcess.stdout.on('data', (data) => {
            const output = data.toString();
            transcriptionData += output;
            
            // Envoyer les mises à jour en temps réel
            res.write(`data: ${JSON.stringify({
                type: 'progress',
                content: output,
                timestamp: Date.now()
            })}\n\n`);
        });

        whisperProcess.stderr.on('data', (data) => {
            const error = data.toString();
            errorData += error;
            console.error('Whisper stderr:', error);
            
            // Extraire les informations de progression si possible
            const progressMatch = error.match(/(\d+)%/);
            if (progressMatch) {
                res.write(`data: ${JSON.stringify({
                    type: 'progress_percent',
                    percent: parseInt(progressMatch[1]),
                    timestamp: Date.now()
                })}\n\n`);
            }
        });

        whisperProcess.on('close', (code) => {
            console.log(`✅ Whisper terminé avec le code: ${code}`);
            
            if (code === 0) {
                // Traiter les résultats
                let finalResult = transcriptionData;
                
                // Si la diarisation est activée, utiliser speaker_tagger.py
                if (speakerDetection) {
                    console.log('🎭 Activation de la diarisation...');
                    // TODO: Intégrer speaker_tagger.py
                    finalResult = `[Diarisation activée]\n${finalResult}`;
                }

                res.write(`data: ${JSON.stringify({
                    type: 'complete',
                    transcription: finalResult,
                    success: true,
                    timestamp: Date.now()
                })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    error: `Erreur Whisper (code ${code}): ${errorData}`,
                    success: false,
                    timestamp: Date.now()
                })}\n\n`);
            }
            
            res.end();
            
            // Nettoyer le fichier temporaire
            fs.unlink(filePath, (err) => {
                if (err) console.error('Erreur suppression fichier:', err);
            });
        });

        whisperProcess.on('error', (error) => {
            console.error('❌ Erreur lancement Whisper:', error);
            res.write(`data: ${JSON.stringify({
                type: 'error',
                error: `Impossible de lancer Whisper: ${error.message}`,
                success: false,
                timestamp: Date.now()
            })}\n\n`);
            res.end();
        });

    } catch (error) {
        console.error('❌ Erreur transcription:', error);
        res.status(500).json({
            error: `Erreur de transcription: ${error.message}`
        });
        
        // Nettoyer le fichier en cas d'erreur
        fs.unlink(filePath, (err) => {
            if (err) console.error('Erreur suppression fichier:', err);
        });
    }
});

// Endpoint pour vérifier l'état de Whisper
app.get('/api/whisper-status', (req, res) => {
    const whisperPaths = [
        { path: './Whisper_win-x64/whisper-cli.exe', platform: 'Windows' },
        { path: './Whisper_lin-x64/whisper-cli', platform: 'Linux' },
        { path: 'whisper', platform: 'Global' }
    ];

    const modelsPath = './models/whisper/';
    const availableModels = [];

    if (fs.existsSync(modelsPath)) {
        const files = fs.readdirSync(modelsPath);
        files.forEach(file => {
            if (file.startsWith('ggml-') && file.endsWith('.bin')) {
                const modelName = file.replace('ggml-', '').replace('.bin', '');
                availableModels.push(modelName);
            }
        });
    }

    let whisperInstalled = null;
    for (const wp of whisperPaths) {
        if (fs.existsSync(wp.path)) {
            whisperInstalled = wp;
            break;
        }
    }

    res.json({
        whisperInstalled: !!whisperInstalled,
        whisperPath: whisperInstalled?.path || null,
        platform: whisperInstalled?.platform || null,
        availableModels,
        modelsPath
    });
});

const server = app.listen(port, () => {
    console.log(`🚀 Serveur de transcription démarré sur http://localhost:${port}`);
    console.log(`📁 Interface web: http://localhost:${port}`);
    console.log(`🔧 API: http://localhost:${port}/api/transcribe`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} déjà utilisé. Tentative sur le port ${port + 1}...`);
        const alternativePort = port + 1;
        app.listen(alternativePort, () => {
            console.log(`🚀 Serveur de transcription démarré sur http://localhost:${alternativePort}`);
            console.log(`📁 Interface web: http://localhost:${alternativePort}`);
            console.log(`🔧 API: http://localhost:${alternativePort}/api/transcribe`);
        });
    } else {
        console.error(`❌ Erreur serveur:`, err);
    }
});