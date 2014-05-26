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
    // Formate dates
    ch.start_f = "" + ch.start.getUTCDate() + "/" + (ch.start.getUTCMonth()+1) + "/" + ch.start.getUTCFullYear();
    ch.end_f = "" + ch.end.getUTCDate() + "/" + (ch.end.getUTCMonth()+1) + "/" + ch.end.getUTCFullYear();

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

/*
Edit challenge info and redirect to new link.
*/
exports.edit = function(req, res) {
  // Redirect if user not in admin list


  // Update challenge info
  var pattern = /(\d{2})\/(\d{2})\/(\d{4})/;
  var conditions = {'link': req.params.ch};
  var update = {$set: {
    'name':        req.body.name,
    'link':        req.body.name.replace(/\s+/g, ''),
    'description': req.body.description,
    'start':       new Date(req.body.start.replace(pattern, '$3-$2-$1')),
    'end':         new Date(req.body.end.replace(pattern, '$3-$2-$1'))
  }};
  Challenges.update(conditions, update, function (err, num) {
    console.log("* Owner made changes to challenge " + req.body.name);
    res.redirect('/challenges/' + req.body.name.replace(/\s+/g, '') + '/admin');
  });
};