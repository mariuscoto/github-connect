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
    var sort_type = null;
    if (req.query.sort == "most_recent") {
        sort_type = '-date_post';
    } else if (req.query.sort == "most_commented") {
        sort_type = '-date_post';
    }

	Users.findOne ({ 'user_id': global.id }, function (err, user) {
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
                sort: req.query.sort,
                tab: "",
                ideas: ideas
            });
	    });
	});
};

exports.ideas_user = function(req, res) {
    if (req.query.sort == "most_recent") {
        Ideas
	    .find({ 'uid': global.id })
	    .sort('-date_post')
	    .exec(function(err, ideas) {
		res.render('ideas', {
		    title: "Ideas",
            sort: "most_recent",
		    tab: "/user",
		    ideas: ideas
		});
	    });

    } else if (req.query.sort == "most_commented") {
        Ideas
	    .find({ 'uid': global.id })
	    .sort('-comments_num')
	    .exec(function(err, ideas) {
		res.render('ideas', {
		    title: "Ideas",
            sort: "most_commented",
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
            sort: "most visited",
			tab: "/user",
			ideas: ideas
		    });
		}
	    });
    }
};

exports.ideas_favorites = function(req, res) {
    Users.findOne ({ 'user_id': global.id }, function (err, user) {
	if (err) return handleError(err);

    if (req.query.sort == "most_recent") {
	Ideas
	    .find({ _id: { $in: user.favorites }})
	    .sort('-date_post')
	    .exec(function(err, ideas) {
		if (ideas == null) {
		    res.redirect('/ideas');
		} else {
		    res.render('ideas', {
			title: "fav ideas",
			tab: "/favorites",
			ideas: ideas
		    });
		}
	    });

    } else if (req.query.sort == "most_commented") {
	Ideas
	    .find({ _id: { $in: user.favorites }})
	    .sort('-comments_num')
	    .exec(function(err, ideas) {
		if (ideas == null) {
		    res.redirect('/ideas');
		} else {
		    res.render('ideas', {
			title: "fav ideas",
			tab: "/favorites",
			ideas: ideas
		    });
		}
	    });

    } else {
	Ideas
	    .find({ _id: { $in: user.favorites }})
	    .exec(function(err, ideas) {
		if (ideas == null) {
		    res.redirect('/ideas');
		} else {
		    res.render('ideas', {
			title: "fav ideas",
			tab: "/favorites",
			ideas: ideas
		    });
		}
	    });
    }
    });
};

exports.ideas_post = function(req, res) {
    new Ideas({
        uid : global.id,
        user_name : global.username,
        title : req.body.title,
        description : req.body.description,
        lang : req.body.lang,
        plan: req.body.plan,
        date_post: Date.now()
        }).save( function( err, todo, count ) {
        console.log("* New idea added.");
        res.redirect('/ideas');
    });
};

exports.idea_comment = function(req, res) {
    // increment comments number
    var conditions = { _id: req.query.id };
    var update = {$inc: {comments_num: 1}};
    Ideas.update(conditions, update, callback);

    function callback (err, num) {
        new IdeaComments({
	    uid: global.id,
        user_name: global.username,
	    idea: req.query.id,
	    content: req.body.content,
	    date: Date.now()
	}).save(function(err, comm, count) {
	    console.log("* "+global.username+" commented on "+req.query.id);
	    res.redirect('/idea?id=' + req.query.id);
	});
    };
};

exports.idea_add_fav = function(req, res) {
    var conditions = {user_id: global.id};
    var update = {$push: {favorites: req.query.id}};
    Users.update(conditions, update, callback);

    function callback (err, num) {
	res.redirect('/idea?id=' + req.query.id);
    }
};

exports.idea_remove_fav = function(req, res) {
    var conditions = {user_id: global.id};
    var update = {$pop: {favorites: req.query.id}};
    Users.update(conditions, update, callback);

    function callback (err, num) {
	res.redirect('/idea?id=' + req.query.id);
    }
};

exports.join_team = function(req, res) {

    Users.findOne ({ 'user_id': global.id }, function (err, user) {
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
    if (req.query.id != null) {
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
	res.redirect('/ideas');
    }
};

exports.idea_team = function(req, res) {
    if (req.query.id != null) {
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
				tab: "/team",
			    });
			});
		}
	    });

    } else {
	res.redirect('/ideas');
    }
};

exports.idea_plan = function(req, res) {
    if (req.query.id != null) {
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
				tab: "/plan",
			    });
			});
		}
	    });

    } else {
	res.redirect('/ideas');
    }
};
