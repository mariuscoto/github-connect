var CHAR_LIMIT = 380;

var express = require('express');
var mongoose = require('mongoose');
var Users = mongoose.model('Users');
var Ideas = mongoose.model('Ideas');
var IdeaComments = mongoose.model('IdeaComments');
var app = express();

exports.index = function(req, res) {
	var uid;
  if (req.user) uid = req.user.github.id;
	
  Users.find (function (err, users, count) {
    Ideas.find (function (err, ideas, count) {
			
			var user = null;
			if (req.user) uid = req.user.github.id;
			
			Users.findOne ({ 'user_id': uid }, function (err, user) {
				if (err) return handleError(err);

				res.render('index', { 
					title: "Welcome to Github-connect",
					user: user,
					users: users.length,
					ideas: ideas.length,
					projects: 0
				});
			});
    });
  });
};

exports.login = function(req, res) {
  
	if (req.user) res.redirect('/profile');

  res.render('login', { 
    title: "Log in",
  });
};

exports.profile = function(req, res) {
  //console.log(req.session.oauth);
  var cuid, uid;
  if (req.user) {
		cuid = req.user.github.id;
		uid = cuid;
	}	
  if (req.query.id) cuid = req.query.id;   
  
  // restrict /profile unless logged in or other user
  if (!req.user && !req.query.id) res.redirect('/login');
  else {
    Users.findOne ({ 'user_id': cuid }, function (err, cuser) {
      if (!cuser) res.redirect('/login');
      
      else {      
				Users.findOne ({ 'user_id': uid }, function (err, user) {
					Ideas
					.find({ 'uid': cuid })
					.sort('-date_post')
					.exec(function(err, ideas) {
						res.render('profile', {
							title: "User info",
							cuser: cuser,
							ideas: ideas,
							user: user
						});
					});
				});
      }
    });
  }
};

exports.ideas = function(req, res) {
  var uid;
  var sort_type = null;
  if (req.query.sort == "most_recent") {
    sort_type = '-date_post';
  } else if (req.query.sort == "most_commented") {
    sort_type = '-date_post';
  }
  
  if (req.user) uid = req.user.github.id;

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
				user: user,
				sort: req.query.sort,
				tab: "",
				ideas: ideas
			});
		});
	});
};

exports.ideas_user = function(req, res) {
  var sort_type = null;
  if (req.query.sort == "most_recent") {
    sort_type = '-date_post';
  } else if (req.query.sort == "most_commented") {
    sort_type = '-comments_num';
  }
  
  Users.findOne ({ 'user_id': req.user.github.id }, function (err, user) {
    if (err) return handleError(err);
		
		Ideas
		.find({ 'uid': uid })
		.sort(sort_type)
		.exec(function(err, ideas) {
			res.render('ideas', {
				title: "Ideas",
				user: user,
				sort: req.query.sort,
				tab: "/user",
				ideas: ideas
			});
		});
	});
};

exports.ideas_favorites = function(req, res) {
  var sort_type = null;
  if (req.query.sort == "most_recent") {
    sort_type = '-date_post';
  } else if (req.query.sort == "most_commented") {
    sort_type = '-comments_num';
  }
    
  Users.findOne ({ 'user_id': req.user.github.id }, function (err, user) {
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
          user: user,
          tab: "/favorites",
          ideas: ideas
        });
      }
    });
  });
};

exports.ideas_post = function(req, res) {
  if (!req.user) res.redirect('/login');
  
  new Ideas({
    uid : req.user.github.id,
    user_name : req.user.github.login,
    title : req.body.title,
    description : req.body.description,
    lang : req.body.lang,
    plan: req.body.plan,
    date_post: Date.now()
    }).save( function( err, todo, count ) {
      console.log("* " + req.user.github.login + " added idea.");
      res.redirect('/ideas');
  });
};

exports.idea_comment = function(req, res) {
  if (!req.user) res.redirect('/login');
  
  // increment comments number
  var conditions = { _id: req.query.id };
  var update = {$inc: {comments_num: 1}};
  Ideas.update(conditions, update, callback);

  function callback (err, num) {
    new IdeaComments({
      uid: req.user.github.id,
      user_name: req.user.github.login,
      idea: req.query.id,
      content: req.body.content,
      date: Date.now()
    }).save(function(err, comm, count) {
			console.log("* " + req.user.github.login + " commented on " + req.query.id);
			res.redirect('/idea?id=' + req.query.id);
 		});
  };
};

exports.idea_add_fav = function(req, res) {
	if (!req.user) res.redirect('/login');
  
  var conditions = {user_id: req.user.github.id};
  var update = {$push: {favorites: req.query.id}};
  Users.update(conditions, update, callback);

  function callback (err, num) {
		res.redirect('/idea?id=' + req.query.id);
  }
};

exports.idea_remove_fav = function(req, res) {
	if (!req.user) res.redirect('/login');
  
  var conditions = {user_id: req.user.github.id};
  var update = {$pop: {favorites: req.query.id}};
  Users.update(conditions, update, callback);

  function callback (err, num) {
		res.redirect('/idea?id=' + req.query.id);
  }
};

exports.join_team = function(req, res) {
	if (!req.user) res.redirect('/login');
  
  Users.findOne ({ 'user_id': req.user.github.id }, function (err, user) {
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
  
  var tab;  
  if (req.route.path == "/idea/team") tab = "/team";
  else if (req.route.path == "/idea/plan") tab = "/plan";

	Ideas
	.findOne({ '_id': req.query.id })
	.exec(function(err, idea) {
		if (!idea) {
			res.redirect('/ideas');
		} else {

			IdeaComments
			.find({ 'idea': req.query.id })
			.exec(function(err, comments) {
				if (req.user)
					Users.findOne ({ 'user_id': req.user.github.id }, function (err, user) {
						if (err) return handleError(err);
						
						res.render('ideas', {
							title: idea.title,
							user: user,
							idea: idea,
							tab: tab,
							comments: comments
						});
					});
					
				else
					res.render('ideas', {
						title: idea.title,
						idea: idea,
						tab: tab,
						comments: comments
					});
			});
		}
	});
};

exports.contact = function(req, res) {
	if (req.user)
		Users.findOne ({ 'user_id': req.user.github.id }, function (err, user) {
			if (err) return handleError(err);
			
			res.render('contact', { 
				title: "Get in touch with us",
				user: user
			});
		});
									 
	else
		res.render('contact', { 
			title: "Get in touch with us"
		});
};

exports.projects = function(req, res) {
	if (req.user)
		Users.findOne ({ 'user_id': req.user.github.id }, function (err, user) {
			if (err) return handleError(err);
			
			res.render('projects', { 
				title: "Projects page",
				user: user
			});
		});
									 
	else
		res.render('projects', { 
			title: "Projects page"
		});
};

exports.faq = function(req, res) {
	if (req.user)
		Users.findOne ({ 'user_id': req.user.github.id }, function (err, user) {
			if (err) return handleError(err);
			
			res.render('faq', { 
				title: "F.A.Q.",
				user: user
			});
		});
									 
	else
		res.render('faq', { 
			title: "F.A.Q"
		});
};
