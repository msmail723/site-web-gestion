// app.js
// Projet de gestion de recettes en 2 langues
// Utilise Express, sessions, body-parser, multer pour gestion des uploads.
// Référence: sujetProgWeb2024.pdf :contentReference[oaicite:0]{index=0}&#8203;:contentReference[oaicite:1]{index=1}
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret_recipes_key',
    resave: false,
    saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer pour les uploads de fichiers (photos)
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Stockage en mémoire des recettes et des utilisateurs
// Chargement des recettes depuis data/recipes.json :contentReference[oaicite:2]{index=2}&#8203;:contentReference[oaicite:3]{index=3}
let recipes = [];
try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'recipes.json'));
    recipes = JSON.parse(data);
    // Ajout d'un id unique à chaque recette
    recipes.forEach((recipe, index) => {
        recipe.id = index + 1;
    });
} catch (err) {
    console.error('Erreur lors du chargement des recettes:', err);
}

// Stockage des utilisateurs (en production, utiliser une BDD)
let users = [
    { id: 1, username: 'admin', password: 'admin', role: 'Administrateur' },
    { id: 2, username: 'chef1', password: 'chef1', role: 'Chef' },
    { id: 3, username: 'cuisinier1', password: 'cuisinier1', role: 'Cuisinier' },
    { id: 4, username: 'trad1', password: 'trad1', role: 'Traducteur' }
];
let nextUserId = 5;
let nextRecipeId = recipes.length + 1; // Pour assigner un id aux nouvelles recettes

// Middleware d'authentification
function checkAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Non autorisé' });
    }
}

// Middleware pour l'administrateur
function checkAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'Administrateur') {
        next();
    } else {
        res.status(403).json({ error: 'Accès interdit' });
    }
}

// API endpoints

// Inscription
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Nom d\'utilisateur déjà utilisé' });
    }
    // Par défaut, rôle "Cuisinier". Possibilité de demander Chef ou Traducteur.
    let role = 'Cuisinier';
    if (req.body.demandeRole === 'chef') role = 'DemandeChef';
    if (req.body.demandeRole === 'trad') role = 'DemandeTraducteur';
    
    const newUser = { id: nextUserId++, username, password, role };
    users.push(newUser);
    req.session.user = newUser;
    res.json({ message: 'Inscription réussie', user: newUser });
});

// Connexion
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }
    req.session.user = user;
    res.json({ message: 'Connexion réussie', user });
});

// Déconnexion
app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Déconnexion réussie' });
});

// Récupérer l'utilisateur connecté
app.get('/api/currentUser', (req, res) => {
    res.json({ user: req.session.user || null });
});

// Récupérer la liste des recettes avec filtrage optionnel
app.get('/api/recipes', (req, res) => {
    let result = recipes;
    const { q, glutenFree, vegan, language } = req.query;
    if (q) {
        result = result.filter(recipe => {
            return (recipe.name && recipe.name.toLowerCase().includes(q.toLowerCase())) ||
                   (recipe.steps && recipe.steps.join(' ').toLowerCase().includes(q.toLowerCase()));
        });
    }
    if (glutenFree === 'true') {
        result = result.filter(recipe => recipe.Without && recipe.Without.includes('NoGluten'));
    }
    if (vegan === 'true') {
        result = result.filter(recipe => recipe.Without && recipe.Without.includes('Vegan'));
    }
    if (language === 'fr') {
        result = result.filter(recipe => recipe.nameFR);
    }
    if (language === 'en') {
        result = result.filter(recipe => recipe.name);
    }
    res.json(result);
});

// Récupérer une recette par son id et calculer le temps total
app.get('/api/recipes/:id', (req, res) => {
    const recipe = recipes.find(r => r.id == req.params.id);
    if (!recipe) {
        return res.status(404).json({ error: 'Recette non trouvée' });
    }
    let totalTime = 0;
    if (recipe.timers) {
        totalTime = recipe.timers.reduce((sum, t) => sum + t, 0);
    }
    res.json({ recipe, totalTime });
});

