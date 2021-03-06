var express = require('express');
var app = module.exports = express();
global.config = [];


app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  global.config.redis_secret = 'big secret'
  //global.config = require('./lib/config')
  global.config.status = 'dev';
});

app.configure('testing', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  global.config.redis_secret = 'big secret'
  global.config.status = 'test';
});

app.configure('production', function(){
  app.use(express.errorHandler());
  global.config.gh_clientId = process.env.clientId;
  global.config.gh_secret = process.env.secret;
  global.config.redis_secret = process.env.redis_secret;
  global.config.db_name = process.env.db_name;
  global.config.db_pass = process.env.db_pass;
  global.config.facebook_id = process.env.fb_id;
  global.config.facebook_token = process.env.fb_token;
  global.config.mail_user = process.env.mail_user;
  global.config.mail_pass = process.env.mail_pass;
  global.config.nodetime = process.env.nodetime;
  global.config.status = 'prod';

  require('nodetime').profile({
    accountKey: global.config.nodetime, 
    appName: 'Node.js Application'
  });

});


var MACRO = require('./model/macro.js')
  , db = require('./model/db')
  , fs = require('fs')
  , http = require('http')
  , https = require('https')
  , everyauth = require('everyauth')
  , mongoose = require('mongoose')
  , core = require('./core.js')
  , cron = require('cron').CronJob;

// Refresh challenge cron job
var job = new cron(MACRO.CRON.CHALLENGE, function(){
    core.refresh_challenges();
  }, function () {}, true, false
);

everyauth
.everymodule
.findUserById( function (id, callback) {
  callback(null, global.usersById[id]);
});

everyauth
.github
.appId(global.config.gh_clientId)
.appSecret(global.config.gh_secret)
.findOrCreateUser(core.login)
.redirectPath('/login');


app.configure(function() {
  //app.set('images', __dirname + '/public/images');
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon("public/images/github-icon.ico"));
  app.use(express.json());
  app.use(express.urlencoded());
  app.use(express.cookieParser());
  app.use(express.session({
    secret: global.config.redis_secret,
    cookie: { maxAge: 1800000 } //30 min
  }));
  app.use(everyauth.middleware());

  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});


// routes defined here
var ideas = require('./routes/ideas.js');
app.get('/ideas', ideas.index);
app.get('/ideas_fav', ensureAuth, ideas.index);
app.get('/ideas_user', ensureAuth, ideas.index);
app.get('/idea', ideas.one);
app.get('/idea/team', ideas.one);
app.get('/idea/team/join', ensureAuth, ideas.join);
app.get('/idea/plan', ideas.one);
app.get('/idea/plan/edit', ideas.one);
app.get('/idea/settings', ideas.one);
app.post('/idea/owner', ensureAuth, ideas.own);
app.post('/idea/remove', ensureAuth, ideas.remove);
app.post('/ideas', ideas.add);
app.post('/ideas/search', ideas.search);
app.post('/idea/fav', ensureAuth, ideas.fav);
app.post('/idea/unfav', ensureAuth, ideas.unfav);
app.post('/idea/edit', ensureAuth, ideas.edit);
app.post('/idea/upvote', ensureAuth, ideas.upvote);
app.post('/idea/flag', ensureAuth, ideas.flag);
app.post('/ideas/comment', ensureAuth, ideas.comment);
app.post('/idea/plan/edit', ensureAuth, ideas.plan_edit);

var other = require('./routes/other.js');
app.get('/', other.index);
app.get('/login', other.login);
app.get('/login/:user', other.login);
app.get('/faq', other.faq);
app.get('/contributors', other.contributors);
app.get('/contact', other.contact);
app.post('/contact', other.feedback);

var profile = require('./routes/profile.js');
app.get('/:user/cups', profile.cups)
app.get('/:user/repos', profile.repos)
app.get('/:user/ideas', profile.ideas)
app.get('/:user/remove', ensureAuth, profile.remove)
app.get('/:user/projects', profile.projects)
app.get('/:user/edit_profile', profile.edit_profile)
app.get('/:user/notifications', profile.notifications)
app.post('/profile/edit', ensureAuth, profile.edit);

var projects = require('./routes/projects.js');
app.get('/projects', projects.index);
app.get('/projects_fav', ensureAuth, projects.index);
app.get('/projects_user', ensureAuth, projects.index);
app.get('/project', projects.one);
app.get('/project/settings', ensureAuth, projects.settings);
app.post('/projects', projects.add);
app.post('/projects/search', projects.search);
app.post('/projects/edit', ensureAuth, projects.edit);
app.post('/projects/follow', ensureAuth, projects.follow);
app.post('/projects/unfollow', ensureAuth, projects.unfollow);
app.post('/projects/comment', ensureAuth, projects.comment);
app.post('/project/upvote', ensureAuth, projects.upvote);
app.post('/project/flag', ensureAuth, projects.flag);
app.post('/projects/remove', ensureAuth, projects.remove);

var challenge = require('./routes/challenge.js');
app.get('/challenges', challenge.index);
app.get('/challenges/:ch', challenge.one);
app.get('/challenges/:ch/admin', challenge.one);
app.post('/challenges/:ch/edit', challenge.edit);
app.post('/challenges/:ch/admin_add', ensureAuth, challenge.admin_add);
app.get('/challenges/:ch/admin_remove', ensureAuth, challenge.admin_remove);
app.get('/challenges/:ch/repo_remove', ensureAuth, challenge.repo_remove);
app.get('/challenges/:ch/users', challenge.one);
app.get('/challenges/:ch/pulls', challenge.one);
app.get('/challenges/:ch/join', ensureAuth, challenge.join);


var admin = require('./routes/admin.js');
app.get('/admin', ensureSuper, admin.index);
app.post('/admin/challenge_add', ensureSuper, admin.challenge_add);

/*
This handles all other URLs.
It's main porpose is to serve /user pages and all subpages
but also send 404 response if user does not exist.
*/
app.use(profile.index);


// Make sure user is authenticated middleware
function ensureAuth(req, res, next) {
  if (req.session.auth) return next();
  res.redirect('/login');
}

// Make sure user is authenticated and root middleware
function ensureSuper(req, res, next) {
  if (req.session.auth && MACRO.SUPERUSER.indexOf(req.session.auth.github.user.login) > -1)
    return next();

  return res.render('404', {title: "404: File not found"});
}

// Launch server
app.listen(process.env.PORT || 3000, function() {
  console.log('Server listening on port 3000.');
});
