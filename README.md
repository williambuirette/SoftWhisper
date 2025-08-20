# Interface Web de Transcription Whisper

Interface web moderne pour la transcription vocale utilisant votre installation locale de Whisper.

## 🚀 Démarrage

### 1. Installation des dépendances
```bash
npm install
```

### 2. Démarrage du serveur complet (recommandé)
```bash
npm run full
```

Cela démarre :
- **Serveur backend** sur `http://localhost:3001` (API de transcription)
- **Interface web** sur `http://localhost:3000` (Interface utilisateur)

### 3. Ou démarrage séparé

**Serveur backend :**
```bash
npm run server
```

**Interface web :**
```bash
npm run dev
```

## 🎯 Fonctionnalités

### ✅ Connecté à votre installation Whisper
- **Détection automatique** de Whisper.cpp
- Support des modèles installés (tiny, base, small, medium, large)
- **Transcription en temps réel** avec progression
- Streaming des résultats

### 🎵 Interface complète
- **Chargement par glisser-déposer** de fichiers audio/vidéo
- Lecteur audio intégré avec contrôles
- Paramètres de transcription avancés
- Éditeur de transcription avec outils d'export

### 🔧 Paramètres supportés
- **Modèles Whisper** : tiny → large
- **Langues** : détection auto ou manuelle
- **Tâches** : transcription ou traduction
- **Intervalles** : début/fin personnalisés
- **Formats** : texte ou SRT
- **Diarisation** : identification des locuteurs (bientôt)

## 📁 Structure du projet

```
/
├── index.html          # Interface utilisateur
├── style.css           # Styles modernes
├── script.js           # Logique frontend
├── server.js           # API backend Node.js
├── package.json        # Configuration npm
└── uploads/            # Fichiers temporaires (auto-créé)
```

## 🛠️ Vérification de l'installation

L'interface vérifie automatiquement :
- ✅ Disponibilité de Whisper.cpp
- ✅ Modèles installés
- ✅ Connexion backend

## 🎯 Utilisation

1. **Démarrez** avec `npm run full`
2. **Ouvrez** `http://localhost:3000`
3. **Chargez** un fichier audio/vidéo
4. **Configurez** les paramètres de transcription  
5. **Cliquez** sur "Démarrer la transcription"
6. **Suivez** la progression en temps réel
7. **Éditez** et exportez le résultat

## 🔧 Intégration avec votre projet Python

Le serveur Node.js utilise directement :
- **Whisper.cpp** (détecté automatiquement)
- **Modèles** du dossier `./models/whisper/`
- **SpeakerTagger** (intégration prévue)

## ⚡ Performances

- **Streaming** en temps réel des résultats
- **Progression** détaillée pendant la transcription
- **Nettoyage automatique** des fichiers temporaires
- **Gestion d'erreurs** complète

## 🎭 Mode simulation

Si le backend n'est pas disponible, l'interface propose un mode simulation pour tester l'interface.