var MACRO = require('./model/macro.js');
var mongoose = require('mongoose');
var https = require('https');
var fs = require('fs');

var Repo = mongoose.model('Repo');
var Users = mongoose.model('Users');
var Notifications = mongoose.model('Notifications');
var Challenges = mongoose.model('Challenges');

var nextUserId = 0;
global.usersById = {};
var usersByGhId = {};


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
        mailOpt['from']    = "welcome@gconnect.com";
        mailOpt['to']      = destination,
        mailOpt['subject'] = 'Welcome to Github-connect',
        mailOpt['text']    = '',
        mailOpt['html']    = html;
      } else if (type == 'feedback') {
        mailOpt['from']    = "welcome@gconnect.com";
        mailOpt['to']      = 'cmarius02@gmail.com',
        mailOpt['subject'] = 'Feedback Github-connect: ' + body.email,
        mailOpt['text']    = body.msg
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

function update_repo_owner(repo, user_name, accessToken) {
  var options = {
    host: "api.github.com",
    path: "/repos/" + user_name + "/" + repo + "?access_token=" + accessToken,
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
      var conditions = {user_name: user_name, 'repos.name': repo};
      var update = {$set: {'repos.$.owner': repo_owner}};
      Users.update(conditions, update, function (err, num) {
        update_pull_req(repo, repo_owner, user_name, accessToken);
      });

    });
  });
  request.end();
}

function update_pull_req (repo, owner, user_name, accessToken) {
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
      var count = 0, diff = 0;
      var pulls = JSON.parse(body);

      // get current info
      Users.findOne({'user_name': user_name}, function(err, user) {

        for (var i in pulls) {
          // consider just merged pulls of current user
          if (pulls[i].state == 'closed' &&
              pulls[i].user &&
              pulls[i].user.login == user_name &&
              pulls[i].merged_at) {

            count++;
          }
        }

        // check if anything has changed
        for (var r in user.repos) {
          if (user.repos[r].name == repo) {
            // new pulls accepted, but no first login, notify user
            diff = count - user.repos[r].closed_pulls;
            if (diff > 0 && user.repos[r].closed_pulls != 0) {
              new Notifications({
                src:    repo,
                dest:   user_name,
                type:   "pull_accepted",
                seen:   false,
                date:   Date.now(),
                link:   ""
              }).save(function(err, todo, count) {
                if (err) console.log("[ERR] Notification not sent.");
              });
            }

            // first pull req, inc tentacles
            if (user.repos[r].closed_pulls == 0 && count != 0) {
              var conditions = {'user_name': user_name};
              var update = {$inc: {'tentacles': 1}};
              Users.update(conditions, update).exec();
            }

            break;
          }
        }

        // update pulls count, inc tentacles, add points, update total
        var conditions = {'user_name': user_name, 'repos.name': repo};
        var update = {
          $inc: {'points_repos': diff * MACRO.USER.PULL},
          $set: {'repos.$.points': count * MACRO.USER.PULL,
                 'repos.$.closed_pulls': count,}
        };
        Users.update(conditions, update).exec();
      });
    });
  });
  request.end();
}

exports.get_followers = function (user_name, accessToken, notify) {
  var options = {
    host: "api.github.com",
    path: "/users/" + user_name + "/followers?access_token=" + accessToken,
    method: "GET",
    headers: { "User-Agent": "github-connect" }
  };

  var request = https.request(options, function(response){
    var body = '';
    response.on("data", function(chunk){ body+=chunk.toString("utf8"); });
    response.on("end", function(){
      var json = JSON.parse(body);

      if (notify) { // check old value
        Users.findOne({user_name: user_name}, function(err, user) {
          var msg, diff = user.followers_no - json.length;
          if (diff > 0) msg = "lost " + diff;
          else if (diff < 0) msg = -(diff) + " new";

          // notify user only if we have some action going on
          if (diff != 0) {
            new Notifications({
              src:    "",
              dest:   user.user_name,
              type:   "followers_no",
              seen:   false,
              date:   Date.now(),
              link:   msg
            }).save(function(err, todo, count ) {
              if (err) console.log("[ERR] Notification not sent.");
            });

            var conditions = {user_name: user.user_name};
            var update = {$set: {unread: true}};
            Users.update(conditions, update).exec();
          }
        });
      }

      // update user info
      var conditions = {user_name: user_name};
      var update = {$set: {followers_no: json.length}};
      Users.update(conditions, update).exec();
    });
  });
  request.end();
}

