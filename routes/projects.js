var MACRO = require('../model/macro.js')
var core = require('../core.js')
var mongoose = require('mongoose');
var Projects = mongoose.model('Projects');
var Users = mongoose.model('Users');
var ProjectComments = mongoose.model('ProjectComments');
var Notifications = mongoose.model('Notifications');
var markdown = require( "markdown" ).markdown;


/*
Get list of all projects.
There can also be filtered results, by string, project size, used programming
language, project type (bug/feature) or the repo from which they belong.
*/
exports.index = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  var _self = {}, conditions = {};
  var sort_type = null;
  var page_title = "Projects"

  if (req.query.sort == "most_recent") {
    sort_type = '-date_post';
  } else if (req.query.sort == "most_commented") {
    sort_type = '-comments_num';
  }

  Users.findOne({'user_id': uid}).exec(gotUser);

  function gotUser (err, user) {
    _self.user = user;

    // Check for query string and match using regex
    if (req.query.search) { conditions['$or'] = [
        {'description' : new RegExp(req.query.search, "i")},
        {'title'       : new RegExp(req.query.search, "i")}]
    }

    // Check filters
    if (req.query.type) conditions['type'] = req.query.type;
    if (req.query.size) conditions['size'] = req.query.size;
    if (req.query.lang) conditions['lang'] = req.query.lang;

    // Check find conditions
    if (req.path == "/projects_user") conditions['uid'] = user.user_id;
    if (req.path == "/projects_fav")  conditions['_id'] = {$in: user.followed};

    // Filter by specific repo
    if (req.query.repo) {
      conditions['repo'] = req.query.repo;
      page_title = "Projects of " + req.query.repo;
    }

    Projects.find(conditions).sort(sort_type).exec(gotProjects);
  }

  function gotProjects(err, projects) {

    if (projects) {
      for (var i=0; i<projects.length; i++) {
        // mark favorites
        if (_self.user != null && _self.user.followed.indexOf(projects[i]._id) > -1)
          projects[i].fav = true;
        // markdown project description
        //projects[i].description = markdown.toHTML(projects[i].description);
        // format date
        projects[i].date_post_f = core.get_time_from(projects[i].date_post);
        // remove new lines
        projects[i].description = projects[i].description.replace(/(\r\n|\n|\r)/gm,"");
        // shorten description
        if (projects[i].description.length > MACRO.PROJECT.DESC)
          projects[i].description = (projects[i].description).substring(0, MACRO.PROJECT.DESC) + " [...]";
      }
    }

    res.render('projects', {
      title:      page_title,
      user:       _self.user,
      projects:   projects,
      currentUrl: req.path,
      sort:       req.query.sort,
      repo:       req.query.repo,
      lang_opt:   MACRO.LANG,
      type:       req.query.type,
      size:       req.query.size,
      lang:       req.query.lang,
      search:     req.query.search
    });

  }
};


exports.one = function(req, res) {
  if (!req.query.id) return res.redirect('/projects');
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Projects
  .findOne({ '_id': req.query.id })
  .exec(function(err, project) {
    if (!project) return res.redirect('/projects');

    // Markdown project description
    project.description_md = markdown.toHTML(project.description);
    // compute post date
    project.date_post_f = core.get_time_from(project.date_post);

    Users
    .findOne({ 'user_name': project.user_name})
    .exec(function(err, cuser) {
      if (err) return handleError(err);

      // compute last seen date
      cuser.last_seen_f = core.get_time_from(cuser.last_seen);

      ProjectComments
      .find({ 'project': req.query.id })
      .sort('date')
      .exec(function(err, comments) {

        // get project repo
        var repo;
        for (var i=0; i<cuser.repos.length; i++)
          if (cuser.repos[i].name == project.repo)
            repo = cuser.repos[i]

        for (i in comments) {
          // compute post date
          comments[i].date_f = core.get_time_from(comments[i].date);
        }

        Users
        .findOne({ 'user_id': uid })
        .exec(function (err, user) {

          if (user) {
            for (i in comments) {
              // check for already voted comments
              if (comments[i].upvotes.indexOf(user.user_id) > -1)
                comments[i].upvote = true;
              // check for flagged comments
              if (comments[i].flags.indexOf(user.user_id) > -1)
                comments[i].flag = true;
            }
          }

          res.render('project', {
            title:      project.title,
            user:       user,
            cuser:      cuser,
            repo:       repo,
            project:    project,
            currentUrl: req.path,
            sort:       req.query.sort,
            comments:   comments,
            lang_opt:   MACRO.LANG
          });

        });
      });
    });
  });
};

exports.search = function(req, res) {
  var url = "";

  // Add string query, truncated to some limit
  if (req.body.string)
    url += "search=" + req.body.string.substring(0, MACRO.QUERY_LIMIT) + "&";

  // Add project filters
  if (req.body.type && req.body.type != 'Type') url += "type=" + req.body.type + "&";
  if (req.body.size && req.body.size != 'Size') url += "size=" + req.body.size + "&";
  if (req.body.lang && req.body.lang != 'Lang') url += "lang=" + req.body.lang + "&";

  return res.redirect('/projects?' + url.toLowerCase());
};