app.post('/api/recipes', checkAuthenticated, (req, res) => {
    const user = req.session.user;
    if (user.role !== 'Chef' && user.role !== 'Administrateur') {
        return res.status(403).json({ error: 'Accès interdit : seuls les chefs peuvent ajouter des recettes' });
    }
    const newRecipe = req.body;
    newRecipe.id = nextRecipeId++;
    newRecipe.author = user.username;
    newRecipe.comments = [];
    newRecipe.photos = [];
    newRecipe.likes = 0;
    // Définir un statut par défaut s'il n'est pas fourni (par exemple "en cours")
    newRecipe.status = newRecipe.status || 'en cours';
    recipes.push(newRecipe);
    res.json({ message: 'Recette ajoutée', recipe: newRecipe });
});


// Mise à jour d'une recette (les Chefs peuvent modifier leurs propres recettes, l'admin tout)
app.put('/api/recipes/:id', checkAuthenticated, (req, res) => {
    const user = req.session.user;
    const recipe = recipes.find(r => r.id == req.params.id);
    if (!recipe) {
        return res.status(404).json({ error: 'Recette non trouvée' });
    }
    if (user.role !== 'Administrateur' && recipe.author !== user.username) {
        return res.status(403).json({ error: 'Accès interdit : vous ne pouvez modifier que vos propres recettes' });
    }
    Object.assign(recipe, req.body);
    res.json({ message: 'Recette mise à jour', recipe });
});

// Suppression d'une recette (seulement par l'Administrateur)
app.delete('/api/recipes/:id', checkAdmin, (req, res) => {
    const index = recipes.findIndex(r => r.id == req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'Recette non trouvée' });
    }
    recipes.splice(index, 1);
    res.json({ message: 'Recette supprimée' });
});

// Ajout d'un commentaire (accessible à tous)
app.post('/api/recipes/:id/comments', checkAuthenticated, (req, res) => {
    const recipe = recipes.find(r => r.id == req.params.id);
    if (!recipe) {
        return res.status(404).json({ error: 'Recette non trouvée' });
    }
    const comment = {
        user: req.session.user.username,
        text: req.body.text,
        date: new Date()
    };
    if (!recipe.comments) recipe.comments = [];
    recipe.comments.push(comment);
    res.json({ message: 'Commentaire ajouté', comment });
});

// Ajout d'une photo (prise en charge d'upload ou URL)
app.post('/api/recipes/:id/photos', checkAuthenticated, upload.single('photo'), (req, res) => {
    const recipe = recipes.find(r => r.id == req.params.id);
    if (!recipe) {
        return res.status(404).json({ error: 'Recette non trouvée' });
    }
    let photoURL = req.body.photoURL;
    if (req.file) {
        photoURL = '/uploads/' + req.file.filename;
    }
    if (!recipe.photos) recipe.photos = [];
    recipe.photos.push(photoURL);
    res.json({ message: 'Photo ajoutée', photoURL });
});

// Ajout d'un "like" (cœur)
app.post('/api/recipes/:id/like', checkAuthenticated, (req, res) => {
    const recipe = recipes.find(r => r.id == req.params.id);
    if (!recipe) {
        return res.status(404).json({ error: 'Recette non trouvée' });
    }
    recipe.likes = (recipe.likes || 0) + 1;
    res.json({ message: 'Recette aimée', likes: recipe.likes });
});

// Fonction utilitaire pour compter les champs manquants (null ou vides) dans une recette
function countNullFields(recipe) {
    let count = 0;
    if (!recipe.name) count++;
    if (!recipe.nameFR) count++;
    if (!recipe.steps || recipe.steps.length === 0) count++;
    if (!recipe.stepsFR || recipe.stepsFR.length === 0) count++;
    if (!recipe.ingredients || recipe.ingredients.length === 0) count++;
    if (!recipe.ingredientsFR || recipe.ingredientsFR.length === 0) count++;
    return count;
}

