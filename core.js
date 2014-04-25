var mongoose = require('mongoose');
var https = require('https');
var fs = require('fs');

var Repo = mongoose.model('Repo');
var Users = mongoose.model('Users');
var Notifications = mongoose.model('Notifications');

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


exports.send_mail = function (destination, type, body) {
	var nodemailer = require("nodemailer");

	// create reusable transport method (opens pool of SMTP connections)
	var smtpTransport = nodemailer.createTransport("SMTP",{
		service: "Gmail",
		auth: {
			user: global.config.mail_user,
			pass: global.config.mail_pass
		}
	});

	fs.readFile(__dirname + '/public/emails/' + type + '.html', 'utf8', function (err, html) {
			var mailOpt = {};

			if (type == 'welcome') {
				mailOpt['from'] 	 = "welcome@gconnect.com";
				mailOpt['to'] 		 = destination,
				mailOpt['subject'] = 'Welcome to Github-connect',
				mailOpt['text'] 	 = '',
				mailOpt['html'] 	 = html;
			} else if (type == 'feedback') {
				mailOpt['from'] 	 = "welcome@gconnect.com";
				mailOpt['to'] 		 = 'cmarius02@gmail.com',
				mailOpt['subject'] = 'Feedback Github-connect: ' + body.email,
				mailOpt['text'] 	 = body.msg
			}

			// send mail with defined transport object
			smtpTransport.sendMail(mailOpt, function(err, response){
				if (err) console.log(err);
				else console.log("* Email sent to " + destination);

				smtpTransport.close();
			});
	});
}


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

exports.get_followers = function (user, accessToken, notify) {
	var options = {
		host: "api.github.com",
		path: "/users/" + user.login + "/followers?access_token=" + accessToken,
		method: "GET",
		headers: { "User-Agent": "github-connect" }
	};

	var request = https.request(options, function(response){
		var body = '';
		response.on("data", function(chunk){ body+=chunk.toString("utf8"); });
		response.on("end", function(){
			var json = JSON.parse(body);

			if (notify) { // check old value
				Users.findOne({user_name: user.login}, function (err, u) {
					var msg, diff = u.followers_no - json.length;
					if (diff > 0) msg = "lost " + diff;
					else if (diff < 0) msg = diff + " new";

					// notify user only if we have some action going on
					if (diff != 0) {
						new Notifications({
							src:    "",
							dest:   user.login,
							type:   "followers_no",
							seen:   false,
							date:   Date.now(),
							link:   msg
						}).save(function(err, todo, count ) {
							console.log("good");
						});

						var conditions = {user_name: user.login};
						var update = {$set: {unread: true}};
						Users.update(conditions, update).exec();
					}
				});
			}

			// update user info
			var conditions = {user_name: user.login};
			var update = {$set: {followers_no: json.length}};
			Users.update(conditions, update).exec();
		});
	});
	request.end();
}

function get_repos (ghUser, accessToken) {
	var options = {
		host: "api.github.com",
		path: "/users/" + ghUser.github.login + "/repos?access_token=" + accessToken,
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
						update_repo_owner (json[k].name, ghUser.github.login, accessToken);

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
			var conditions = {user_id: ghUser.github.id};
			var update = {$set: {repos: repos, points_repos: total}};
			Users.update(conditions, update, {upsert: true}, function (err, num) {
				console.log("* Updated repos for " + ghUser.github.id);
			});

			// update followers number
			module.exports.get_followers(ghUser.github, accessToken, false);
		});
	});

	request.end();
}

exports.login = function(sess, accessToken, accessTokenExtra, ghUser) {

	sess.oauth = accessToken;
	if (typeof usersByGhId[ghUser.id] === 'undefined') {

		usersByGhId[ghUser.id] = addUser('github', ghUser);

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

				// update followers number and notify
				module.exports.get_followers(usersByGhId[ghUser.id].github, accessToken, true);

        // add user info to session
        //ghUser.user = user;
	    } else {

				// Import data from github
				return new Users ({
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

					get_repos(usersByGhId[ghUser.id], accessToken);
					module.exports.send_mail(user.user_email, 'welcome');
				});
	    }
		});
		return usersByGhId[ghUser.id];

	} else {
		return usersByGhId[ghUser.id];
	}
}


exports.get_time_from = function (then) {
	var now = Date.now();

	// interval between time now and db date
	var msec = now - new Date(then).getTime();

	var hh = Math.floor(msec / 1000 / 60 / 60);
	if (hh > 24) { // older that 24 hours
		// return actual date
		return "on " + then.toString().substring(4, 15);

	} else if (hh > 1) { // older than 1 hour
		return hh + " hours ago";

	} else {
		msec -= hh * 1000 * 60 * 60;
		var mm = Math.floor(msec / 1000 / 60);

		if (mm > 1) { // older than 1 mnute
			return mm + " minutes ago";

		} else {
			return "one minute ago";
		}
	}
}
