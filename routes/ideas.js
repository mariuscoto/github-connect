var CHAR_LIMIT = 330;
var NEW_IDEA_POINTS = 10;
var JOIN_IDEA_POINTS = 5;

var express = require('express');
var mongoose = require('mongoose');
var Users = mongoose.model('Users');
var Ideas = mongoose.model('Ideas');
var Projects = mongoose.model('Projects');
var IdeaComments = mongoose.model('IdeaComments');
var Notifications = mongoose.model('Notifications');
var markdown = require( "markdown" ).markdown;
var core = require('../core.js')


exports.index = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  var sort_type = null;
  if (req.query.sort == "most_recent") {
    sort_type = '-date_post';
  } else if (req.query.sort == "most_commented") {
    sort_type = '-comments_num';
  }

  Users
  .findOne({ 'user_id': uid })
  .exec(function (err, user) {
    if (err) return handleError(err);

    // set find conditions
    var conditions = null;
    if (req.path == "/ideas_user")
      conditions = { 'uid': user.user_id }
    else if (req.path == "/ideas_fav")
      conditions = { _id: { $in: user.favorites }}

    Ideas
    .find(conditions)
    .sort(sort_type)
    .exec(function(err, ideas) {

      for (var i=0; i<ideas.length; i++) {
        // mark favorites
        if (user != null && user.favorites.indexOf(ideas[i]._id) > -1)
          ideas[i].fav = true;
        // format date
        ideas[i].date_post_f = core.get_time_from(ideas[i].date_post);
        // shorten description
        if (ideas[i].description.length > CHAR_LIMIT)
          ideas[i].description = (ideas[i].description).substring(0, CHAR_LIMIT) + " [...]";
      }

      res.render('ideas', {
        title:      "Ideas",
        user:       user,
        ideas:      ideas,
        currentUrl: req.path,
        sort:       req.query.sort
      });

    });
  });
};


exports.one = function(req, res) {
  if (!req.query.id) return res.redirect('/ideas');
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Ideas
  .findOne({ '_id': req.query.id })
  .exec(function(err, idea) {
    if (!idea) return res.redirect('/ideas');

    // Markdown idea plan
    idea.plan_md = markdown.toHTML(idea.plan);
    // compute post date
    idea.date_post_f = core.get_time_from(idea.date_post);

    Users
    .find({ 'user_id': idea.team })
    .exec(function(err, team) {
      if (err) return handleError(err);

      for (i in team) {
        team[i].last_seen_f = core.get_time_from(team[i].last_seen);
        team[i].comments_num = 0;
      }

      Users
      .findOne({ 'user_name': idea.user_name})
      .exec(function(err, cuser) {
        if (err) return handleError(err);

        // compute last seen date
        cuser.last_seen_f = core.get_time_from(cuser.last_seen);

        IdeaComments
        .find({ 'idea': req.query.id })
        .sort('date')
        .exec(function(err, comments) {

          for (i in comments) {
            // compute post date
            comments[i].date_f = core.get_time_from(comments[i].date);

            for(j in team){
                if(team[j].user_name == comments[i].user_name){
                    team[j].comments_num++;
                }
            }

          }

          Users
          .findOne({ 'user_id': uid })
          .exec(function (err, user) {

            if (user) {
              // see if user joined team
              if (user && idea.team.indexOf(user.user_id) > -1)
                user.joined = true;
              // see if user faved idea
              if (user && user.favorites.indexOf(idea._id) > -1)
                user.faved = true;

              for (i in comments) {
                // check for already voted comments
                if (comments[i].upvotes.indexOf(user.user_id) > -1)
                  comments[i].upvote = true;
                // check for flagged comments
                if (comments[i].flags.indexOf(user.user_id) > -1)
                  comments[i].flag = true;
              }
            }

            res.render('idea', {
              title:      idea.title,
              user:       user,
              cuser:      cuser,
              idea:       idea,
              team:       team,
              currentUrl: req.path,
              sort:       req.query.sort,
              comments:   comments
            });

          });
        });
      });
    });
  });
};


exports.add = function(req, res) {
  // add idea only if it has a title and description
  if (req.body.title && req.body.description)
    new Ideas({
      uid :         req.session.auth.github.user.id,
      user_name :   req.session.auth.github.user.login,
      title :       req.body.title,
      description : req.body.description,
      lang :        req.body.lang,
      plan:         req.body.plan,
      size:         req.body.size,
      eta:          req.body.eta,
      date_post:    Date.now(),
      points:       NEW_IDEA_POINTS
    }).save( function( err, todo, count ) {

        /*
        Post idea to facebook page if in production.
        This uses a never expiring token.
        Page at: https://www.facebook.com/GitHubConnect
        */
        if (global.config.status == 'prod') {
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
        }

        // update total score
        var conditions = {user_id: req.session.auth.github.user.id};
        var update = {$inc: {points_ideas: NEW_IDEA_POINTS }};
        Users.update(conditions, update).exec();

        console.log("* " + req.session.auth.github.user.login + " added idea.");
        res.redirect('/ideas');
    });
  else
    res.redirect('/ideas');
};


