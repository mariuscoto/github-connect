var CHAR_LIMIT = 330;

var express = require('express');
var mongoose = require('mongoose');
var Users = mongoose.model('Users');
var Ideas = mongoose.model('Ideas');
var Projects = mongoose.model('Projects');
var IdeaComments = mongoose.model('IdeaComments');
var markdown = require( "markdown" ).markdown;
var app = express();


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
					ideas[i].fav = true;
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
		.find({ 'uid': user.user_id })
		.sort(sort_type)
		.exec(function(err, ideas) {
      for (var i=0; i<ideas.length; i++) {
				// mark favorites
				if (user != null && user.favorites.indexOf(ideas[i]._id) > -1)
					ideas[i].fav = true;
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
      for (var i=0; i<ideas.length; i++) {
				// mark favorites
				if (user != null && user.favorites.indexOf(ideas[i]._id) > -1)
					ideas[i].fav = true;
				// format date
				ideas[i].date_post_short = (ideas[i].date_post.toString()).substring(0, 15);
				// shorten description
				if (ideas[i].description.length > CHAR_LIMIT)
					ideas[i].description = (ideas[i].description).substring(0, CHAR_LIMIT) + " [...]";
			}
      
      if (ideas == null) {
        res.redirect('/ideas');
      } else {
        res.render('ideas', {
          title: "fav ideas",
          user: user,
          sort: req.query.sort,
          tab: "/favorites",
          ideas: ideas
        });
      }
    });
  });
};

exports.ideas_post = function(req, res) {
  if (!req.user) res.redirect('/login');
  
  // add idea only if it has a title and description
  if (req.body.title && req.body.description)
    new Ideas({
      uid : req.user.github.id,
      user_name : req.user.github.login,
      title : req.body.title,
      description : req.body.description,
      lang : req.body.lang,
      plan: req.body.plan,
      date_post: Date.now(),
      points: 5
      }).save( function( err, todo, count ) {
      

        // post to facebook
      	var options = {
          host: "graph.facebook.com",
          path: "/" + global.config.facebook_id + "/feed?message=" + req.body.description + "&access_token=" + global.config.facebook_token,
          method: "POST",
        };
        var https = require('https');
        var request = https.request(options, function(response){
          var body = '';
          response.on("data", function(chunk){ body+=chunk.toString("utf8"); });
          response.on("end", function(){
            console.log("* Idea posted to facebook page.");
          });				
        });
        request.end();
        
        //var conditions = { _id: req.query.id };
        //var update = {$inc: {points: 5}};
        //Ideas.update(conditions, update, function(err, num) {
    //console.log(num);});

        var conditions = {user_id: req.user.github.id};
        var update = {$inc: {points_ideas: 5}};
        Users.update(conditions, update, callback);
        
        function callback (err, num) {
          console.log("* Added points " + num);
        }

        console.log("* " + req.user.github.login + " added idea.");
        res.redirect('/ideas');
    });
  else
    res.redirect('/ideas');
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
		res.json({success: true});
  }
};

exports.idea_remove_fav = function(req, res) {
	if (!req.user) res.redirect('/login');
  
  var conditions = {user_id: req.user.github.id};
  var update = {$pop: {favorites: req.query.id}};
  Users.update(conditions, update, callback);

  function callback (err, num) {
		res.json({success: true});
  }
};

exports.join_team = function(req, res) {
	if (!req.user) res.redirect('/login');

  var conditions = {_id: req.query.id};
  var update = {$addToSet: {team: req.user.github.id}, $inc: {points: 20}};
  Ideas.update(conditions, update, callback);

  var conditions = {user_id: req.user.github.id};
  var update = {$inc: {points_ideas: 15}};
  Users.update(conditions, update);

  function callback (err, num) {
    res.redirect('/idea?id=' + req.query.id);
  }
};

