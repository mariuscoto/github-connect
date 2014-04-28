var mongoose = require('mongoose');
var Users    = mongoose.model('Users');
var Ideas    = mongoose.model('Ideas');
var Projects = mongoose.model('Projects');
var Notifications = mongoose.model('Notifications');
var core 		= require('../core.js');


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
      res.redirect('/' + u.login);
    });
  });
}

exports.login = function(req, res) {
  if (global.config.status == 'dev') return res.redirect('/login_dev');
  if (req.session.auth) return res.redirect('/' + req.session.auth.github.user.login);

  res.render('login', {
    title: "Log in",
    tab: 	req.query.rf
  });
};

exports.profile_edit = function(req, res) {
  var email = false, loc = false;
  if (req.body.email_pub) email = true;
  if (req.body.location_pub) loc = true;

  var conditions = { user_id: req.session.auth.github.user.id };
  var update = {$set: {
    location: 			req.body.location,
    location_pub: 	loc,
    user_fullname:  req.body.fullname,
    user_email: 		req.body.email,
    email_pub: 		 email
  }};
  Users.update(conditions, update, function (err, num) {
    console.log("* " + req.session.auth.github.user.login + " made profile changes.");
    res.redirect('/' + req.session.auth.github.user.login);
  });
}

exports.profile = function(req, res) {
  var cname = req.url.substring(1, (req.url + '/').substring(1).indexOf('/')+1);
  var tab = req.url.substring(cname.length+2);
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);


  Users.findOne ({ 'user_name': cname }, function(err, cuser) {
    if (!cuser) res.render('404', {title: "404: File not found"});
    else {

      Users.findOne ({ 'user_id': uid }, function(err, user) {

        if (tab == 'ideas')
          Ideas
          .find({ 'uid': cuser.user_id })
          .sort('-date_post')
          .exec(function(err, ideas) {
            res.render('profile', {
              currentUrl:tab,
              cuser: 	  cuser,
              projects:  '',
              ideas: 		ideas,
              user: 		 user
            });
          });

        else if (tab == 'projects')
          Projects
          .find({ 'uid': cuser.user_id })
          .sort('-date_post')
          .exec(function(err, projects) {
            res.render('profile', {
              currentUrl:tab,
              cuser: 	  cuser,
              projects:  projects,
              ideas: 		'',
              user: 		 user
            });
          });

        else if (tab == 'notifications')
          if (!user || user.id != cuser.id) {
            res.redirect('/' + cuser.user_name);

          } else {
            // update general unread
            var conditions = {user_name: cuser.user_name};
            var update = {$set: {unread: false}};
            Users.update(conditions, update).exec();

            Notifications
            .find({ 'dest': cuser.user_name })
            .sort({ date : -1 })
            .exec(function(err, notif) {

              for (var i in notif) {
                // format date
                notif[i].date_f = core.get_time_from(notif[i].date);
              }

              res.render('profile', {
                currentUrl: tab,
                cuser: 		 cuser,
                notif: 		 notif,
                user: 		  user
              });
            });
          }

        else if (tab == 'repos')
          res.render('profile', {
            currentUrl:tab,
            cuser: 	  cuser,
            projects:  '',
            ideas: 		'',
            user: 		 user
          });

        else if (tab == 'edit')
          if (!user || user.id != cuser.id)
            res.redirect('/' + cuser.user_name);
          else
            res.render('profile', {
              currentUrl:tab,
              cuser: 	  cuser,
              projects:  '',
              ideas: 		'',
              user: 		 user
            });

        else if (tab == 'cups')
          res.render('profile', {
            currentUrl:tab,
            cuser: 	  cuser,
            projects:  '',
            ideas: 		'',
            user: 		 user
          });

        else {
          Ideas
          .find({ 'uid': cuser.user_id })
          .sort('-date_post')
          .limit(3)
          .exec(function(err, ideas) {
            Projects
            .find({ 'uid': cuser.user_id })
            .sort('-date_post')
            .limit(3)
            .exec(function(err, projects) {

              res.render('profile', {
                currentUrl:'',
                cuser: 	  cuser,
                projects:  projects,
                ideas: 		ideas,
                user: 		 user
              });

            });
          });
        }
      });

    }
  });
}

exports.feedback = function(req, res) {
  if (req.body.email && req.body.msg) {
    core.send_mail(null, 'feedback', req.body);
    res.redirect('/login?rf=back');
  } else {
    res.redirect('/contact');
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