exports.get_following = function (user_name, accessToken, notify) {
  var options = {
    host: "api.github.com",
    path: "/users/" + user_name + "/following?access_token=" + accessToken,
    method: "GET",
    headers: { "User-Agent": "github-connect" }
  };

  var request = https.request(options, function(response){
    var body = '';
    response.on("data", function(chunk){ body+=chunk.toString("utf8"); });
    response.on("end", function(){
      var json = JSON.parse(body);

      if (notify) { // check old value
        Users.findOne({user_name: user_name}, function(err, user) {
          var msg, diff = user.following_no - json.length;
          if (diff > 0) msg = "lost " + diff;
          else if (diff < 0) msg = -(diff) + " new";

          // notify user only if we have some action going on
          if (diff != 0) {
            new Notifications({
              src:    "",
              dest:   user.user_name,
              type:   "following_no",
              seen:   false,
              date:   Date.now(),
              link:   msg
            }).save(function(err, todo, count ) {
              if (err) console.log("[ERR] Notification not sent.");
            });

            var conditions = {user_name: user.user_name};
            var update = {$set: {unread: true}};
            Users.update(conditions, update).exec();
          }
        });
      }

      // update user info
      var conditions = {user_name: user_name};
      var update = {$set: {following_no: json.length}};
      Users.update(conditions, update).exec();
    });
  });
  request.end();
}

