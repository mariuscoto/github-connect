var mongoose = require('mongoose');
var Users    = mongoose.model('Users');
var Ideas    = mongoose.model('Ideas');
var Projects = mongoose.model('Projects');
var Notifications = mongoose.model('Notifications');
var core 		= require('../core.js');


exports.edit = function(req, res) {
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

exports.index = function(req, res) {
  var cname = req.url.substring(1, (req.url + '/').substring(1).indexOf('/')+1);
  var tab = req.url.substring(cname.length+2);
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);


  Users.findOne ({ 'user_name': cname }, function(err, cuser) {
    if (!cuser) res.render('404', {title: "404: File not found"});
    else {

      Users.findOne ({ 'user_id': uid }, function(err, user) {

        if (tab == 'ideas')
          Ideas
          .find({ 'user_name': cuser.user_name })
          .sort('-date_post')
          .exec(function(err, ideas) {
            res.render('profile', {
              title:     cuser.user_fullname,
              currentUrl:tab,
              cuser: 	  cuser,
              projects:  '',
              ideas: 		ideas,
              user: 		 user
            });
          });

        else if (tab == 'projects')
          Projects
          .find({ 'user_name': cuser.user_name })
          .sort('-date_post')
          .exec(function(err, projects) {
            res.render('profile', {
              title:     cuser.user_fullname,
              currentUrl:tab,
              cuser: 	  cuser,
              projects:  projects,
              ideas: 		'',
              user: 		 user
            });
          });

        else if (tab == 'notifications')
          if (!user || user.user_name != cuser.user_name) {
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
                title:     cuser.user_fullname,
                currentUrl: tab,
                cuser: 		 cuser,
                notif: 		 notif,
                user: 		  user
              });
            });
          }

        else if (tab == 'repos')
          res.render('profile', {
            title:     cuser.user_fullname,
            currentUrl:tab,
            cuser: 	  cuser,
            projects:  '',
            ideas: 		'',
            user: 		 user
          });

        else if (tab == 'edit')
          if (!user || user.user_name != cuser.user_name)
            res.redirect('/' + cuser.user_name);
          else
            res.render('profile', {
              title:     cuser.user_fullname,
              currentUrl:tab,
              cuser: 	  cuser,
              projects:  '',
              ideas: 		'',
              user: 		 user
            });

        else if (tab == 'cups')
          res.render('profile', {
            title:     cuser.user_fullname,
            currentUrl:tab,
            cuser: 	  cuser,
            projects:  '',
            ideas: 		'',
            user: 		 user
          });

        else {
          Ideas
          .find({ 'user_name': cuser.user_name })
          .sort('-date_post')
          .limit(3)
          .exec(function(err, ideas) {
            Projects
            .find({ 'user_name': cuser.user_name })
            .sort('-date_post')
            .limit(3)
            .exec(function(err, projects) {

              // List just first 3 repos
              cuser.repos = cuser.repos.slice(0, 3);

              res.render('profile', {
                title:     cuser.user_fullname,
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