exports.idea = function(req, res) {
  if (!req.query.id) res.redirect('/ideas');
  
  var tab, team;  
  if (req.route.path == "/idea-team") tab = "/team";
  else if (req.route.path == "/idea-plan") tab = "/plan";
  else if (req.route.path == "/idea-plan-edit") tab = "/plan-edit";
  else if (req.route.path == "/idea-settings") tab = "/settings";

  Ideas
	.findOne({ '_id': req.query.id })
	.exec(function(err, idea) {
		if (!idea) {
			res.redirect('/ideas');
		} else {
      
      // Markdown idea plan
      idea.plan_md = markdown.toHTML(idea.plan);
      
      Users.findOne({ 'user_name': idea.user_name}, function (err, cuser) {
        if (err) return handleError(err);
        
        // prettify date
        cuser.last_seen_short = (cuser.last_seen.toString()).substring(0, 15);

        Users.find({ 'user_id': idea.team }, function(err, project_team) {
          if (err) return handleError(err);
        
          IdeaComments
          .find({ 'idea': req.query.id })
          .exec(function(err, comments) {

            if (req.user)
              Users.findOne ({ 'user_id': req.user.github.id }, function (err, user) {
                if (err) return handleError(err);
                
                // see if user joined team
                if (user && idea.team.indexOf(user.user_id) > -1)
                  user.joined = true;
                // see if user faved idea
                if (user && user.favorites.indexOf(idea._id) > -1)
                  user.faved = true;
                
                if (user) {
                  for (i in comments) {
                    // check for already voted comments
                    if (comments[i].upvotes.indexOf(user.user_id) > -1)
                      comments[i].upvote = true;                
                    // check for flagged comments
                    if (comments[i].flags.indexOf(user.user_id) > -1)
                      comments[i].flag = true;
                  }
                }

                res.render('ideas', {
                  title: idea.title,
                  cuser: cuser,
                  user: user,
                  team: project_team,
                  idea: idea,
                  tab: tab,
                  comments: comments
                });
              });

            else
              res.render('ideas', {
                title: idea.title,
                idea: idea,
                cuser: cuser,
                team: project_team,
                tab: tab,
                comments: comments
              });
          });
        });
      });
		}
	});
};

exports.idea_edit = function(req, res) {
  if (!req.user) res.redirect('/ideas');

  Ideas
	.findOne({ '_id': req.query.id })
	.exec(function(err, idea) {
    // allow only edits by owner
    if (idea.uid != req.user.github.id) res.redirect('/ideas');
        
    // apply changes
    var conditions = {_id: req.query.id};
    var update = {$set: {description: req.body.description, lang : req.body.lang}};
    Ideas.update(conditions, update, callback);
    function callback (err, num) {
      console.log("* " + req.user.github.login + " made changes to " + req.query.id);
      res.redirect('/idea?id=' + req.query.id);
    };
  });
};

exports.idea_plan_edit = function(req, res) {
  if (!req.user) res.redirect('/ideas');

  Ideas
	.findOne({ '_id': req.query.id })
	.exec(function(err, idea) {
    // allow only edits by owner
    if (idea.uid != req.user.github.id) res.redirect('/ideas');
        
    // apply changes
    var conditions = {_id: req.query.id};
    var update = {$set: {plan: req.body.plan}};
    Ideas.update(conditions, update, callback);
    function callback (err, num) {
      console.log("* " + req.user.github.login + " made changes to plan " + req.query.id);
      res.redirect('/idea-plan?id=' + req.query.id);
    };
  });
};

exports.upvote = function(req, res) {
  if (!req.user) res.json({success: false});
  else {
    // increment upvotes number
    var conditions = {_id: req.query.id};
    var update = {$addToSet: {upvotes: req.user.github.id}};
    IdeaComments.update(conditions, update, callback);
    function callback (err, num) {
      console.log("* " + req.user.github.login + " upvoted on " + req.query.id);
      res.json({success: true});
    };
  }
};

exports.flag = function(req, res) {
  if (!req.user) res.json({success: false});
  else {
    // increment flags number
    var conditions = {_id: req.query.id};
    var update = {$addToSet: {flags: req.user.github.id}};
    IdeaComments.update(conditions, update, callback);
    function callback (err, num) {
      console.log("* " + req.user.github.login + " flagged " + req.query.id);
      res.json({success: true});
    };
  }
};