function update_repos (user_name, accessToken, notify) {
  var options = {
    host: "api.github.com",
    path: "/users/" + user_name + "/repos?access_token=" + accessToken,
    method: "GET",
    headers: { "User-Agent": "github-connect" }
  };

  var request = https.request(options, function(response){
    var body = '';
    response.on("data", function(chunk){ body+=chunk.toString("utf8"); });
    response.on("end", function(){
      var json = JSON.parse(body);
      var json_back = JSON.parse(body);
      var repos_back = [];
      var sum = 0; // sum of all new watcher, forks points

      // get current info if available
      Users.findOne({'user_name': user_name}, function(err, user) {
        if (user) repos_back = user.repos.slice(0);

        for (var k in json) {
          var points = 0; // total points
          if ({}.hasOwnProperty.call(json, k) && !json[k].private) {

            for (var y in user.repos) {
              if (json[k].name == user.repos[y].name) {
                // remove processed repos from backup
                json_back[k].name = '';
                repos_back[y].name = null;

                // check fork_count
                var msg, diff = json[k].forks_count - user.repos[y].forks_count;
                if (diff > 0) msg = "got " + diff + " new";
                else if (diff < 0) msg = "lost " + -(diff);
                sum += diff * MACRO.USER.FORK;
                if (diff != 0) {
                  new Notifications({
                    src:    json[k].name,
                    dest:   user.user_name,
                    type:   "fork_count",
                    seen:   false,
                    date:   Date.now(),
                    link:   msg
                  }).save(function(err, todo, count) {
                    if (err) console.log("[ERR] Notification not sent.");
                  });
                }

                // check watchers_count
                diff = json[k].watchers_count - user.repos[y].watchers_count;
                if (diff > 0) msg = "got " + diff + " new";
                else if (diff < 0) msg = "lost " + (-diff);
                sum += diff * MACRO.USER.WATCH;
                if (diff != 0) {
                  new Notifications({
                    src:    json[k].name,
                    dest:   user.user_name,
                    type:   "watch_count",
                    seen:   false,
                    date:   Date.now(),
                    link:   msg
                  }).save(function(err, todo, count) {
                    if (err) console.log("[ERR] Notification not sent.");
                  });
                }

                var points = 0;
                // update existing repos + update pull req
                if (json[k].fork) {
                  update_pull_req(json[k].name, user.repos[y].owner, user_name, accessToken);

                // compute points for own repos
                } else {
                  points += MACRO.USER.REPO + MACRO.USER.FORK * json[k].forks_count;
                  points += MACRO.USER.WATCH * json[k].watchers_count ;
                }

                // update info in db
                var repo_name = json[k].name;
                var conditions = {'user_name': user_name, 'repos.name': repo_name};
                var update = { $set: {
                  'repos.$.description':    json[k].description,
                  'repos.$.forks_count':    json[k].forks_count,
                  'repos.$.size':           json[k].size,
                  'repos.$.watchers_count': json[k].watchers_count,
                  'repos.$.points':         points
                }};
                Users.update(conditions, update).exec();

                break;
              }
            }
          }
        }

        // remove non processed repos and asociated points
        for (var y in repos_back) {
          if (repos_back[y].name != null) {
            var conditions = {'user_name': user_name};
            var update = { $pull: {repos: {'name': repos_back[y].name}},
                           $inc:  {points_repos: -(repos_back[y].points)}};
            Users.update(conditions, update).exec();
          }
        }

        // add new repos from backup we created
        var repos = [], total = 0;
        for (var k in json_back) {
            if (json_back[k].name != '') {
              var points = 0; // total points
              if ({}.hasOwnProperty.call(json_back, k) && !json_back[k].private) {

                if (json_back[k].fork) { // get owner of forked repos and pull req
                  update_repo_owner(json_back[k].name, user_name, accessToken);

                } else { // compute points for own repos
                  points += MACRO.USER.REPO + MACRO.USER.FORK * json_back[k].forks_count;
                  points += MACRO.USER.WATCH * json_back[k].watchers_count ;
                  total  += points;
                }
              }


              repos.push(new Repo({
                name:           json_back[k].name,
                description:    json_back[k].description,
                html_url:       json_back[k].html_url,
                fork:           json_back[k].fork,
                forks_count:    json_back[k].forks_count,
                size:           json_back[k].size,
                watchers_count: json_back[k].watchers_count,
                points:         points,
              }));
            }
        }

        // update repos and score + sum of new notifications
        var conditions = {user_name: user_name};
        var update = {
          $pushAll: {repos: repos},
          $inc: {points_repos: total + sum}
        };
        Users.update(conditions, update).exec();
      });
    });
  });
  request.end();
}

function get_repos (user_name, accessToken, notify) {
  var options = {
    host: "api.github.com",
    path: "/users/" + user_name + "/repos?access_token=" + accessToken,
    method: "GET",
    headers: { "User-Agent": "github-connect" }
  };

  var request = https.request(options, function(response){
    var body = '';
    response.on("data", function(chunk){ body+=chunk.toString("utf8"); });
    response.on("end", function(){
      var json = JSON.parse(body);
      var repos = [], total = 0;

      for (var k in json) {
        var points = 0; // total points
        if ({}.hasOwnProperty.call(json, k) && !json[k].private) {

          if (json[k].fork) { // get owner of forked repos and pull req
            update_repo_owner(json[k].name, user_name, accessToken);

          } else { // compute points for own repos
            points += MACRO.USER.REPO + MACRO.USER.FORK * json[k].forks_count;
            points += MACRO.USER.WATCH * json[k].watchers_count ;
            total  += points;
          }
        }

        repos.push(new Repo({
          name:           json[k].name,
          description:    json[k].description,
          html_url:       json[k].html_url,
          fork:           json[k].fork,
          forks_count:    json[k].forks_count,
          size:           json[k].size,
          watchers_count: json[k].watchers_count,
          points:         points,
          owner:          null
        }));
      }

      // update repos and score
      var conditions = {user_name: user_name};
      var update = {$set: {repos: repos, points_repos: total}};
      Users.update(conditions, update, function (err, num) {
        console.log("* Updated repos for " + user_name);
      });
    });
  });
  request.end();
}

