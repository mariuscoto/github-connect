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
  , mongoose = require('mongoose');

// DB reference
var Repo = mongoose.model('Repo');

var usersById = {};
var nextUserId = 0;
var repos, id, user;
global.repos = [];

// Points macros
var POINTS_REPO = 20;
var POINTS_FORK = 10;
var POINTS_WATCH = 1;
var POINTS_PULL = 30;
var POINTS_ADD_IDEAS = 5;
var POINTS_COMMENT = 10; 

function addUser (source, sourceUser) {
	var user;
	if (arguments.length === 1) { // password-based
		user = sourceUser = source;
		user.id = ++nextUserId;
		return usersById[nextUserId] = user;
	} else { // non-password-based
		user = usersById[++nextUserId] = {id: nextUserId};
		user[source] = sourceUser;
	}
	return user;
}

// Everyauth
var usersByGhId = {};

var core = require('./core.js');

everyauth
.everymodule
.findUserById( function (id, callback) {
	callback(null, usersById[id]);
});

everyauth
.github
.appId(global.config.gh_clientId)
.appSecret(global.config.gh_secret)
.findOrCreateUser( function (sess, accessToken, accessTokenExtra, ghUser) {

	sess.oauth = accessToken;
	if (typeof usersByGhId[ghUser.id] === 'undefined') {

		usersByGhId[ghUser.id] = addUser('github', ghUser);

		// Check if user already in db
		// else request info and add him.
		var Users = mongoose.model('Users');
        
		Users
		.findOne({ 'user_id': usersByGhId[ghUser.id].github.id }, 'user_name', function (err, user) {
			if (err) return handleError(err);
	    if (user != null) {
        // update last_seen
				var conditions = {user_id: usersByGhId[ghUser.id].github.id};
				var update = {$set: {last_seen: Date.now()}};
				Users.update(conditions, update, function (err, num) {
					console.log("* User " + user.user_name + " logged in.");
				});
        
        // add user info to session
        ghUser.user = user;
	    } else {

				// Import data from github
				new Users ({
					user_id: usersByGhId[ghUser.id].github.id,
					user_name: usersByGhId[ghUser.id].github.login,
					user_fullname: usersByGhId[ghUser.id].github.name,
					user_email: usersByGhId[ghUser.id].github.email,
					avatar_url: usersByGhId[ghUser.id].github.avatar_url,
					location: usersByGhId[ghUser.id].github.location,
					join_github: usersByGhId[ghUser.id].github.created_at,
					join_us: Date.now(),
          last_seen: Date.now()
				}).save (function (err, user, count) {
					console.log("* User " + user.user_name + " added.");
				});
	    }
		})
    
		var options = {
			host: "api.github.com",
			path: "/users/" + usersByGhId[ghUser.id].github.login + "/repos?access_token=" + accessToken,
			method: "GET",
			headers: { "User-Agent": "github-connect" }
		};

		var request = https.request(options, function(response){
    	var body = '';
    	response.on("data", function(chunk){ body+=chunk.toString("utf8"); });

			response.on("end", function(){
				var json = JSON.parse(body);
				//console.log(json);  

				// prepaire repos
				var repos = [];
				var total = 0;
				
				for (var k in json) {
					
					var points = 0; // total points
					if ({}.hasOwnProperty.call(json, k) && !json[k].private) {
						
						// get owner of forked repos
						if (json[k].fork) {
							core.update_repo_owner (json[k].name, usersByGhId[ghUser.id].github.login, accessToken);
							
						// compute points for own repos
						} else {
							points = POINTS_REPO + POINTS_FORK * json[k].forks_count + 
								       POINTS_WATCH * json[k].watchers_count ;
							total += points;
							
						}
					}

					repos.push(new Repo({
						name: json[k].name,
						description: json[k].description,
						html_url: json[k].html_url,
						fork: json[k].fork,
						forks_count: json[k].forks_count,
						size: json[k].size,
						watchers_count: json[k].watchers_count,
						points: points,
						owner: null
					}));
				}
				
				// update repos and score
				var conditions = {user_id: usersByGhId[ghUser.id].github.id};
				var update = {$set: {repos: repos, points_repos: total}};
				Users.update(conditions, update, {upsert: true}, callback);
				function callback (err, num) {
					console.log("* Updated repos for " + usersByGhId[ghUser.id].github.id);
				}
				
			});
		});
		
		request.end();
		return usersByGhId[ghUser.id];

	} else {
		return usersByGhId[ghUser.id];
	}
})
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

var other = require('./routes/other.js');
app.get('/', other.index);
app.get('/login', other.login);
app.get('/login_dev', other.login_dev);
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


app.use(function(req, res) {
  res.render('404', { 
    title: "404: File not found"
  });
});


// Make sure user is authenticated middleware
function ensureAuth(req, res, next) {
	if (req.user) return next();
	res.redirect('/login')
}

// Launch server
app.listen(process.env.PORT || 3000);
