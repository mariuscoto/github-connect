var mongoose = require('mongoose');
var https = require('https');

// Points macros
var POINTS_REPO = 20;
var POINTS_FORK = 10;
var POINTS_WATCH = 1;
var POINTS_PULL = 30;

exports.update_repo_owner = function(repo, user, accessToken) {
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