exports.login = function(sess, accessToken, accessTokenExtra, ghUser) {
  sess.oauth = accessToken;
  if (typeof usersByGhId[ghUser.id] === 'undefined') {

    usersByGhId[ghUser.id] = addUser('github', ghUser);

    Users
    .findOne({ 'user_id': usersByGhId[ghUser.id].github.id },
               'user_name', function (err, user) {
      if (err) return handleError(err);
      if (user != null) {
        // update last_seen
        var conditions = {user_name: usersByGhId[ghUser.id].github.login};
        var update = {$set: {last_seen: Date.now()}};
        Users.update(conditions, update, function (err, num) {
          console.log("* User " + user.user_name + " logged in.");
        });
        // get repos info
        update_repos(user.user_name, accessToken, true);
        // update followers number and notify
        module.exports.get_followers(user.user_name, accessToken, true);
        // update following number and notify
        module.exports.get_following(user.user_name, accessToken, true);

      } else {
        // send welcome notification
        new Notifications({
          src:    null,
          dest:   usersByGhId[ghUser.id].github.login,
          type:   "welcome",
          seen:   false,
          date:   Date.now(),
          link:   "/faq"
        }).save(function(err, todo, count) {
          if (err) console.log("[ERR] Notification not sent.");
        });

        // Import data from github
        return new Users ({
          user_id:       usersByGhId[ghUser.id].github.id,
          user_name:     usersByGhId[ghUser.id].github.login,
          user_fullname: usersByGhId[ghUser.id].github.name,
          user_email:    usersByGhId[ghUser.id].github.email,
          avatar_url:    usersByGhId[ghUser.id].github.avatar_url,
          location:      usersByGhId[ghUser.id].github.location,
          join_github:   usersByGhId[ghUser.id].github.created_at,
          join_us:       Date.now(),
          last_seen:     Date.now()
        }).save (function (err, user, count) {
          console.log("* User " + user.user_name + " added.");
          // get repos info
          get_repos(user.user_name, accessToken, false);
          // update followers number
          module.exports.get_followers(user.user_name, accessToken, false);
          // update following number
          module.exports.get_following(user.user_name, accessToken, false);
          // send welcome email
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

/*
Refresh all repos from all challeneges that are active ('live').
*/
exports.refresh_challenges = function() {

  Challenges.find({'status': 'live'}).exec(gotChallenges);

  function gotChallenges(err, all) {

    // For each challenge in pool
    for (var c in all) {

      var ch = all[c];

      // Update last refresh date
      var update = {$set: { 'refresh': Date.now()}};
      Challenges.update({'link': ch.link}, update).exec();

      //New request for each repo of challenge
      for (var r=0; r<ch.repos.length; r++) {

        var options = {
          host: "api.github.com",
          path: "/repos/" + ch.repos[r] + "/pulls?state=all",
          method: "GET",
          headers: { "User-Agent": "github-connect" }
        };

        var request = https.request(options, function(response){
          var body = '';
          response.on("data", function(chunk){ body+=chunk.toString("utf8"); });
          response.on("end", function(){
            var pulls = JSON.parse(body);

            // Log errors
            if (pulls.message)
              console.log("[ERR] " + pulls.message + " - " + options.path
                + " (" + pulls.documentation_url + ")");

            for (var p in pulls) {
              // Accept only pulls created after challenge start date, before end
              // date and only from registered users
              if (new Date(pulls[p].created_at).getTime() > ch.start.getTime() &&
                  new Date(pulls[p].created_at).getTime() < ch.end.getTime() &&
                  ch.users.indexOf(pulls[p].user.login) > -1) {

                // Check if merge date exists
                var merge_date;

                if (!pulls[p].merged_at) merge_date = null;
                else merge_date = new Date(pulls[p].merged_at);

                var update = {$addToSet: { 'pulls': {
                  repo:      ch.repos[1],
                  auth:      pulls[p].user.login,
                  url:       pulls[p].html_url,
                  title:     pulls[p].title,
                  created:   new Date(pulls[p].created_at),
                  merged:    merge_date
                }}};

                Challenges.update({'link': ch.link}, update).exec();
              }
            }

          });
        });
        request.end();
      }
    }
  }
}
