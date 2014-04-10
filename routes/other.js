var mongoose = require('mongoose');
var Users    = mongoose.model('Users');
var Ideas    = mongoose.model('Ideas');
var Projects = mongoose.model('Projects');


exports.index = function(req, res) {
	var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Users.find (function (err, users, count) {
    Ideas.find (function (err, ideas, count) {
      Projects.find (function (err, projects, count) {
        Users.findOne ({ 'user_id': uid }, function (err, user) {
          if (err) return handleError(err);

          res.render('index', {
            title:    "Welcome to Github-connect",
            user:     user,
            users:    users.length,
            ideas:    ideas.length,
            projects: projects.length
          });

        });
      });
    });
  });
};

exports.login_dev = function(req, res) {
	// init default user
  var u = {
    id:       777,
    login:    'dev_user',
    followed: [],
    repos:    []
  };
	// overwrite with query name, and generated id
	if (req.query.name) {
		u.login = req.query.name;
		u.id = parseInt(u.login, 36);
	}
	var repo = {
		name: 					u.login + '\'s cool repo',
		description: 	 'A very nice description should be added here.',
		html_url: 			'http://www.github.com',
		fork: 					true,
		forks_count: 	 3,
		watchers_count: 5,
		closed_pulls: 	3,
		points: 				100
	};
  var update = {
    user_id: 			u.id,
    user_name: 		u.login,
    user_fullname: 'Development user',
    user_email: 	 'dev@github-connect.com',
    avatar_url: 	 'https://avatars.githubusercontent.com/u/0',
    location: 		 'Somewhere',
		points_repos:  0,
    join_github: 	Date.now(),
    join_us: 			Date.now(),
    last_seen: 		Date.now(),
		repos: 				[repo]
  };

  Users.update({user_id: u.id}, update, {upsert: true}, function(err, num) {
    req.session.regenerate(function (err) {
      req.session.auth = {};
      req.session.auth.loggedIn = true;
      req.session.auth.github = {};
      req.session.auth.github.user = u;
      res.redirect('/profile');
    });
  });
}

exports.login = function(req, res) {
  if (global.config.status == 'dev') res.redirect('/login_dev');
	if (req.session.auth) res.redirect('/profile');
  res.render('login', {
    title: "Log in",
    tab: 	req.query.rf
  });
};

exports.profile = function(req, res) {

  var cuname, uname;
  if (req.session.auth) {
    cuname = req.session.auth.github.user.login;
    uname = cuname;
  }

  if (req.query.name) cuname = req.query.name;

  // restrict /profile unless logged in or other user
  if (!req.session.auth && !req.query.name) res.redirect('/login');
  else {
    Users.findOne ({ 'user_name': cuname }, function(err, cuser) {

      if (!cuser) res.redirect('/login');
      else {
				Users.findOne ({ 'user_name': uname }, function(err, user) {

          //TODO: remove this
          // keep vital info about logged user in session var
          //req.session.user = user;

					Ideas
					.find({ 'uid': cuser.user_id })
					.sort('-date_post')
					.exec(function(err, ideas) {
            Projects
            .find({ 'uid': cuser.user_id })
            .sort('-date_post')
            .exec(function(err, projects) {

  						res.render('profile', {
  							title: 		"User info",
  							cuser: 	  cuser,
                projects:  projects,
  							ideas: 		ideas,
  							user: 		 user
						  });

            });
					});
				});
      }
    });
  }
};

exports.contact = function(req, res) {
	var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Users.findOne ({ 'user_id': uid }, function(err, user) {
    if (err) return handleError(err);
    res.render('contact', {
      title:  "Get in touch with us",
      user: 	user
    });
  });
};

exports.faq = function(req, res) {
	var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Users.findOne ({ 'user_id': uid }, function(err, user) {
    if (err) return handleError(err);
    res.render('faq', {
      title:  "F.A.Q.",
      user: 	user
    });
  });
};

exports.not_found = function(req, res) {
  res.render('404', {
    title: "404: File not found"
  });
}
