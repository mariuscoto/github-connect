var POINTS = require('../model/points.js')
var core = require('../core.js')
var mongoose = require('mongoose');
var Projects = mongoose.model('Projects');
var Users = mongoose.model('Users');
var ProjectComments = mongoose.model('ProjectComments');
var Notifications = mongoose.model('Notifications');
var markdown = require( "markdown" ).markdown;


exports.index = function(req, res) {
  var uid = ((req.session.auth) ? req.session.auth.github.user.id : null);

  var sort_type = null;
  if (req.query.sort == "most_recent") {
    sort_type = '-date_post';
  } else if (req.query.sort == "most_commented") {
    sort_type = '-comments_num';
  }

  Users
  .findOne({ 'user_id': uid })
  .exec(function (err, user) {
    if (err) return handleError(err);

    // set find conditions
    var conditions = null;
    var page_title = "Projects"
    if (req.path == "/projects_user")
      conditions = { 'uid': user.user_id }
    else if (req.path == "/projects_fav")
      conditions = { _id: { $in: user.followed }}
    if (req.query.repo) {
      conditions = { repo: req.query.repo }
      page_title = "Projects of " + req.query.repo
    }

    Projects
    .find(conditions)
    .sort(sort_type)
    .exec(function(err, projects) {

      for (var i=0; i<projects.length; i++) {
        // mark favorites
        if (user != null && user.followed.indexOf(projects[i]._id) > -1)
          projects[i].fav = true;
        // markdown project description
        //projects[i].description = markdown.toHTML(projects[i].description);
        // format date
        projects[i].date_post_f = core.get_time_from(projects[i].date_post);
        // remove new lines
        projects[i].description = projects[i].description.replace(/(\r\n|\n|\r)/gm,"");
        // shorten description
        if (projects[i].description.length > POINTS.PROJECT.DESC)
          projects[i].description = (projects[i].description).substring(0, POINTS.PROJECT.DESC) + " [...]";
      }

      res.render('projects', {
        title:      page_title,
        user:       user,
        projects:   projects,
        currentUrl: req.path,
        sort:       req.query.sort,
        repo:       req.query.repo
      });

    });
  });
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
            comments:   comments
          });

        });
      });
    });
  });
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
      size:         req.body.size,
      lang:         req.body.lang,
      title:        req.body.title,
      type:         req.body.type,
      description:  req.body.description,
      date_post:    Date.now(),
      points:       POINTS.PROJECT.NEW

    }).save(function (err, todo, count) {
      // update total score
      var conditions = {user_id: req.session.auth.github.user.id};
      var update = {$inc: {points_projects: POINTS.PROJECT.NEW }};
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
  var update = {$pop: {followed: req.query.id}};
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
