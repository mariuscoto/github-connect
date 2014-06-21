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
        // Mark favorites
        if (_self.user != null && _self.user.followed.indexOf(projects[i]._id) > -1)
          projects[i].fav = true;
        // Markdown project description
        //projects[i].description = markdown.toHTML(projects[i].description);
        // Format date
        projects[i].date_post_f = core.get_time_from(projects[i].date_post);
        // Remove new lines
        projects[i].description = projects[i].description.replace(/(\r\n|\n|\r)/gm,"");
        // Shorten description
        if (projects[i].description.length > MACRO.PROJECT.DESC)
          projects[i].description = (projects[i].description).substring(0, MACRO.PROJECT.DESC) + " [...]";
      }
    }

    res.render('projects', {
      'title':      page_title,
      'user':       _self.user,
      'projects':   projects,
      'currentUrl': req.path,
      'sort':       req.query.sort,
      'repo':       req.query.repo,
      'lang_opt':   MACRO.LANG,
      'type':       req.query.type,
      'size':       req.query.size,
      'lang':       req.query.lang,
      'search':     req.query.search
    });

  }
};


/*
List all info of selected project.
*/
exports.one = function(req, res) {
  if (!req.query.id) return res.redirect('/projects');
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  var _self = {};

  Projects.findOne({'_id': req.query.id}).exec(gotProject);

  function gotProject(err, project) {
    _self.project = project;

    // Markdown project description
    project.description_md = markdown.toHTML(project.description);
    // Compute post date
    project.date_post_f = core.get_time_from(project.date_post);

    Users.findOne({'user_name': project.user_name}).exec(gotOwner);
  }

  function gotOwner(err, cuser) {
    _self.cuser = cuser;

    // Compute last seen date
    cuser.last_seen_f = core.get_time_from(cuser.last_seen);

    ProjectComments.find({'project': req.query.id}).sort('date').exec(gotComments);
  }

  function gotComments(err, comments) {
    _self.comments = comments;

    // Get project repo
    for (var i=0; i<_self.cuser.repos.length; i++)
      if (_self.cuser.repos[i].name == _self.project.repo)
        _self.repo = _self.cuser.repos[i]

    for (i in comments) {
      // Compute post date
      _self.comments[i].date_f = core.get_time_from(comments[i].date);
    }

    Users.findOne({'user_id': uid}).exec(gotUser);
  }

  function gotUser(err, user) {
    if (user) {
      for (i in _self.comments) {
        // check for already voted comments
        if (_self.comments[i].upvotes.indexOf(user.user_id) > -1)
          _self.comments[i].upvote = true;
        // check for flagged comments
        if (_self.comments[i].flags.indexOf(user.user_id) > -1)
          _self.comments[i].flag = true;
      }
    }

    res.render('project', {
      'title':      _self.project.title,
      'user':       user,
      'cuser':      _self.cuser,
      'repo':       _self.repo,
      'project':    _self.project,
      'currentUrl': req.path,
      'sort':       req.query.sort,
      'comments':   _self.comments,
      'lang_opt':   MACRO.LANG
    });
  }
};


/*
Search and filter projects list.
*/
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


/*
Project admin page. Owner can edit project size, language used or description.
Project can also be removed from this tab.
*/
exports.settings = function(req, res) {
  if (!req.query.id) return res.redirect('/projects');
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  var _self = {};

  Projects.findOne({'_id': req.query.id}).exec(gotProject);

  function gotProject(err, project) {
    _self.project = project;
    if (!project) return res.redirect('/projects');

    // Markdown project description
    _self.project.description_md = markdown.toHTML(project.description);
    // Compute post date
    _self.project.date_post_f = core.get_time_from(project.date_post);

    Users.findOne({'user_name': project.user_name}).exec(gotOwner);
  }

  function gotOwner(err, cuser) {
    _self.cuser = cuser;

    // Compute last seen date for owner
    _self.cuser.last_seen_f = core.get_time_from(cuser.last_seen);
    // Get project repo
    for (var i=0; i<cuser.repos.length; i++)
      if (cuser.repos[i].name == _self.project.repo)
        _self.repo = cuser.repos[i];

    Users.findOne({'user_id': uid}).exec(gotUser);
  }

  function gotUser(err, user) {
    res.render('project', {
      'title':      _self.project.title,
      'user':       user,
      'cuser':      _self.cuser,
      'repo':       _self.repo,
      'project':    _self.project,
      'currentUrl': req.path,
      'lang_opt':   MACRO.LANG
    });
  }
};