// Endpoint pour l'administrateur : déclarer une recette comme "terminée" ou "publiée"
app.put('/api/recipes/:id/status', checkAdmin, (req, res) => {
    const recipe = recipes.find(r => r.id == req.params.id);
    if (!recipe) {
        return res.status(404).json({ error: 'Recette non trouvée' });
    }
    const status = req.body.status; // attendu "terminée" ou "publiée"
    if (!status || (status !== 'terminée' && status !== 'publiée')) {
        return res.status(400).json({ error: 'Statut invalide. Utilisez "terminée" ou "publiée".' });
    }
    recipe.status = status;
    const nullCount = countNullFields(recipe);
    res.json({ message: 'Statut de la recette mis à jour', recipe, nullCount });
});


// Pour l'administrateur : récupérer la liste des utilisateurs
app.get('/api/users', checkAdmin, (req, res) => {
    res.json(users);
});

// Pour l'administrateur : modifier le rôle d'un utilisateur
app.put('/api/users/:id/role', checkAdmin, (req, res) => {
    const user = users.find(u => u.id == req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    user.role = req.body.role;
    res.json({ message: 'Rôle mis à jour', user });
});

// Interface de traduction (pour les Traducteurs)
// Seul le champ vide peut être modifié si l'équivalent dans l’autre langue est rempli.
app.put('/api/recipes/:id/translate', checkAuthenticated, (req, res) => {
    const user = req.session.user;
    if (user.role !== 'Traducteur' && user.role !== 'Chef' && user.role !== 'Administrateur') {
        return res.status(403).json({ error: 'Accès interdit' });
    }
    const recipe = recipes.find(r => r.id == req.params.id);
    if (!recipe) {
        return res.status(404).json({ error: 'Recette non trouvée' });
    }
    if (req.body.nameFR && (!recipe.nameFR || recipe.nameFR === "") && recipe.name) {
        recipe.nameFR = req.body.nameFR;
    }
    if (req.body.stepsFR && Array.isArray(req.body.stepsFR) && (!recipe.stepsFR || recipe.stepsFR.length === 0) && recipe.steps && recipe.steps.length > 0) {
        recipe.stepsFR = req.body.stepsFR;
    }
    if (req.body.ingredientsFR && Array.isArray(req.body.ingredientsFR) && (!recipe.ingredientsFR || recipe.ingredientsFR.length === 0) && recipe.ingredients && recipe.ingredients.length > 0 && recipe.ingredients.length === req.body.ingredientsFR.length) {
        recipe.ingredientsFR = req.body.ingredientsFR;
    }
    res.json({ message: 'Traduction mise à jour', recipe });
});

// Permet à un utilisateur connecté de demander une élévation de rôle (passer en DemandeChef ou DemandeTraducteur)
app.put('/api/updateRoleRequest', checkAuthenticated, (req, res) => {
    const user = req.session.user;
    // On autorise la modification uniquement si l'utilisateur est actuellement "Cuisinier"
    if (user.role !== 'Cuisinier') {
        return res.status(403).json({ error: 'Vous ne pouvez pas modifier votre rôle.' });
    }
    const demandeRole = req.body.demandeRole; // attendu : "chef" ou "trad"
    if (demandeRole === 'chef') {
        user.role = 'DemandeChef';
    } else if (demandeRole === 'trad') {
        user.role = 'DemandeTraducteur';
    } else {
        return res.status(400).json({ error: 'Rôle de demande non valide' });
    }
    // Mettre à jour l'utilisateur dans le tableau users
    const idx = users.findIndex(u => u.id === user.id);
    if(idx !== -1) {
        users[idx].role = user.role;
    }
    res.json({ message: 'Votre demande de rôle a été enregistrée', user });
});


// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
