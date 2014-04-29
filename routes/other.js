var mongoose = require('mongoose');
var Users    = mongoose.model('Users');
var Ideas    = mongoose.model('Ideas');
var Projects = mongoose.model('Projects');
var Notifications = mongoose.model('Notifications');
var core     = require('../core.js');

/*
Shows number of registered users, projects and ideas.
Get user info if logged in.
*/
exports.index = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);
  var _self = {};

  var gotUser = function(err, user) {
    res.render('index', {
      title:    "Github-connect",
      user:     user,
      users:    _self.users,
      ideas:    _self.ideas,
      projects: _self.projects
    });
  }

  var gotProjects = function(err, projects) {
    _self.projects = projects;
    Users.findOne({'user_id': uid}).exec(gotUser);
  };

  var gotIdeas = function(err, ideas) {
    _self.ideas = ideas;
    Projects.count().exec(gotProjects);
  };

  var gotUsers = function(err, users) {
    _self.users = users;
    Ideas.count().exec(gotIdeas);
  };

  Users.count().exec(gotUsers);
};


/*
Login with or without GitHub auth.
This will provide a session and create a new user if necessary.
Visit /login/$USER to login as $USER.
*/
exports.login = function(req, res) {
  // Use an offline account. Add user if not existent.
  if (global.config.status == 'dev') {
    if (!req.params.user) {
      // If no username provided, redirect to default.
      return res.redirect('/login/dev_user');

    } else {
      // Create default user with given name and autogenerated id.
      var u = {id: parseInt(req.params.user, 36), login: req.params.user};

      // Add some content for user
      var repo = {
        name:           req.params.user + '\'s cool repo',
        description:    'A very nice description should be added here.',
        html_url:       'http://www.github.com',
        fork:           true,
        forks_count:    3,
        watchers_count: 5,
        closed_pulls:   3,
      };
      var update = {
        user_id:       u.id,
        user_name:     u.login,
        user_fullname: 'Development user',
        user_email:    'dev@github-connect.com',
        avatar_url:    'https://avatars.githubusercontent.com/u/0',
        location:      'Somewhere',
        repos:         [repo]
      };

      // Make sure user exists and build session for him.
      Users.update({user_id: u.id}, update, {upsert: true}, function(err, num) {
        req.session.regenerate(function (err) {
          req.session.auth = {};
          req.session.auth.loggedIn = true;
          req.session.auth.github = {};
          req.session.auth.github.user = u;
          res.redirect('/' + u.login);
        });
      });
    }

  // Load login or redirect user to profile page if already logged in.
  } else {
    if (req.session.auth)
      return res.redirect('/' + req.session.auth.github.user.login);

    res.render('login', {
      title: "Log in",
      tab:   req.query.rf
    });
  }
};


/*
Feedback form processing.
Sends email to owner and redirects to login page with message.
*/
exports.feedback = function(req, res) {
  if (req.body.email && req.body.msg) {
    core.send_mail(null, 'feedback', req.body);
    res.redirect('/login?rf=back');

  } else {
    res.redirect('/contact');
  }
};


/*
Coantact page holds feedback form.
*/
exports.contact = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Users.findOne({ user_id: uid }, function(err, user) {
    if (err) return handleError(err);

    res.render('contact', {
      title:  "Get in touch with us",
      user:   user
    });
  });
};


/*
FAQ page.
*/
exports.faq = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Users.findOne({ user_id: uid }, function(err, user) {
    if (err) return handleError(err);

    res.render('faq', {
      title:  "F.A.Q.",
      user:   user
    });
  });
};
