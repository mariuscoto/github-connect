var express = require('express');
var app = module.exports = express();
global.config = [];

app.configure('development', function(){
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  global.config = require('./lib/config')
	global.config.status = 'dev';
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
	global.config.status = 'prod';
});

var db = require('./model/db')
  , fs = require('fs')
  , http = require('http')
  , https = require('https')
  , everyauth = require('everyauth')
  , mongoose = require('mongoose')
  , core = require('./core.js');


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
.redirectPath('/profile');


app.configure(function() {
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.favicon("public/images/github-icon.ico"));
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(express.session({secret: global.config.redis_secret}));
	app.use(everyauth.middleware());
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
});


// routes defined here
var ideas = require('./routes/ideas.js');
app.get('/ideas', ideas.ideas);
app.get('/ideas-favorites', ensureAuth, ideas.ideas_favorites);
app.get('/ideas-user', ensureAuth, ideas.ideas_user);
app.post('/idea/fav', ensureAuth, ideas.idea_add_fav);
app.post('/idea/unfav', ensureAuth, ideas.idea_remove_fav);
app.get('/join-team', ensureAuth, ideas.join_team);
app.get('/idea', ideas.idea);
app.get('/idea-team', ideas.idea);
app.get('/idea-plan', ideas.idea);
app.get('/idea-plan-edit', ideas.idea);
app.get('/idea-settings', ideas.idea);
app.post('/upvote', ensureAuth, ideas.upvote);
app.post('/flag', ensureAuth, ideas.flag);
app.post('/ideas', ideas.ideas_post);
app.post('/idea_comment', ensureAuth, ideas.idea_comment);
app.post('/idea-edit', ensureAuth, ideas.idea_edit);
app.post('/idea-plan-edit', ensureAuth, ideas.idea_plan_edit);
app.get('/idea-remove', ensureAuth, ideas.idea_remove);

app.get('/notifications', ensureAuth, ideas.notifications);

var other = require('./routes/other.js');
app.get('/', other.index);
app.get('/login', other.login);
app.get('/login_dev', ensureDev, other.login_dev);
app.get('/profile', other.profile);
app.get('/contact', other.contact);
app.get('/faq', other.faq);

var projects = require('./routes/projects.js');
app.get('/projects', projects.index);
app.get('/projects_fav', ensureAuth, projects.index);
app.get('/projects_user', ensureAuth, projects.index);
app.get('/project', projects.one);
app.post('/projects', projects.add);
app.post('/projects/follow', ensureAuth, projects.follow);
app.post('/projects/unfollow', ensureAuth, projects.unfollow);
app.post('/projects/comment', ensureAuth, projects.comment);
app.post('/projects/upvote', ensureAuth, projects.upvote);
app.post('/projects/flag', ensureAuth, projects.flag);

app.use(other.not_found);


// Make sure user is authenticated middleware
function ensureAuth(req, res, next) {
	if (req.session.auth) return next();
	res.redirect('/login');
}
// Make sure offline login only available in dev mode
function ensureDev(req, res, next) {
	if (global.config.status == 'dev') return next();
	res.redirect('/');
}

// Launch server
app.listen(process.env.PORT || 3000);