exports.comment = function(req, res) {
  // increment comments number
  var conditions = { _id: req.query.id };
  var update = {$inc: {comments_num: 1}};
  Ideas.update(conditions, update, function (err, num) {
    new IdeaComments({
      uid:        req.session.auth.github.user.id,
      user_name:  req.session.auth.github.user.login,
      idea:       req.query.id,
      content:    req.body.content,
      date:       Date.now()
    }).save(function(err, comm, count) {
      console.log("* " + req.session.auth.github.user.login + " commented on " + req.query.id);
      res.redirect('/idea?id=' + req.query.id);
    });

    Ideas
    .findOne({ '_id': req.query.id })
    .exec(function(err, idea) {
      new Notifications({
        src:    req.session.auth.github.user.login,
        dest:   idea.user_name,
        type:   "idea_comm",
        seen:   false,
        date:   Date.now(),
        link:   "/idea?id=" + req.query.id
      }).save(function(err, comm, count) {
        console.log("* " + idea.user_name + " notified.");
      });

      var conditions = {user_name: idea.user_name};
      var update = {$set: {unread: true}};
      Users.update(conditions, update).exec();
    });
  });
};


exports.fav = function(req, res) {
  var conditions = {user_id: req.session.auth.github.user.id};
  var update = {$push: {favorites: req.query.id}};
  Users.update(conditions, update, function (err, num) {
    if (num) res.json({success: true});
  });
};


exports.unfav = function(req, res) {
  var conditions = {user_id: req.session.auth.github.user.id};
  var update = {$pop: {favorites: req.query.id}};
  Users.update(conditions, update, function (err, num) {
    if (num) res.json({success: true});
  });
};


exports.upvote = function(req, res) {
  var conditions = {_id: req.query.id};
  var update = {$addToSet: {upvotes: req.session.auth.github.user.id}};
  IdeaComments.update(conditions, update, function (err, num) {
    if (num) {
      console.log("* " + req.session.auth.github.user.login +
                  " upvoted " + req.query.id);
      res.json({success: true});
    }
  });
};


exports.flag = function(req, res) {
  var conditions = {_id: req.query.id};
  var update = {$addToSet: {flags: req.session.auth.github.user.id}};
  IdeaComments.update(conditions, update, function (err, num) {
    if (num) {
      console.log("* " + req.session.auth.github.user.login +
                  " flagged " + req.query.id);
      res.json({success: true});
    }
  });
};


exports.join_team = function(req, res) {
  Ideas
  .findOne({ '_id': req.query.id })
  .exec(function(err, idea) {
    // update owner score
    var conditions = {user_name: idea.user_name};
    var update = {$inc: {points_ideas: JOIN_IDEA_POINTS}};
    Users.update(conditions, update).exec();
  });

  // update idea score and team
  var conditions = {_id: req.query.id};
  var update = {$addToSet: {team: req.session.auth.github.user.id},
                $inc: {points: JOIN_IDEA_POINTS}};
  Ideas.update(conditions, update, function (err, num) {
    res.redirect('/idea?id=' + req.query.id);
  });
};


exports.idea_edit = function(req, res) {
  Ideas
  .findOne({ '_id': req.query.id })
  .exec(function(err, idea) {
    // allow only edits by owner
    if (idea.uid != req.session.auth.github.user.id) res.redirect('/ideas');

    // apply changes
    var conditions = {_id: req.query.id};
    var update = {$set: {description: req.body.description, lang : req.body.lang}};
    Ideas.update(conditions, update, function (err, num) {
      console.log("* " + req.session.auth.github.user.login +
                  " made changes to " + req.query.id);
      res.redirect('/idea?id=' + req.query.id);
    });
  });
};


exports.idea_plan_edit = function(req, res) {
  Ideas
  .findOne({ '_id': req.query.id })
  .exec(function(err, idea) {
    // allow only edits by owner
    if (idea.uid != req.session.auth.github.user.id) res.redirect('/ideas');

    // apply changes
    var conditions = {_id: req.query.id};
    var update = {$set: {plan: req.body.plan}};
    Ideas.update(conditions, update, function (err, num) {
      console.log("* " + req.session.auth.github.user.login +
                  " made changes to plan " + req.query.id);
      res.redirect('/idea/plan?id=' + req.query.id);
    });
  });
};


exports.remove = function(req, res) {
  Ideas
  .findOne({ '_id': req.query.id })
  .exec(function(err, idea) {
    // allow only edits by owner
    if (idea.uid != req.session.auth.github.user.id) res.redirect('/ideas');
    else {
      // update score
      var conditions = {user_id: req.session.auth.github.user.id};
      var update = {$inc: {points_ideas: -(idea.points)}};
      Users.update(conditions, update).exec();

      Ideas.remove({_id: req.query.id}, function (err, num) {
        console.log("* " + req.session.auth.github.user.login +
                    " removed an idea " + req.query.id);
      });

      IdeaComments.remove({idea: req.query.id}, function (err, num) {
        console.log("* " + req.session.auth.github.user.login +
                    " removed all comments from " + req.query.id);
      });

      res.redirect('/ideas');
    }
  });
};
