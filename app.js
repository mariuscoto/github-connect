var express = require('express')
  , db = require('./model/db')
  , fs = require('fs')
  , http = require('http')
  , https = require('https')
  , everyauth = require('everyauth')
  , mongoose = require('mongoose');

// DB reference
var Repo = mongoose.model('Repo');

config = require('./lib/config')
var app = module.exports = express();

var usersById = {};
var nextUserId = 0;
var repos, id, user;
global.repos = [];

// Points macros
var POINTS_REPO = 20;
var POINTS_FORK = 10;
var POINTS_WATCH = 1;
var POINTS_PULL = 30;

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



function update_repo_owner (repo, user, accessToken) {
	var Users = mongoose.model('Users');
	
	var options = {
		host: "api.github.com",
		path: "/repos/" + user + "/" + repo + "?access_token=" + accessToken,
		method: "GET",
		headers: { "User-Agent": "github-connect" }
	};

	var request = https.request(options, function(response){
		var body = '';
		response.on("data", function(chunk){ body+=chunk.toString("utf8"); });

		response.on("end", function(){
			var repo_info = JSON.parse(body);
			var repo_owner = repo_info.source.owner.login;
			
			// update element of array
			var conditions = {user_name: user, 'repos.name': repo};
			var update = {$set: {'repos.$.owner': repo_owner}};
			Users.update(conditions, update, callback);

			function callback (err, num) {
				console.log("* Owner of " + repo + " updated.");
				// also update pull req
				update_pull_req(repo, repo_owner, user, accessToken);
			}
			
			// also update pull req
			//update_pull_req(repo, repo_owner, user, accessToken);
			
		});				
	});
	request.end();
}

function update_pull_req (repo, owner, user, accessToken) {
	var Users = mongoose.model('Users');
	
	var options = {
		host: "api.github.com",
		path: "/repos/" + owner + "/" + repo + "/pulls?state=closed&&access_token=" + accessToken,
		method: "GET",
		headers: { "User-Agent": "github-connect" }
	};

	var request = https.request(options, function(response){
		var body = '';
		response.on("data", function(chunk){ body+=chunk.toString("utf8"); });

		response.on("end", function(){
			
			var count = 0;
			var pulls = JSON.parse(body);
			
			for (var i in pulls) {
				
				// consider just merged pulls of current user
				if (pulls[i].state == 'closed' &&
						pulls[i].user.login == user &&
					  pulls[i].merged_at) {
					
					count++;
				}
			}
						
			// update pulls count, inc tentacles, add points, update total
			var conditions = {user_name: user, 'repos.name': repo};
			var update = {
				$set: {'repos.$.closed_pulls': count},
				$inc: {'tentacles': 1},
				$set: {'repos.$.points': count*POINTS_PULL},
				$inc: {'points_repos': count*POINTS_PULL}
			};
			Users.update(conditions, update, callback);

			function callback (err, num) {
				console.log("* Pulls of " + repo + " updated.");
			}
		});				
	});
	request.end();
}




everyauth
.everymodule
.findUserById( function (id, callback) {
	callback(null, usersById[id]);
});

everyauth
.github
.appId(config.gh_clientId)
.appSecret(config.gh_secret)
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
      	console.log("* User " + user.user_name + " logged in.");
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
					join_us: Date.now()
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
							update_repo_owner (json[k].name, usersByGhId[ghUser.id].github.login, accessToken);
							
						// compute points for own repos
						} else {
							points = POINTS_REPO + POINTS_FORK * json[k].forks_count + 
								       POINTS_WATCH * json[k].watchers_count;
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
	app.use(express.session({secret: config.redis_secret}));
	app.use(everyauth.middleware());

	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
});


app.configure('development', function(){
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
 
app.configure('production', function(){
	app.use(express.errorHandler());
});


// Routes
var routes = require('./routes');

app.get('/', routes.index);
app.get('/login', routes.login);

app.get('/contact', routes.contact);
app.get('/faq', routes.faq);

app.get('/profile', routes.profile);

app.get('/projects', routes.projects);

app.get('/ideas', routes.ideas);
app.get('/ideas/favorites', ensureAuth, routes.ideas_favorites);
app.get('/ideas/user', ensureAuth, routes.ideas_user);

app.get('/idea/fav', ensureAuth, routes.idea_add_fav);
app.get('/idea/unfav', ensureAuth, routes.idea_remove_fav);

app.get('/teams', ensureAuth, routes.join_team);

app.get('/idea', routes.idea);
app.get('/idea/team', routes.idea);
app.get('/idea/plan', routes.idea);
app.post('/upvote', routes.upvote);

app.post('/ideas', routes.ideas_post);
app.post('/idea_comment', routes.idea_comment);



app.use(function(req, res) {
	res.status(404).end('error');
});

// Make sure user is authenticated middleware
function ensureAuth(req, res, next) {
	if (req.user) return next();
	res.redirect('/login')
}

// Launch server
app.listen(process.env.PORT || 3000);
