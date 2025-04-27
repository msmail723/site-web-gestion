// public/js/main.js
$(document).ready(function(){
    let currentLanguage = 'en'; // langue par défaut
    let currentRecipeId = null; // pour mémoriser l'ID de la recette affichée en détail
    let currentUser = null;

    // Vérifier l'authentification de l'utilisateur
    function checkAuth() {
        $.get('/api/currentUser', function(data){
            if(data.user) {
                currentUser = data.user;
                $('#auth-section').hide();
                $('#user-info').html('Connecté en tant que ' + data.user.username + ' (' + data.user.role + ')');
                $('#recipes-section').show();
            } else {
                currentUser = null;
                $('#auth-section').show();
                $('#recipes-section').hide();
            }
        });
    }
    
    
    checkAuth();
    
    // Connexion
    $('#login-form').submit(function(e){
        e.preventDefault();
        $.post('/api/login', $(this).serialize(), function(data){
            checkAuth();
        }).fail(function(err){
            alert(err.responseJSON.error);
        });
    });
    
    // Inscription
    $('#register-form').submit(function(e){
        e.preventDefault();
        $.post('/api/register', $(this).serialize(), function(data){
            checkAuth();
        }).fail(function(err){
            alert(err.responseJSON.error);
        });
    });
    
    // Déconnexion
    $('#logout-link').click(function(e){
        e.preventDefault();
        $.get('/api/logout', function(data){
            location.reload();
        });
    });

    // Fonction pour charger les infos du profil de l'utilisateur connecté
    function loadProfile() {
        $.get('/api/currentUser', function(data){
            if(data.user) {
                $('#profile-info').html(
                    'Nom d\'utilisateur: ' + data.user.username + '<br>' +
                    'Rôle actuel: ' + data.user.role
                );
            }
        });
    }
    
    // Navigation entre sections
    $('.nav-link').click(function(e){
        e.preventDefault();
        let section = $(this).data('section');
        $.get('/api/currentUser', function(data){
            if (!data.user) {
                // Si l'utilisateur n'est pas connecté, on affiche la section d'authentification et on alerte
                $('main section').hide();
                $('#auth-section').show();
                alert('Veuillez vous connecter pour accéder à cette section.');
            } else {
                // Si l'utilisateur est connecté, on affiche la section demandée
                $('main section').hide();
                $('#' + section).show();
                if(section === 'recipes-section'){
                    loadRecipes();
                }
                if(section === 'users-section'){
                    loadUsers();
                }
                if(section === 'profile-section'){
                    loadProfile();
                }
                if(section === 'admin-recipes-section'){
                    loadAdminRecipes();
                }
            }
        });
    });
    
    
    // Basculement de la langue
    $('#lang-toggle').click(function(){
        currentLanguage = (currentLanguage === 'en') ? 'fr' : 'en';
        // Si on est en vue détaillée et qu'une recette est sélectionnée, recharger ses détails
        if($('#recipe-details-section').is(':visible') && currentRecipeId) {
            loadRecipeDetails(currentRecipeId);
        } else {
            loadRecipes();
        }
    });
    
    // Chargement des recettes
    function loadRecipes() {
        const query = $('#search-input').val() || '';
        $.get('/api/recipes', { q: query, language: currentLanguage }, function(data){
            $('#recipes-list').empty();
            data.forEach(function(recipe){
                const title = (currentLanguage === 'en') ? recipe.name : recipe.nameFR;
                const item = $('<div class="recipe-item"></div>');
                // Ajout de l'image si disponible
                if (recipe.imageURL) {
                    const img = $('<img>')
                        .attr('src', recipe.imageURL)
                        .attr('alt', title + ' photo')
                        .css({
                            'width': '150px',
                            'height': 'auto',
                            'margin-right': '10px'
                        });
                    item.append(img);
                }
                // Affichage de l'ID de la recette
                item.append('<p>ID: ' + recipe.id + '</p>');
                // Affichage du titre
                item.append('<h3>' + title + '</h3>');
                item.data('id', recipe.id);
                $('#recipes-list').append(item);
            });
        });
    }

    // Bouton Rechercher : affiche la section recettes et lance la recherche
    $('#search-button').click(function(){
        loadRecipes();
    });

    
    
    // Fonction de chargement des détails d'une recette
    function loadRecipeDetails(id) {
        $.get('/api/recipes/' + id, function(data){
            const recipe = data.recipe;
            let html = '<h3>' + (currentLanguage === 'en' ? recipe.name : (recipe.nameFR ? recipe.nameFR : "Traduction non disponible")) + '</h3>';
            html += '<p>ID: ' + recipe.id + '</p>';
            html += '<p>Auteur: ' + recipe.author + '</p>';
            html += '<p>Temps total: ' + data.totalTime + ' minutes</p>';
            html += '<p>Statut: ' + (recipe.status ? recipe.status : "Non défini") + '</p>';
            
            if(recipe.steps) {
                html += '<h4>Étapes:</h4><ol>';
                const steps = (currentLanguage === 'en') ? recipe.steps : (recipe.stepsFR ? recipe.stepsFR : ["Traduction non disponible"]);
                steps.forEach(function(step){
                    html += '<li>' + step + '</li>';
                });
                html += '</ol>';
            }
            
            if(recipe.ingredients) {
                html += '<h4>Ingrédients:</h4><ul>';
                const ingredients = (currentLanguage === 'en') ? recipe.ingredients : (recipe.ingredientsFR ? recipe.ingredientsFR : ["Traduction non disponible"]);
                ingredients.forEach(function(ing){
                    if (typeof ing === "object") {
                        html += '<li>' + ing.quantity + ' ' + (ing.name ? ing.name : "Traduction non disponible") + '</li>';
                    } else {
                        html += '<li>' + ing + '</li>';
                    }
                });
                html += '</ul>';
            }
            
            if(recipe.comments) {
                html += '<h4>Commentaires:</h4><ul>';
                recipe.comments.forEach(function(comment){
                    html += '<li>' + comment.user + ': ' + comment.text + '</li>';
                });
                html += '</ul>';
            }
            
            // Si l'utilisateur est connecté, on affiche le formulaire de commentaire et le bouton "like"
            if(currentUser) {
                html += '<h4>Ajouter un commentaire :</h4>';
                html += '<form id="comment-form">';
                html += '<input type="text" name="text" placeholder="Votre commentaire" required>';
                html += '<button type="submit">Envoyer</button>';
                html += '</form>';
                html += '<button id="like-button">❤️ Ajouter un coeur</button>';
            }
            
            $('#recipe-details').html(html);
            
            // Gestionnaire pour l'ajout de commentaire
            $('#comment-form').submit(function(e){
                e.preventDefault();
                const commentText = $(this).find('input[name="text"]').val();
                $.ajax({
                    url: '/api/recipes/' + id + '/comments',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ text: commentText }),
                    success: function(data){
                        alert('Commentaire ajouté');
                        loadRecipeDetails(id); // Recharge les détails pour afficher le nouveau commentaire
                    },
                    error: function(err){
                        alert(err.responseJSON.error);
                    }
                });
            });
            
            // Gestionnaire pour l'ajout d'un "coeur" (like)
            $('#like-button').click(function(){
                $.post('/api/recipes/' + id + '/like', function(data){
                    alert('Recette aimée. Total des coeurs: ' + data.likes);
                    loadRecipeDetails(id); // Recharge pour mettre à jour le nombre de likes si vous l'affichez
                }).fail(function(err){
                    alert(err.responseJSON.error);
                });
            });
        });
    }

    function loadAdminRecipes() {
        // Ici on récupère toutes les recettes en anglais pour simplifier (vous pouvez adapter pour afficher les deux versions si nécessaire)
        $.get('/api/recipes', { language: 'en' }, function(data){
            $('#admin-recipes-list').empty();
            data.forEach(function(recipe) {
                const container = $('<div class="admin-recipe-item"></div>');
                container.append('<p>ID: ' + recipe.id + '</p>');
                container.append('<p>Titre: ' + recipe.name + '</p>');
                container.append('<p>Auteur: ' + recipe.author + '</p>');
                container.append('<p>Statut: ' + (recipe.status || 'en cours') + '</p>');
                
                // Bouton Supprimer
                const deleteBtn = $('<button>Supprimer</button>');
                deleteBtn.click(function(){
                    if(confirm('Confirmer la suppression de la recette ' + recipe.id + ' ?')) {
                        $.ajax({
                            url: '/api/recipes/' + recipe.id,
                            type: 'DELETE',
                            success: function(data) {
                                alert('Recette supprimée');
                                loadAdminRecipes();
                            },
                            error: function(err) {
                                alert(err.responseJSON.error);
                            }
                        });
                    }
                });
                container.append(deleteBtn);
                
                // Bouton Modifier (exemple simple pour modifier le titre)
                const modifyBtn = $('<button>Modifier</button>');
                modifyBtn.click(function(){
                    const newTitle = prompt('Nouveau titre (anglais) pour la recette ' + recipe.id + ':', recipe.name);
                    if(newTitle !== null) {
                        $.ajax({
                            url: '/api/recipes/' + recipe.id,
                            type: 'PUT',
                            contentType: 'application/json',
                            data: JSON.stringify({ name: newTitle }),
                            success: function(data) {
                                alert('Recette modifiée');
                                loadAdminRecipes();
                            },
                            error: function(err) {
                                alert(err.responseJSON.error);
                            }
                        });
                    }
                });
                container.append(modifyBtn);
                
                // Bouton pour mettre à jour le statut
                const statusBtn = $('<button>Mettre à jour statut</button>');
                statusBtn.click(function(){
                    const newStatus = prompt('Nouveau statut ("terminée" ou "publiée") pour la recette ' + recipe.id + ':', recipe.status || 'en cours');
                    if(newStatus !== null && (newStatus === 'terminée' || newStatus === 'publiée')) {
                        $.ajax({
                            url: '/api/recipes/' + recipe.id + '/status',
                            type: 'PUT',
                            contentType: 'application/json',
                            data: JSON.stringify({ status: newStatus }),
                            success: function(data) {
                                alert('Statut mis à jour (champs manquants : ' + data.nullCount + ')');
                                loadAdminRecipes();
                            },
                            error: function(err) {
                                alert(err.responseJSON.error);
                            }
                        });
                    } else {
                        alert('Statut invalide. Veuillez saisir "terminée" ou "publiée".');
                    }
                });
                container.append(statusBtn);
                
                container.append('<hr>');
                $('#admin-recipes-list').append(container);
            });
        });
    }
    
    
    // Afficher les détails d'une recette
    $('#recipes-list').on('click', '.recipe-item', function(){
        const id = $(this).data('id');
        currentRecipeId = id;  // Mémoriser l'ID de la recette affichée
        loadRecipeDetails(id);
        $('main section').hide();
        $('#recipe-details-section').show();
    });
    
    // Retour à la liste des recettes
    $('#back-to-list').click(function(){
        $('main section').hide();
        $('#recipes-section').show();
    });
    
    // Soumission d'une nouvelle recette (pour Chefs)
    $('#submit-recipe-form').submit(function(e){
        e.preventDefault();
        const formData = $(this).serializeArray();
        let recipe = {};
        formData.forEach(item => {
            recipe[item.name] = item.value;
        });
        if(recipe.steps) {
            recipe.steps = recipe.steps.split('\n').filter(line => line.trim() !== '');
        }
        if(recipe.stepsFR) {
            recipe.stepsFR = recipe.stepsFR.split('\n').filter(line => line.trim() !== '');
        }
        $.ajax({
            url: '/api/recipes',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(recipe),
            success: function(data){
                alert('Recette ajoutée');
                $('#submit-recipe-form')[0].reset();
            },
            error: function(err){
                alert(err.responseJSON.error);
            }
        });
    });
    
    // Soumission du formulaire de traduction (pour Traducteurs)
    $('#translation-form').submit(function(e){
        e.preventDefault();
        const formData = $(this).serializeArray();
        let translation = {};
        let recipeId;
        formData.forEach(item => {
            if(item.name === 'recipeId') {
                recipeId = item.value;
            } else {
                translation[item.name] = item.value;
            }
        });
        if(translation.stepsFR) {
            translation.stepsFR = translation.stepsFR.split('\n').filter(line => line.trim() !== '');
        }
        $.ajax({
            url: '/api/recipes/' + recipeId + '/translate',
            type: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify(translation),
            success: function(data){
                alert('Traduction mise à jour');
                $('#translation-form')[0].reset();
            },
            error: function(err){
                alert(err.responseJSON.error);
            }
        });
    });

    // Soumission du formulaire de demande de rôle (pour mise à jour du profil)
    $('#role-request-form').submit(function(e){
        e.preventDefault();
        const formData = $(this).serialize();
        $.ajax({
            url: '/api/updateRoleRequest',
            type: 'PUT',
            data: formData,
            success: function(data){
                alert('Votre demande a été enregistrée.');
                loadProfile(); // Recharger les infos du profil pour afficher le nouveau rôle
            },
            error: function(err){
                alert(err.responseJSON.error);
            }
        });
    });

    // Soumission du formulaire de gestion des statuts de recette (pour l'administrateur)
    $('#manage-recipe-status-form').submit(function(e){
        e.preventDefault();
        const formData = $(this).serializeArray();
        let recipeId, status;
        formData.forEach(item => {
            if(item.name === 'recipeId'){
               recipeId = item.value;
            } else if(item.name === 'status'){
                status = item.value;
            }
        });
        $.ajax({
            url: '/api/recipes/' + recipeId + '/status',
            type: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ status: status }),
            success: function(data){
                alert('Statut mis à jour: ' + data.recipe.status + '. Nombre de champs manquants: ' + data.nullCount);
            },
            error: function(err){
                alert(err.responseJSON.error);
            }
        });
    });


    
    // Chargement des utilisateurs (pour l'Admin)
    function loadUsers() {
        $.get('/api/users', function(data){
            $('#users-list').empty();
            data.forEach(function(user){
                const userDiv = $('<div></div>');
                userDiv.html('ID: ' + user.id + ' - ' + user.username + ' (' + user.role + ') ');
                const roleInput = $('<input type="text" placeholder="Nouveau rôle">');
                const updateBtn = $('<button>Mettre à jour</button>');
                updateBtn.click(function(){
                    const newRole = roleInput.val();
                    $.ajax({
                        url: '/api/users/' + user.id + '/role',
                        type: 'PUT',
                        contentType: 'application/json',
                        data: JSON.stringify({ role: newRole }),
                        success: function(data){
                            alert('Rôle mis à jour');
                            loadUsers();
                        },
                        error: function(err){
                            alert(err.responseJSON.error);
                        }
                    });
                });
                userDiv.append(roleInput).append(updateBtn);
                $('#users-list').append(userDiv);
            });
        });
    }
});
