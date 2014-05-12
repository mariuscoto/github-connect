var POINTS = require('../model/points.js')
var core = require('../core.js')
var express = require('express');
var mongoose = require('mongoose');
var Users = mongoose.model('Users');
var Ideas = mongoose.model('Ideas');
var Projects = mongoose.model('Projects');
var IdeaComments = mongoose.model('IdeaComments');
var Notifications = mongoose.model('Notifications');
var markdown = require( "markdown" ).markdown;


/*
Get the list of all ideas, favorites or personal,
based on URL and sort them by GET argument.
*/
exports.index = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  var _self = {};
  var sort_type = null;
  if (req.query.sort == 'most_recent') {
    sort_type = '-date_post';
  } else if (req.query.sort == 'most_commented') {
    sort_type = '-comments_num';
  }

  Users.findOne({'user_id': uid}).exec(gotUser);

  function gotUser(err, user) {
    _self.user = user;

    // Set find conditions given by URL
    var conditions = null;
    if (req.path == '/ideas_user')
      conditions = {'uid': user.user_id}
    else if (req.path == "/ideas_fav")
      conditions = {'_id': {$in: user.favorites}}

    Ideas.find(conditions).sort(sort_type).exec(gotIdea);
  }

  function gotIdea(err, ideas) {
    _self.ideas = ideas;

    for (var i=0; i<ideas.length; i++) {
      // Mark favorite ideas
      if (_self.user != null && _self.user.favorites.indexOf(ideas[i]._id) > -1)
        ideas[i].fav = true;
      // Format date
      ideas[i].date_post_f = core.get_time_from(ideas[i].date_post);
      // Shorten description
      if (ideas[i].description.length > POINTS.IDEA.DESC)
        ideas[i].description = (ideas[i].description).substring(0, POINTS.IDEA.DESC) + ' [...]';
    }

    res.render('ideas', {
      title:      'Ideas',
      user:       _self.user,
      ideas:      _self.ideas,
      currentUrl: req.path,
      sort:       req.query.sort
    });
  }
};


/*
List all info of selected idea.
*/
exports.one = function(req, res) {
  if (!req.query.id) return res.redirect('/ideas');
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  var _self = {};

  Ideas.findOne({'_id': req.query.id }).exec(gotIdea);

  function gotIdea(err, idea) {
    _self.idea = idea;

    // Markdown idea plan
    idea.plan_md = markdown.toHTML(idea.plan);
    // Format idea post date
    idea.date_post_f = core.get_time_from(idea.date_post);

    Users.find({'user_name': idea.team}).exec(gotTeam);
  }

  function gotTeam(err, team) {
    _self.team = team;

    for (i in team) {
      // Format user last seen date
      team[i].last_seen_f = core.get_time_from(team[i].last_seen);
      // Init user comments number
      team[i].comments_num = 0;
    }

    Users.findOne({'user_name': _self.idea.user_name}).exec(gotOwner);
  }

  function gotOwner(err, cuser) {
    _self.cuser = cuser;

    // Format owner last seen date
    cuser.last_seen_f = core.get_time_from(cuser.last_seen);

    IdeaComments.find({'idea': req.query.id}).sort('date').exec(gotComments);
  }

  function gotComments(err, comments) {
    _self.comments = comments;

    for (i in comments) {
      // Format comments post date
      comments[i].date_f = core.get_time_from(comments[i].date);

      // Get comments number for each member
      for(j in _self.team)
          if(_self.team[j].user_name == comments[i].user_name)
              _self.team[j].comments_num++;
    }

    Users.findOne({'user_id': uid}).exec(gotUser);
  }

  function gotUser(err, user) {
    _self.user = user;

    // Allow only the owner to view settings tab
    if ((!user || _self.idea.user_name != _self.user.user_name) &&
         req.path == '/idea/settings')
      return res.redirect('/idea?id=' + req.query.id);

    if (user) {
      // Check if user joined team
      if (_self.idea.team.indexOf(_self.user.user_id) > -1)
        user.joined = true;
      // Check if user faved idea
      if (user.favorites.indexOf(_self.idea._id) > -1)
        user.faved = true;

      for (i in _self.comments) {
        // Check for already voted comments
        if (_self.comments[i].upvotes.indexOf(_self.user.user_id) > -1)
          _self.comments[i].upvote = true;
        // Check for flagged comments
        if (_self.comments[i].flags.indexOf(_self.user.user_id) > -1)
          _self.comments[i].flag = true;
      }
    }

    res.render('idea', {
      title:      _self.idea.title,
      user:       _self.user,
      cuser:      _self.cuser,
      idea:       _self.idea,
      comments:   _self.comments,
      team:       _self.team,
      currentUrl: req.path,
      sort:       req.query.sort
    });
  }
};


