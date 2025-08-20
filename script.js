class WhisperTranscriptionInterface {
    constructor() {
        this.audioFile = null;
        this.audioPlayer = null;
        this.isTranscribing = false;
        this.progressInterval = null;
        this.logCount = 0;
        
        this.initializeElements();
        this.bindEvents();
        this.setupDragAndDrop();
        
        this.log('Interface initialisée', 'success');
    }
    
    initializeElements() {
        // Éléments de chargement de fichier
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.selectFileBtn = document.getElementById('selectFileBtn');
        
        // Éléments du lecteur audio
        this.playerSection = document.getElementById('playerSection');
        this.audioPlayer = document.getElementById('audioPlayer');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.fileDuration = document.getElementById('fileDuration');
        
        // Contrôles audio personnalisés
        this.playBtn = document.getElementById('playBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.progressSlider = document.getElementById('progressSlider');
        this.progress = document.getElementById('progress');
        this.currentTime = document.getElementById('currentTime');
        this.totalTime = document.getElementById('totalTime');
        this.volumeSlider = document.getElementById('volumeSlider');
        
        // Éléments de transcription
        this.startTranscription = document.getElementById('startTranscription');
        this.stopTranscription = document.getElementById('stopTranscription');
        this.progressSection = document.getElementById('progressSection');
        this.progressText = document.getElementById('progressText');
        this.progressPercent = document.getElementById('progressPercent');
        this.progressBarFill = document.getElementById('progressBarFill');
        
        // Zone de transcription
        this.emptyState = document.getElementById('emptyState');
        this.transcriptionEditor = document.getElementById('transcriptionEditor');
        this.transcriptionText = document.getElementById('transcriptionText');
        this.wordCount = document.getElementById('wordCount');
        
        // Boutons de la barre d'outils
        this.copyBtn = document.getElementById('copyBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        // Console
        this.consoleLog = document.getElementById('consoleLog');
        this.logCountElement = document.getElementById('logCount');
        this.clearConsole = document.getElementById('clearConsole');
        
        // Paramètres
        this.modelSelect = document.getElementById('modelSelect');
        this.languageSelect = document.getElementById('languageSelect');
        this.taskSelect = document.getElementById('taskSelect');
        this.startTime = document.getElementById('startTime');
        this.endTime = document.getElementById('endTime');
        this.generateSRT = document.getElementById('generateSRT');
        this.speakerDetection = document.getElementById('speakerDetection');
    }
    
    bindEvents() {
        // Chargement de fichier
        this.selectFileBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Contrôles audio
        this.playBtn.addEventListener('click', () => this.playAudio());
        this.pauseBtn.addEventListener('click', () => this.pauseAudio());
        this.stopBtn.addEventListener('click', () => this.stopAudio());
        this.progressSlider.addEventListener('input', (e) => this.seekAudio(e));
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e));
        
        // Événements audio
        if (this.audioPlayer) {
            this.audioPlayer.addEventListener('loadedmetadata', () => this.onAudioLoaded());
            this.audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
            this.audioPlayer.addEventListener('ended', () => this.onAudioEnded());
        }
        
        // Transcription
        this.startTranscription.addEventListener('click', () => this.startTranscriptionProcess());
        this.stopTranscription.addEventListener('click', () => this.stopTranscriptionProcess());
        
        // Barre d'outils
        this.copyBtn.addEventListener('click', () => this.copyTranscription());
        this.downloadBtn.addEventListener('click', () => this.downloadTranscription());
        this.clearBtn.addEventListener('click', () => this.clearTranscription());
        
        // Console
        this.clearConsole.addEventListener('click', () => this.clearConsoleLog());
        
        // Zone de texte
        this.transcriptionText.addEventListener('input', () => this.updateWordCount());
    }
    
    setupDragAndDrop() {
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('drag-over');
        });
        
        this.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('drag-over');
        });
        
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });
        
        this.uploadArea.addEventListener('click', () => {
            this.fileInput.click();
        });
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }
    
    handleFile(file) {
        // Vérifier le type de fichier
        const validTypes = ['audio/', 'video/'];
        const isValid = validTypes.some(type => file.type.startsWith(type));
        
        if (!isValid) {
            this.log('Type de fichier non supporté', 'error');
            alert('Veuillez sélectionner un fichier audio ou vidéo valide.');
            return;
        }
        
        this.audioFile = file;
        this.loadAudioFile(file);
        this.log(`Fichier chargé: ${file.name} (${this.formatFileSize(file.size)})`, 'success');
    }
    
    loadAudioFile(file) {
        const url = URL.createObjectURL(file);
        this.audioPlayer.src = url;
        
        // Mettre à jour l'interface
        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);
        
        // Afficher la section du lecteur
        this.playerSection.style.display = 'block';
        
        // Activer le bouton de transcription
        this.startTranscription.disabled = false;
        
        // Réinitialiser la transcription
        this.clearTranscription();
    }
    
    onAudioLoaded() {
        const duration = this.audioPlayer.duration;
        this.fileDuration.textContent = this.formatTime(duration);
        this.totalTime.textContent = this.formatTime(duration);
        this.progressSlider.max = duration;
        this.log(`Durée audio: ${this.formatTime(duration)}`, 'info');
    }
    
    playAudio() {
        this.audioPlayer.play();
        this.playBtn.style.display = 'none';
        this.pauseBtn.style.display = 'inline-flex';
        this.log('Lecture démarrée', 'info');
    }
    
    pauseAudio() {
        this.audioPlayer.pause();
        this.playBtn.style.display = 'inline-flex';
        this.pauseBtn.style.display = 'none';
        this.log('Lecture mise en pause', 'info');
    }
    
    stopAudio() {
        this.audioPlayer.pause();
        this.audioPlayer.currentTime = 0;
        this.playBtn.style.display = 'inline-flex';
        this.pauseBtn.style.display = 'none';
        this.updateProgress();
        this.log('Lecture arrêtée', 'info');
    }
    
    seekAudio(event) {
        const time = event.target.value;
        this.audioPlayer.currentTime = time;
    }
    
    setVolume(event) {
        const volume = event.target.value / 100;
        this.audioPlayer.volume = volume;
    }
    
    updateProgress() {
        const current = this.audioPlayer.currentTime || 0;
        const duration = this.audioPlayer.duration || 0;
        
        if (duration > 0) {
            const percentage = (current / duration) * 100;
            this.progress.style.width = `${percentage}%`;
            this.progressSlider.value = current;
            this.currentTime.textContent = this.formatTime(current);
        }
    }
    
    onAudioEnded() {
        this.playBtn.style.display = 'inline-flex';
        this.pauseBtn.style.display = 'none';
        this.log('Lecture terminée', 'info');
    }
    
    startTranscriptionProcess() {
        if (!this.audioFile) {
            this.log('Aucun fichier audio sélectionné', 'error');
            return;
        }
        
        // Avertissement que c'est une démonstration
        if (!confirm('⚠️ DÉMONSTRATION : Cette interface utilise actuellement une simulation de transcription.\n\nPour une vraie transcription, il faut intégrer une API Whisper (OpenAI API ou installation locale).\n\nContinuer avec la démonstration ?')) {
            return;
        }
        
        this.isTranscribing = true;
        this.startTranscription.style.display = 'none';
        this.stopTranscription.style.display = 'inline-flex';
        this.progressSection.style.display = 'block';
        
        this.log('Démarrage de la transcription...', 'info');
        this.log('⚠️ MODE DÉMONSTRATION : Transcription simulée', 'warning');
        
        // Simuler le processus de transcription
        this.simulateTranscription();
    }
    
    stopTranscriptionProcess() {
        this.isTranscribing = false;
        this.startTranscription.style.display = 'inline-flex';
        this.stopTranscription.style.display = 'none';
        this.progressSection.style.display = 'none';
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
        
        this.log('Transcription arrêtée', 'warning');
    }
    
    simulateTranscription() {
        /* 
         * 🚨 SIMULATION DE TRANSCRIPTION 🚨
         * 
         * Cette fonction simule le processus de transcription.
         * Pour une vraie transcription, remplacez ce code par :
         * 
         * OPTION 1 - API OpenAI Whisper :
         * const formData = new FormData();
         * formData.append('file', this.audioFile);
         * formData.append('model', 'whisper-1');
         * 
         * fetch('https://api.openai.com/v1/audio/transcriptions', {
         *   method: 'POST',
         *   headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
         *   body: formData
         * });
         * 
         * OPTION 2 - API Backend local :
         * const formData = new FormData();
         * formData.append('audio', this.audioFile);
         * formData.append('settings', JSON.stringify(this.getTranscriptionSettings()));
         * 
         * fetch('/api/transcribe', {
         *   method: 'POST',
         *   body: formData
         * });
         */
        
        let progress = 0;
        const steps = [
            '🔄 [SIMULATION] Chargement du modèle Whisper...',
            '🔄 [SIMULATION] Préparation de l\'audio...',
            '🔄 [SIMULATION] Segmentation audio...',
            '🔄 [SIMULATION] Transcription en cours...',
            '🔄 [SIMULATION] Post-traitement...',
            '🔄 [SIMULATION] Finalisation...'
        ];
        
        let stepIndex = 0;
        
        this.progressInterval = setInterval(() => {
            if (!this.isTranscribing) {
                clearInterval(this.progressInterval);
                return;
            }
            
            progress += Math.random() * 15 + 5; // Progression aléatoire
            
            if (progress >= 100) {
                progress = 100;
                this.completeTranscription();
                clearInterval(this.progressInterval);
                return;
            }
            
            // Changer d'étape
            if (progress > (stepIndex + 1) * 16.66) {
                stepIndex = Math.min(stepIndex + 1, steps.length - 1);
            }
            
            this.updateTranscriptionProgress(progress, steps[stepIndex]);
        }, 200);
    }
    
    updateTranscriptionProgress(progress, message) {
        this.progressBarFill.style.width = `${progress}%`;
        this.progressPercent.textContent = `${Math.round(progress)}%`;
        this.progressText.textContent = message;
    }
    
    completeTranscription() {
        this.isTranscribing = false;
        this.startTranscription.style.display = 'inline-flex';
        this.stopTranscription.style.display = 'none';
        this.progressSection.style.display = 'none';
        
        // Exemple de transcription
        const sampleTranscription = `🎭 TRANSCRIPTION SIMULÉE 🎭

Bonjour et bienvenue dans cette démonstration de l'interface de transcription Whisper.

Cette interface moderne permet de charger facilement des fichiers audio et vidéo, de les lire avec des contrôles intuitifs, et de configurer la transcription selon vos besoins.

Vous pouvez choisir différents modèles Whisper selon vos besoins :
- Tiny : Rapide mais moins précis
- Base : Un bon équilibre entre vitesse et précision
- Small, Medium, Large : De plus en plus précis mais plus lents

L'interface prend en charge la détection automatique de langue, la traduction vers l'anglais, et même l'identification des locuteurs.

Cette transcription est un exemple généré automatiquement pour démontrer les fonctionnalités de l'interface.

⚠️ POUR UNE VRAIE TRANSCRIPTION :
Intégrez l'API OpenAI Whisper ou installez Whisper localement avec un backend (Python Flask/FastAPI ou Node.js).`;
        
        this.displayTranscription(sampleTranscription);
        this.log('✅ Démonstration de transcription terminée', 'success');
        this.log('💡 Intégrez une vraie API Whisper pour la transcription réelle', 'warning');
    }
    
    displayTranscription(text) {
        this.emptyState.style.display = 'none';
        this.transcriptionEditor.style.display = 'flex';
        this.transcriptionText.value = text;
        this.updateWordCount();
    }
    
    updateWordCount() {
        const text = this.transcriptionText.value.trim();
        const words = text ? text.split(/\s+/).length : 0;
        this.wordCount.textContent = `${words} mots`;
    }
    
    copyTranscription() {
        const text = this.transcriptionText.value;
        if (text) {
            navigator.clipboard.writeText(text).then(() => {
                this.log('Transcription copiée dans le presse-papiers', 'success');
            }).catch(() => {
                this.log('Erreur lors de la copie', 'error');
            });
        }
    }
    
    downloadTranscription() {
        const text = this.transcriptionText.value;
        if (!text) return;
        
        const settings = this.getTranscriptionSettings();
        const filename = this.audioFile ? 
            this.audioFile.name.replace(/\.[^/.]+$/, '') : 'transcription';
        const extension = settings.generateSRT ? '.srt' : '.txt';
        
        let content = text;
        
        if (settings.generateSRT && !text.includes('-->')) {
            // Convertir en format SRT basique
            content = this.convertToSRT(text);
        }
        
        this.downloadFile(content, filename + extension);
        this.log(`Transcription téléchargée: ${filename}${extension}`, 'success');
    }
    
    convertToSRT(text) {
        // Conversion basique en SRT (simulation)
        const lines = text.split('\n').filter(line => line.trim());
        let srt = '';
        
        lines.forEach((line, index) => {
            const startTime = this.formatSRTTime(index * 3);
            const endTime = this.formatSRTTime((index + 1) * 3);
            
            srt += `${index + 1}\n`;
            srt += `${startTime} --> ${endTime}\n`;
            srt += `${line}\n\n`;
        });
        
        return srt;
    }
    
    formatSRTTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        const ms = Math.floor((secs % 1) * 1000);
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(Math.floor(secs)).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    }
    
    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }
    
    clearTranscription() {
        this.emptyState.style.display = 'flex';
        this.transcriptionEditor.style.display = 'none';
        this.transcriptionText.value = '';
        this.updateWordCount();
    }
    
    getTranscriptionSettings() {
        return {
            model: this.modelSelect.value,
            language: this.languageSelect.value,
            task: this.taskSelect.value,
            startTime: this.startTime.value,
            endTime: this.endTime.value,
            generateSRT: this.generateSRT.checked,
            speakerDetection: this.speakerDetection.checked
        };
    }
    
    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        this.consoleLog.appendChild(logEntry);
        this.consoleLog.scrollTop = this.consoleLog.scrollHeight;
        
        this.logCount++;
        this.logCountElement.textContent = `(${this.logCount})`;
    }
    
    clearConsoleLog() {
        this.consoleLog.innerHTML = '';
        this.logCount = 0;
        this.logCountElement.textContent = '(0)';
    }
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialiser l'interface
document.addEventListener('DOMContentLoaded', () => {
    new WhisperTranscriptionInterface();
});

// Fonctions utilitaires globales
window.addEventListener('beforeunload', (e) => {
    // Avertir si une transcription est en cours
    const interface = window.whisperInterface;
    if (interface && interface.isTranscribing) {
        e.preventDefault();
        e.returnValue = 'Une transcription est en cours. Êtes-vous sûr de vouloir quitter ?';
    }
});