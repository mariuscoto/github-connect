var CHAR_LIMIT = 380;

var express = require('express');
var mongoose = require('mongoose');
var Users = mongoose.model('Users');
var Ideas = mongoose.model('Ideas');
var IdeaComments = mongoose.model('IdeaComments');
var app = express();

exports.index = function(req, res) {
    Users.find (function (err, users, count) {
        res.render('index', { 
            title: "Welcome",
            users: users,
        });
    });
};

exports.login = function(req, res) {
    
    //app.locals.rep = global.repos;

    res.render('login', { 
        title: "Log in",
    });
};

exports.profile = function(req, res) {
    var uid, login;
    if (req.user) {
        uid = req.user.github.id;
        login = req.user.github.login;
    }
    if (req.query.id) uid = req.query.id;   
    
    // restrict /profile unless logged in or other user
    if (!req.user && !req.query.id) res.redirect('/login');
    else {
        Users.findOne ({ 'user_id': uid }, function (err, user) {
            if (!user) res.redirect('/login');
            else {
                //fetch ideas
                Ideas
                .find({ 'uid': uid })
                .sort('-date_post')
                .exec(function(err, ideas) {
                    res.render('profile', {
                        title: "User info",
                        login: login,
                        user: user,
                        ideas: ideas
                    });
                });
            }
        });
    }
};

exports.ideas = function(req, res) {
    var uid, login;
    var sort_type = null;
    if (req.query.sort == "most_recent") {
        sort_type = '-date_post';
    } else if (req.query.sort == "most_commented") {
        sort_type = '-date_post';
    }
    
    if (req.user) {
        uid = req.user.github.id;
        login = req.user.github.login;
    }

	Users.findOne ({ 'user_id': uid }, function (err, user) {
	    if (err) return handleError(err);

	    Ideas.find()
        .sort(sort_type)
        .exec(function(err, ideas) {
            for (var i=0; i<ideas.length; i++) {
                // mark favorites
                if (user != null && user.favorites.indexOf(ideas[i]._id) > -1)
                    ideas[i].fav = "yes";
                // format date
                ideas[i].date_post_short = (ideas[i].date_post.toString()).substring(0, 15);
                // shorten description
                if (ideas[i].description.length > CHAR_LIMIT)
                    ideas[i].description = (ideas[i].description).substring(0, CHAR_LIMIT) + " [...]";
            }
            res.render('ideas', {
                title: "Ideas",
                login: login,
                sort: req.query.sort,
                tab: "",
                ideas: ideas
            });
	    });
	});
};

exports.ideas_user = function(req, res) {
    var uid, login;
    var sort_type = null;
    if (req.query.sort == "most_recent") {
        sort_type = '-date_post';
    } else if (req.query.sort == "most_commented") {
        sort_type = '-comments_num';
    }
    
    if (req.user) {
        uid = req.user.github.id;
        login = req.user.github.login;
    }
    
    Ideas
    .find({ 'uid': uid })
    .sort(sort_type)
    .exec(function(err, ideas) {
        res.render('ideas', {
            title: "Ideas",
            login: login,
            sort: req.query.sort,
            tab: "/user",
            ideas: ideas
        });
    });
};

exports.ideas_favorites = function(req, res) {
    var uid, login;
    var sort_type = null;
    if (req.query.sort == "most_recent") {
        sort_type = '-date_post';
    } else if (req.query.sort == "most_commented") {
        sort_type = '-comments_num';
    }
    
    if (req.user) {
        uid = req.user.github.id;
        login = req.user.github.login;
    }
    
    Users.findOne ({ 'user_id': uid }, function (err, user) {
	   if (err) return handleError(err);

        Ideas
        .find({ _id: { $in: user.favorites }})
        .sort(sort_type)
        .exec(function(err, ideas) {
            if (ideas == null) {
                res.redirect('/ideas');
            } else {
                res.render('ideas', {
                    title: "fav ideas",
                    login: login,
                    tab: "/favorites",
                    ideas: ideas
                });
            }
        });
    });
};

exports.ideas_post = function(req, res) {
    var uid, login;
    if (req.user) {
        uid = req.user.github.id;
        login = req.user.github.login;
    } else res.redirect('/login');
    
    new Ideas({
        uid : uid,
        user_name : login,
        title : req.body.title,
        description : req.body.description,
        lang : req.body.lang,
        plan: req.body.plan,
        date_post: Date.now()
        }).save( function( err, todo, count ) {
            console.log(todo);
            console.log("* " + login + " added idea.");
            res.redirect('/ideas');
    });
};

exports.idea_comment = function(req, res) {
    var uid, login;
    if (req.user) {
        uid = req.user.github.id;
        login = req.user.github.login;
    } else res.redirect('/login');
    
    //console.log(req.query.id);
    // increment comments number
    var conditions = { _id: req.query.id };
    var update = {$inc: {comments_num: 1}};
    Ideas.update(conditions, update, callback);

    function callback (err, num) {
        new IdeaComments({
            uid: uid,
            user_name: login,
            idea: req.query.id,
            content: req.body.content,
            date: Date.now()
        }).save(function(err, comm, count) {
	    console.log("* " + login + " commented on " + req.query.id);
	    res.redirect('/idea?id=' + req.query.id);
	});
    };
};

exports.idea_add_fav = function(req, res) {
    var uid;
    if (req.user) {
        uid = req.user.github.id;
    } else res.redirect('/login');
    
    var conditions = {user_id: uid};
    var update = {$push: {favorites: req.query.id}};
    Users.update(conditions, update, callback);

    function callback (err, num) {
	res.redirect('/idea?id=' + req.query.id);
    }
};

exports.idea_remove_fav = function(req, res) {
    var uid;
    if (req.user) {
        uid = req.user.github.id;
    } else res.redirect('/login');
    
    var conditions = {user_id: uid};
    var update = {$pop: {favorites: req.query.id}};
    Users.update(conditions, update, callback);

    function callback (err, num) {
	res.redirect('/idea?id=' + req.query.id);
    }
};

exports.join_team = function(req, res) {
    var uid;
    if (req.user) {
        uid = req.user.github.id;
    } else res.redirect('/login');
    
    Users.findOne ({ 'user_id': uid }, function (err, user) {
	   if (err) return handleError(err);

        var conditions = {_id: req.query.id};
        var update = {$push: {team: user}};
        Ideas.update(conditions, update, callback);

        function callback (err, num) {
            res.redirect('/idea?id=' + req.query.id);
        }
    });
};

exports.idea = function(req, res) {
    if (!req.query.id) res.redirect('/ideas');
    
    var login, tab;
    if (req.user) login = req.user.github.login;
    
    if (req.route.path == "/idea/team") tab = "/team";
    else if (req.route.path == "/idea/plan") tab = "/plan";
    else res.redirect('/ideas')

	Ideas
    .findOne({ '_id': req.query.id })
    .exec(function(err, idea) {
        if (!idea) {
            res.redirect('/ideas');
        } else {
            IdeaComments
            .find({ 'idea': req.query.id })
            .exec(function(err, comments) {
                res.render('ideas', {
                    title: idea.title,
                    login: login,
                    idea: idea,
                    tab: tab,
                    comments: comments
                });
            });
        }
    });
};
