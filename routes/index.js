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
	    rep: global.repos
	});
    });
};

exports.login = function(req, res) {
    
    app.locals.rep = global.repos;

    res.render('login', { 
        title: "Log in",
    });
};

exports.ideas = function(req, res) {
    if (req.query.sort == "most_recent") {
        Ideas
	    .find()
	    .sort('-date_post')
	    .exec(function(err, ideas) {
		res.render('ideas', {
		    title: "Ideas",
		    tab: "",
		    ideas: ideas
		});
	    });

    } else if (req.query.id != null) {
	Ideas
	    .findOne({ '_id': req.query.id })
	    .exec(function(err, idea) {
		if (idea == null) {
		    res.redirect('/ideas');
		} else {

		    IdeaComments
			.find({ 'idea': req.query.id })
			.exec(function(err, comments) {
			    res.render('ideas', {
				title: idea.title,
				idea: idea,
				tab: "",
				comments: comments
			    });
			});
		}
	    });

    } else {

	Ideas.find (function (err, ideas, count) {
	res.render('ideas', {
	    title: "Ideas",
	    tab: "",
	    ideas: ideas
	});
    });
    }
};

exports.ideas_user = function(req, res) {
    if (req.query.sort == "most_recent") {
        Ideas
	    .find({ 'uid': global.id })
	    .sort('-date_post')
	    .exec(function(err, ideas) {
		res.render('ideas', {
		    title: "Ideas",
		    tab: "/user",
		    ideas: ideas
		});
	    });
    } else {
	Ideas
	    .find({ 'uid': global.id })
	    .exec(function(err, ideas) {
		if (ideas == null) {
		    res.redirect('/ideas');
		} else {
		    res.render('ideas', {
			title: "user ideas",
			tab: "/user",
			ideas: ideas
		    });
		}
	    });
    }
};

exports.ideas_post = function(req, res) {
    new Ideas({
	uid : global.id,
	title : req.body.title,
	description : req.body.description,
	plan: req.body.plan,
	date_post: Date.now()
    }).save( function( err, todo, count ) {
	console.log("* New idea added.");
	res.redirect('/ideas');
    });
};

exports.idea_comments = function(req, res) {
    new IdeaComments({
	uid: req.body.who,
	idea: req.body.where,
	content: req.body.content,
	date: Date.now()
    }).save(function(err, comm, count) {
	console.log("* New comment added.");
	res.redirect('/ideas?id=' + req.body.where);
    });
};

exports.profile = function(req, res) {
    Users.findOne ({ 'user_id': global.id }, function (err, user) {
	if (err) return handleError(err);
	res.render('profile', {
	    title: "User profile",
	    user: user
	});
    });
};