/*
Add idea to db, update scores and post to fb page.
*/
exports.add = function(req, res) {
  // Accept idea only if it has a title and description
  if (!req.body.title || !req.body.description)
    return res.redirect('/ideas');

  new Ideas({
    user_name:    req.session.auth.github.user.login,
    title:        req.body.title,
    description:  req.body.description,
    lang:         req.body.lang,
    plan:         req.body.plan,
    size:         req.body.size,
    eta:          req.body.eta,
    points:       POINTS.IDEA.NEW
  }).save(savedIdea);

  function savedIdea(err, todo, count) {
    if (err) console.log("[ERR] Idea not saved.");

    // Update user ideas points
    var conditions = {user_id: req.session.auth.github.user.id};
    var update = {$inc: {points_ideas: POINTS.IDEA.NEW }};
    Users.update(conditions, update).exec();

    console.log("* " + req.session.auth.github.user.login + " added idea.");
    res.redirect('/ideas');

    /*
    Post idea to facebook page if in production.
    This uses a never expiring token.
    Page at: https://www.facebook.com/GitHubConnect
    */
    if (global.config.status == 'prod') {
    	var options = {
        host: "graph.facebook.com",
        path: "/" + global.config.facebook_id + "/feed?message="
          + req.body.description + "&access_token="
          + global.config.facebook_token,
        method: "POST",
      };
      var https = require('https');
      var request = https.request(options, function(response){
        var body = '';
        response.on("data", function(chunk){ body+=chunk.toString("utf8"); });
        response.on("end", function(){
          console.log("* Idea posted on facebook page.");
        });
      });
      request.end();
    }
  }
};


/*
Add idea comment. Send notification.
*/
exports.comment = function(req, res) {
  // Increment idea comments number
  var conditions = { _id: req.query.id };
  var update = {$inc: {comments_num: 1}};
  Ideas.update(conditions, update).exec(updatedIdea);

  function updatedIdea(err, num) {
    new IdeaComments({
      user_name:  req.session.auth.github.user.login,
      idea:       req.query.id,
      content:    req.body.content,
    }).save(function(err, comm, count) {
      console.log("* " + req.session.auth.github.user.login + " commented on " + req.query.id);
      res.redirect('/idea?id=' + req.query.id);
    });

    // Notify user in parallel
    Ideas.findOne({'_id': req.query.id}).exec(notify);
  }

  function notify(err, idea) {
    new Notifications({
      src:    req.session.auth.github.user.login,
      dest:   idea.user_name,
      type:   "idea_comm",
      link:   "/idea?id=" + req.query.id
    }).save(function(err, comm, count) {
      if (err) console.log("[ERR] idea comm notif not sent");
    });

    var conditions = {'user_name': idea.user_name};
    var update = {$set: {'unread': true}};
    Users.update(conditions, update).exec();
  }
};


/*
Add idea to favorites list. Used in AJAX calls.
*/
exports.fav = function(req, res) {
  var conditions = {user_id: req.session.auth.github.user.id};
  var update = {$push: {favorites: req.query.id}};
  Users.update(conditions, update, function (err, num) {
    if (num) res.json({success: true});
  });
};


/*
Remove idea from favorites list. Used in AJAX calls.
*/
exports.unfav = function(req, res) {
  var conditions = {user_id: req.session.auth.github.user.id};
  var update = {$pop: {favorites: req.query.id}};
  Users.update(conditions, update, function (err, num) {
    if (num) res.json({success: true});
  });
};


/*
Upvote idea comment. Used in AJAX calls.
*/
exports.upvote = function(req, res) {
  var conditions = {_id: req.query.id};
  var update = {$addToSet: {upvotes: req.session.auth.github.user.id}};
  IdeaComments.update(conditions, update, function (err, num) {
    if (num) res.json({success: true});
  });
};


