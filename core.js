var mongoose = require('mongoose');
var https = require('https');

var Repo = mongoose.model('Repo');

var nextUserId = 0;
global.usersById = {};
var usersByGhId = {};

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

function update_repo_owner(repo, user, accessToken) {
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

exports.login = function(sess, accessToken, accessTokenExtra, ghUser) {

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

                    var nodemailer = require("nodemailer");

                    // create reusable transport method (opens pool of SMTP connections)
                    var smtpTransport = nodemailer.createTransport("SMTP",{
                            service: "Gmail",
                                auth: {
                                            user: "",
                                            pass: ""
                                       }
                    });

                    // setup e-mail data with unicode symbols
                    var mailOptions = {
                            from: "github_connectTeam", // sender address
                            to: user.user_email,
                            subject: "Welcome to github-connect", // Subject line
                            text: "Welcome to the most wonderful site in the world", // plaintext body
                            html: "<b>Hello world ✔</b>" // html body
                    }

                    // send mail with defined transport object
                    smtpTransport.sendMail(mailOptions, function(error, response){
                            if(error){
                                     console.log(error);
                            }else{
                                     console.log("Message sent: " + response.message);
                                  }

                           smtpTransport.close(); // shut down the connection pool, no more messages
                    });

        

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
}