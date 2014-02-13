var express = require('express')
  , db = require('./model/db')
  , fs = require('fs')
  , http = require('http')
  , https = require('https')
  , everyauth = require('everyauth')
  , mongoose = require('mongoose');

config = require('./lib/config')
var app = module.exports = express();

var usersById = {};
var nextUserId = 0;
var repos, id, user;
global.repos = [];
global.id = 0;
global.username = "";

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

everyauth.everymodule
    .findUserById( function (id, callback) {
	callback(null, usersById[id]);
    });

everyauth.github
    .appId(config.gh_clientId)
    .appSecret(config.gh_secret)
    .findOrCreateUser( function (sess, accessToken, accessTokenExtra, ghUser) {

    if (typeof usersByGhId[ghUser.id] === 'undefined') {

	usersByGhId[ghUser.id] = addUser('github', ghUser);

	// Print github login response.
	//console.log(usersByGhId[ghUser.id]);

	// Set global vars
	global.id = usersByGhId[ghUser.id].github.id;
	global.username = usersByGhId[ghUser.id].github.login;

	// Check if user already in db
	// else request info and add him.
	var Users = mongoose.model('Users');
        
	Users.findOne({ 'user_id': usersByGhId[ghUser.id].github.id },
'user_name', function (err, user) {
	    if (err) return handleError(err);
	    if (user != null) {
            console.log("* User " + user.user_name + " logged in.");
	    } else {
            console.log("User not in db.");
            console.log(usersByGhId[ghUser.id].github.login);

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
                console.log("New user added.");
            });
	    }
	})


		var options = {
		    host: "api.github.com",
		    path: "/users/"+ usersByGhId[ghUser.id].github.login +"/repos",
		    method: "GET",
		    headers: {
			"User-Agent": "github-connect" 
		    }
		};

      var request= https.request(options, function(response){
        var body='';
        response.on("data", function(chunk){
          body+=chunk.toString("utf8");
        });

        response.on("end", function(){
          var json=JSON.parse(body);

          //console.log(json);  

          global.repos = [];
          for (var k in json)
            if ({}.hasOwnProperty.call(json, k)) {
              global.repos.push({
                name: json[k].name,
                description: json[k].description
              });
            }

        });
      });
      request.end();
      return usersByGhId[ghUser.id];

    } else {
      return usersByGhId[ghUser.id];
    }
  })
  // redirect after login
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

var user = require('./routes/user');
app.get('/profile', routes.profile);

app.get('/ideas', routes.ideas);
app.get('/ideas/favorites', ensureAuth, routes.ideas_favorites);
app.get('/ideas/user', ensureAuth, routes.ideas_user);

app.get('/idea/fav', ensureAuth, routes.idea_add_fav);
app.get('/idea/unfav', ensureAuth, routes.idea_remove_fav);

app.get('/teams', ensureAuth, routes.join_team);

app.get('/idea', routes.idea);
app.get('/idea/team', routes.idea_team);
app.get('/idea/plan', routes.idea_plan);

app.post('/ideas', routes.ideas_post);
app.post('/idea_comment', routes.idea_comment);

app.use(function(req, res) {
    res.status(404).end('error');
});

// Make sure user is authenticated middleware
function ensureAuth(req, res, next) {
    if (req.user) {
	   return next();
    }
    res.redirect('/login')
}

// Launch server
app.listen(process.env.PORT || 4000);
