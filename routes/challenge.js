var POINTS = require('../model/points.js');
var core = require('../core.js');
var mongoose = require('mongoose');
var Users = mongoose.model('Users');
var Challenges = mongoose.model('Challenges');


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

  Users.findOne({'user_id': uid}).exec(gotUser);

  function gotUser(err, user) {
    _self.user = user;

    Challenges.findOne({'link': req.params.ch}).exec(gotChallenge);;
  }

  function gotChallenge(err, ch) {
    res.render('challenge', {
      user:       _self.user,
      currentUrl: req.path,
      challenge:  ch
    })
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