exports.settings = function(req, res) {
  if (!req.query.id) return res.redirect('/projects');
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  Projects
  .findOne({ '_id': req.query.id })
  .exec(function(err, project) {
    if (!project) return res.redirect('/projects');

    // Markdown project description
    project.description_md = markdown.toHTML(project.description);
    // compute post date
    project.date_post_f = core.get_time_from(project.date_post);

    Users
    .findOne({ 'user_name': project.user_name})
    .exec(function(err, cuser) {
      if (err) return handleError(err);

      // compute last seen date
      cuser.last_seen_f = core.get_time_from(cuser.last_seen);

      // get project repo
      var repo;
      for (var i=0; i<cuser.repos.length; i++)
        if (cuser.repos[i].name == project.repo)
          repo = cuser.repos[i]

      Users
      .findOne({ 'user_id': uid })
      .exec(function (err, user) {

        res.render('project', {
          title:      project.title,
          user:       user,
          cuser:      cuser,
          repo:       repo,
          project:    project,
          currentUrl: req.path,
          lang_opt:   MACRO.LANG
        });

      });
    });
  });
};


exports.edit = function(req, res) {
  if (!req.query.id) return res.redirect('/projects');

  Projects.findOne({'_id': req.query.id}).exec(gotProject);

  function gotProject(err, project) {
    // Allow only edits by owner
    if (project.user_name != req.session.auth.github.user.login)
      return res.redirect('/projects');

    // Update project info
    var conditions = {'_id': req.query.id};
    var update = {$set: {
      'description': req.body.description,
      'size':        req.body.size,
      'lang':        req.body.lang
    }};
    Projects.update(conditions, update, function (err, num) {
      console.log("* Owner made changes to " + req.query.id);
      res.redirect('/project?id=' + req.query.id);
    });
  }
};


exports.add = function(req, res) {
  // add project only if it has a title and description
  // TODO: check if type is known
  if (req.body.repo && req.body.title)
    new Projects({
      repo:         req.body.repo,
      user_name :   req.session.auth.github.user.login,
      size:         req.body.size.toLowerCase(),
      lang:         req.body.lang.toLowerCase(),
      title:        req.body.title,
      type:         req.body.type,
      description:  req.body.description,
      date_post:    Date.now(),
      points:       MACRO.PROJECT.NEW

    }).save(function (err, todo, count) {
      // update total score
      var conditions = {user_id: req.session.auth.github.user.id};
      var update = {$inc: {points_projects: MACRO.PROJECT.NEW }};
      Users.update(conditions, update).exec();

      console.log("* " + req.session.auth.github.user.login + " added project.");
      res.redirect('/projects');
    });
  else
    res.redirect('/projects');
};


exports.comment = function(req, res) {
  // increment comments number
  var conditions = { _id: req.query.id };
  var update = {$inc: {comments_num: 1}};
  Projects.update(conditions, update, function (err, num) {
    new ProjectComments({
      user_name:  req.session.auth.github.user.login,
      project:    req.query.id,
      content:    req.body.content,
      date:       Date.now()
    }).save(function(err, comm, count) {
      console.log("* " + req.session.auth.github.user.login +
                  " commented on " + req.query.id);
      res.redirect('/project?id=' + req.query.id);
    });

    Projects
    .findOne({ '_id': req.query.id })
    .exec(function(err, project) {
      new Notifications({
        src:    req.session.auth.github.user.login,
        dest:   project.user_name,
        type:   "proj_comm",
        seen:   false,
        date:   Date.now(),
        link:   "/project?id=" + req.query.id
      }).save(function(err, comm, count) {
        console.log("* " + project.user_name + " notified.");
      });

      var conditions = {user_name: project.user_name};
      var update = {$set: {unread: true}};
      Users.update(conditions, update).exec();
    });
  });
};


exports.follow = function(req, res) {
  var conditions = {user_id: req.session.auth.github.user.id};
  var update = {$push: {followed: req.query.id}};
  Users.update(conditions, update, function (err, num) {
    if (num) res.json({success: true});
  });
};


exports.unfollow = function(req, res) {
  var conditions = {user_id: req.session.auth.github.user.id};
  var update = {$pull: {followed: req.query.id}};
  Users.update(conditions, update, function (err, num) {
    if (num) res.json({success: true});
  });
};


exports.upvote = function(req, res) {
  var conditions = {_id: req.query.id};
  var update = {$addToSet: {upvotes: req.session.auth.github.user.id}};
  ProjectComments.update(conditions, update, function (err, num) {
    if (num) {
      console.log("* " + req.session.auth.github.user.login +
                  " upvoted " + req.query.id);
      res.json({success: true});
    }
  });
};


exports.flag = function(req, res) {
  var conditions = {_id: req.query.id};
  var update = {$addToSet: {flags: req.session.auth.github.user.id}};
  ProjectComments.update(conditions, update, function (err, num) {
    if (num) {
      console.log("* " + req.session.auth.github.user.login +
                  " flagged " + req.query.id);
      res.json({success: true});
    }
  });
};


exports.remove = function(req, res) {
  Projects
  .findOne({ '_id': req.query.id })
  .exec(function(err, project) {
    // allow only edits by owner
    if (project.user_name != req.session.auth.github.user.login)
      return res.redirect('/projects');

    // update score
    var conditions = {user_id: req.session.auth.github.user.id};
    var update = {$inc: {points_projects: -(project.points)}};
    Users.update(conditions, update).exec();

    Projects.remove({_id: req.query.id}, function (err, num) {
      console.log("* " + req.session.auth.github.user.login +
                  " removed project " + req.query.id);
    });

    ProjectComments.remove({idea: req.query.id}, function (err, num) {
      console.log("* " + req.session.auth.github.user.login +
                  " removed all comments from " + req.query.id);
    });

    res.redirect('/projects');
  });
};
