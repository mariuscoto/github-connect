var POINTS = require('../model/points.js');
var core = require('../core.js');
var mongoose = require('mongoose');
var Users = mongoose.model('Users');
var Challenges = mongoose.model('Challenges');
var Pulls = mongoose.model('Pulls');
var https = require('https');

/*
View all challenges.
*/
exports.index = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);
  var _self = {};

  Users.findOne({'user_id': uid}).exec(gotUser);

  function gotUser(err, user) {
    _self.user = user;

    Challenges.find().exec(gotChallenges);
  }

  function gotChallenges(err, ch) {
    res.render('challenges', {
      title:      "All challenges",
      user:       _self.user,
      challenges: ch
    })
  };
};

/*
Single challenge page.
*/
exports.one = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  var _self = {};
  var preq = [];

  Users.findOne({'user_id': uid}).exec(gotUser);

  function gotUser(err, user) {
    _self.user = user;
    Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);
  }

  function gotChallenge(err, ch) {
    // Formate dates
    if (ch.start)
      ch.start_f = "" + ch.start.getUTCDate() + "/" + (ch.start.getUTCMonth()+1) + "/" + ch.start.getUTCFullYear();
    if (ch.end)
      ch.end_f = "" + ch.end.getUTCDate() + "/" + (ch.end.getUTCMonth()+1) + "/" + ch.end.getUTCFullYear();

    // Check if current user is admin
    if (uid && ch.admins.indexOf(req.session.auth.github.user.login) > -1)
      _self.user.admin = 1;
    else if (req.path.substring(req.path.lastIndexOf('/')) == '/admin')
      return res.redirect('/challenges/' + req.params.ch);

    res.render('challenge', {
      user:       _self.user,
      currentUrl: req.path,
      challenge:  ch,
      pulls:      ch.pulls
    });
  }
};

/*
Add new challenge. Only superuser should be able to
do this.
*/
exports.admin = function(req, res) {
  if (req.session.auth.github.user.login != 'dev_user')
    return res.redirect('/');

  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Users.findOne({'user_id': uid}).exec(gotUser);

  function gotUser(err, user) {
    res.render('challenge_add', {
      title: 'New challenge',
      user: user
    });
  }

};

/*
Add info from form to db.
Only superuser can add challenges.
*/
exports.add = function(req, res) {
  if (req.session.auth.github.user.login != 'dev_user')
    return res.redirect('/');

  // Add all admins in list even if they do not exist
  new Challenges({
    name:         req.body.name,
    link:         req.body.name.replace(/\s+/g, ''),
    description:  req.body.description,
    admins:       req.body.admins.split(' ')
  }).save(savedChallenge);

  function savedChallenge(err, todo, count) {
    console.log("* Challenge " + req.body.name + " saved.");
    res.redirect('/challenges');
  }
};

/*
Edit challenge info and redirect to new link.
Redirect if user not in admin list
*/
exports.edit = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    // Check if user is admin
    if (ch.admins.indexOf(req.session.auth.github.user.login) < 0)
      return res.redirect('/challenges/' + req.params.ch);

    // Update challenge info
    var pattern = /(\d{2})\/(\d{2})\/(\d{4})/;
    var conditions = {'link': req.params.ch};
    var update = {
      $addToSet: {repos: req.body.repos},
      $set: {
        'name':        req.body.name,
        'link':        req.body.name.replace(/\s+/g, ''),
        'email':       req.body.email,
        'description': req.body.description,
        'start':       new Date(req.body.start.replace(pattern, '$3-$2-$1')),
        'end':         new Date(req.body.end.replace(pattern, '$3-$2-$1'))
    }};
    Challenges.update(conditions, update, function (err, num) {
      console.log("* Owner made changes to challenge " + req.body.name);
      res.redirect('/challenges/' + req.body.name.replace(/\s+/g, '') + '/admin');
    });
  }
};

/*
Join challenge.
*/
exports.join = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    var conditions = {'link': req.params.ch};
    var update = {$addToSet: {'users': req.session.auth.github.user.login}};
    Challenges.update(conditions, update, function (err, num) {
      res.redirect('/challenges/' + req.params.ch);
    });
  }
};

/*
Add new admin to list.
Only admins can add other admins.
*/
exports.admin_add = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    // Check if user is admin
    if (ch.admins.indexOf(req.session.auth.github.user.login) < 0)
      return res.redirect('/challenges/' + req.params.ch);

    var conditions = {'link': req.params.ch};
    var update = {$addToSet: {'admins': req.body.admin}};
    Challenges.update(conditions, update, function (err, num) {
      console.log("* New admin added to " + req.body.name);
      res.redirect('/challenges/' + req.params.ch + '/admin');
    });
  }
};

/*
Remove admin. Only admins can remove other admins.
An admin can remove himself.
*/
exports.admin_remove = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    // Check if user is admin
    if (ch.admins.indexOf(req.session.auth.github.user.login) < 0)
      return res.redirect('/challenges/' + req.params.ch);

    var conditions = {'link': req.params.ch};
    var update = {$pull: {'admins': req.query.name}};
    Challenges.update(conditions, update, function (err, num) {
      console.log("* Admin removed from " + req.body.name);
      res.redirect('/challenges/' + req.params.ch + '/admin');
    });
  }
};

/*
Refresh pull requests for certain repo.
*/
exports.refresh = function(req, res) {

  Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);

  function gotChallenge(err, ch) {
    if (!ch || !ch.start) return res.redirect('/challenges');

    var options = {
      host: "api.github.com",
      path: "/repos/cmarius02/github-connect/pulls?state=closed",
      method: "GET",
      headers: { "User-Agent": "github-connect" }
    };

    var request = https.request(options, function(response){
      var body = '';
      response.on("data", function(chunk){ body+=chunk.toString("utf8"); });
      response.on("end", function(){
        var pulls = JSON.parse(body);

        for (var p in pulls) {
          // Accept only pulls created after challenge start date and only
          // from registered users
          if (new Date(pulls[p].created_at).getTime() > ch.start.getTime() &&
              ch.users.indexOf(pulls[p].user.login) > -1) {

            var update = {$addToSet: { 'pulls': {
              auth:      pulls[p].user.login,
              url:       pulls[p].html_url,
              title:     pulls[p].title,
              created:   new Date(pulls[p].created_at),
              merged:    new Date(pulls[p].merged_at)
            }}};

            Challenges.update({'link': req.params.ch}, update).exec();
          }
        }
        //console.log(pulls);

      });
    });
    request.end();
    res.redirect('/challenges/' + ch.link);
  }
};