/*
Edit project handler.
*/
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


/*
Add new project. Must have title and description to be added.
*/
exports.add = function(req, res) {
  if (req.body.repo && req.body.title)
    new Projects({
      'repo':         req.body.repo,
      'user_name':    req.session.auth.github.user.login,
      'size':         req.body.size.toLowerCase(),
      'lang':         req.body.lang.toLowerCase(),
      'title':        req.body.title,
      'type':         req.body.type,
      'description':  req.body.description,
      'date_post':    Date.now(),
      'points':       MACRO.PROJECT.NEW

    }).save(savedProject);
  else
    res.redirect('/projects');

  function savedProject(err, todo, count) {
    // Update total score
    var conditions = {'user_id': req.session.auth.github.user.id};
    var update = {$inc: {'points_projects': MACRO.PROJECT.NEW }};
    Users.update(conditions, update).exec();

    console.log("* " + req.session.auth.github.user.login + " added project.");
    res.redirect('/projects');
  }
};


/*
Add comment to a project. Notify owner.
*/
exports.comment = function(req, res) {
  // Increment comments number
  var conditions = {'_id': req.query.id };
  var update = {$inc: {'comments_num': 1}};
  Projects.update(conditions, update, updatedProject);

  function updatedProject (err, num) {
    new ProjectComments({
      'user_name':  req.session.auth.github.user.login,
      'project':    req.query.id,
      'content':    req.body.content
    }).save(function(err, comm, count) {
      console.log("* " + req.session.auth.github.user.login +
                  " commented on " + req.query.id);
      res.redirect('/project?id=' + req.query.id);
    });

    Projects.findOne({'_id': req.query.id}).exec(gotProject);
  }

  function gotProject(err, project) {
    new Notifications({
      'src':    req.session.auth.github.user.login,
      'dest':   project.user_name,
      'type':   "proj_comm",
      'link':   "/project?id=" + req.query.id
    }).save(function(err, comm, count) {
      console.log("* " + project.user_name + " notified.");
    });

    var conditions = {'user_name': project.user_name};
    var update = {$set: {'unread': true}};
    Users.update(conditions, update).exec();
  }
};


/*
Add project to followed list. Used in AJAX calls.
*/
exports.follow = function(req, res) {
  var conditions = {'user_id': req.session.auth.github.user.id};
  var update = {$push: {'followed': req.query.id}};
  Users.update(conditions, update, function (err, num) {
    if (num) res.json({success: true});
  });
};


/*
Remove project from followed list. Used in AJAX calls.
*/
exports.unfollow = function(req, res) {
  var conditions = {'user_id': req.session.auth.github.user.id};
  var update = {$pull: {'followed': req.query.id}};
  Users.update(conditions, update, function (err, num) {
    if (num) res.json({success: true});
  });
};


/*
Upvote project comment. Used in AJAX calls.
*/
exports.upvote = function(req, res) {
  var conditions = {'_id': req.query.id};
  var update = {$addToSet: {'upvotes': req.session.auth.github.user.id}};
  ProjectComments.update(conditions, update, function (err, num) {
    if (num) res.json({success: true});
  });
};


/*
Flag project comment. Used in AJAX calls.
*/
exports.flag = function(req, res) {
  var conditions = {'_id': req.query.id};
  var update = {$addToSet: {'flags': req.session.auth.github.user.id}};
  ProjectComments.update(conditions, update, function (err, num) {
    if (num) res.json({success: true});
  });
};


/*
Totally remove project, associated comments and update user score.
*/
exports.remove = function(req, res) {

  Projects.findOne({'_id': req.query.id}).exec(gotProject);

  function gotProject(err, project) {
    // Allow only edits by owner
    if (project.user_name != req.session.auth.github.user.login)
      return res.redirect('/projects');

    // Update score
    var conditions = {'user_id': req.session.auth.github.user.id};
    var update = {$inc: {'points_projects': -(project.points)}};
    Users.update(conditions, update).exec();

    Projects.remove({'_id': req.query.id}, function (err, num) {
      if (err) console.log("[ERR] Could not remove project.");
    });

    ProjectComments.remove({'idea': req.query.id}, function (err, num) {
      if (err) console.log("[ERR] Could not remove project comments.");
    });

    res.redirect('/projects');
  }
};