/*
Flag idea comment. Used in AJAX calls.
*/
exports.flag = function(req, res) {
  var conditions = {_id: req.query.id};
  var update = {$addToSet: {flags: req.session.auth.github.user.id}};
  IdeaComments.update(conditions, update, function (err, num) {
    if (num) res.json({success: true});
  });
};


/*
User joins an idea's team.
*/
exports.join = function(req, res) {

  Ideas.findOne({'_id': req.query.id}).exec(gotIdea);

  // Update user ideas points
  function gotIdea(err, idea) {
    var conditions = {'user_name': idea.user_name};
    var update = {$inc: {'points_ideas': POINTS.IDEA.JOIN}};
    Users.update(conditions, update).exec();
  }

  // Update idea points and team
  var conditions = {'_id': req.query.id};
  var update = {
    $addToSet: {'team': req.session.auth.github.user.login},
    $inc: {'points': POINTS.IDEA.JOIN}
  };
  Ideas.update(conditions, update, function (err, num) {
    res.redirect('/idea?id=' + req.query.id);
  });
};


/*
Edit idea info.
*/
exports.edit = function(req, res) {
  if (!req.query.id) return res.redirect('/ideas');

  Ideas.findOne({'_id': req.query.id}).exec(gotIdea);

  function gotIdea(err, idea) {
    // Allow only edits by owner
    if (idea.user_name != req.session.auth.github.user.login)
      return res.redirect('/ideas');

    // Update idea info
    var conditions = {'_id': req.query.id};
    var update = {$set: {
      'description': req.body.description,
      'lang':        req.body.lang
    }};
    Ideas.update(conditions, update, function (err, num) {
      console.log("* Owner made changes to " + req.query.id);
      res.redirect('/idea?id=' + req.query.id);
    });
  }
};


/*
Edit idea plan.
*/
exports.plan_edit = function(req, res) {

  Ideas.findOne({'_id': req.query.id}).exec(gotIdea);

  // Allow only edits by owner
  function gotIdea(err, idea) {
    if (idea.user_name != req.session.auth.github.user.login)
      return res.redirect('/ideas');

    // Update idea plan
    var conditions = {'_id': req.query.id};
    var update = {$set: {'plan': req.body.plan}};
    Ideas.update(conditions, update, function (err, num) {
      console.log("* Owner updated plan of " + req.query.id);
      res.redirect('/idea/plan?id=' + req.query.id);
    });
  }
};


/*
Change idea owner. You can chose one of your teammates.
*/
exports.own = function(req, res) {

  Ideas.findOne({'_id': req.query.id}).exec(gotIdea);

  function gotIdea(err, idea) {
    // Allow only edits by owner
    if (idea.user_name != req.session.auth.github.user.login)
      return res.redirect('/ideas');

    // Check if selected option is a team member
    if (idea.team.indexOf(req.body.new_own) > -1) {
      var conditions = {'_id': req.query.id};
      var update = {
        $set: {'user_name': req.body.new_own},
        $pull: {'team': req.body.new_own}
      };
      Ideas.update(conditions, update, function (err, num) {
        console.log("* New owner for idea " + req.query.id);
      });
    }

    res.redirect('/idea?id=' + req.query.id);
  }
};


/*
Totally remove idea, associated comments and update
user score.
*/
exports.remove = function(req, res) {

  Ideas.findOne({'_id': req.query.id}).exec(gotIdea);

  // Allow only edits by owner
  function gotIdea(err, idea) {
    if (idea.user_name != req.session.auth.github.user.login)
      return res.redirect('/ideas');

    // Update owner score
    var conditions = {'user_id': req.session.auth.github.user.id};
    var update = {$inc: {'points_ideas': -(idea.points)}};
    Users.update(conditions, update).exec();

    Ideas.remove({'_id': req.query.id}, function (err, num) {
      if (err) console.log("[ERR] Could not remove idea.");
    });

    IdeaComments.remove({'idea': req.query.id}, function (err, num) {
      if (err) console.log("[ERR] Could not remove idea comments.");
    });

    res.redirect('/ideas');
  }
};
