var CHAR_LIMIT = 330;

var mongoose = require('mongoose');
var Projects = mongoose.model('Projects');
var Users = mongoose.model('Users');
var ProjectComments = mongoose.model('ProjectComments');
var markdown = require( "markdown" ).markdown;



exports.index = function (req, res) {
  var sort_type = null;
  if (req.query.sort == "most_recent") {
    sort_type = '-date_post';
  } else if (req.query.sort == "most_commented") {
    sort_type = '-comments_num';
  }
  
  // set find conditions
  var conditions = null;
  if (req.path == "/projects_user")
    conditions = { 'uid': req.session.user.user_id }
  else if (req.path == "/projects_fav")
    conditions = { _id: { $in: req.session.user.followed }}
    
  // set user
  var uid;
  if (req.session.user) uid = req.session.user.user_id;
  
  Projects
  .find(conditions)
  .sort(sort_type)
  .exec(function (err, projects) {

    Users
    .findOne({ 'user_id': uid })
    .select({ 'followed': true })
    .exec(function (err, user) {
      if (err) return handleError(err);

        for (var i=0; i<projects.length; i++) {
          // mark favorites
          if (user != null && user.followed.indexOf(projects[i]._id) > -1)
            projects[i].fav = true;
          // markdown project description
          //projects[i].description = markdown.toHTML(projects[i].description);
          // remove new lines
          projects[i].description = projects[i].description.replace(/(\r\n|\n|\r)/gm,"");
          // shorten description
				  if (projects[i].description.length > CHAR_LIMIT)
				    projects[i].description = (projects[i].description).substring(0, CHAR_LIMIT) + " [...]";
        }

        res.render('projects', {
          title:      "Projects",
          user:       req.session.user,
          projects:   projects,
          currentUrl: req.path,
          sort:       req.query.sort,
        });
    });
  });
};


exports.one = function (req, res) {
  if (!req.query.id) res.redirect('/projects');
  
  Projects
  .findOne({ '_id': req.query.id })
  .exec(function (err, project) {
    if (!project) res.redirect('/projects');
    
    // Markdown project description
    project.description = markdown.toHTML(project.description);
    
    Users
    .findOne({ 'user_name': project.user_name})
    .exec(function (err, cuser) {
      if (err) return handleError(err);
      
      ProjectComments
      .find({ 'project': req.query.id })
      .exec(function(err, comments) {
        
        if (req.session.user) {
          for (i in comments) {
            // check for already voted comments
            if (comments[i].upvotes.indexOf(req.session.user.user_id) > -1)
              comments[i].upvote = true;                
            // check for flagged comments
            if (comments[i].flags.indexOf(req.session.user.user_id) > -1)
              comments[i].flag = true;
          }
        }
      
        // get project repo
        var repo;
        for (var i=0; i<cuser.repos.length; i++)
          if (cuser.repos[i].name == project.repo)
            repo = cuser.repos[i]

        res.render('project', {
          title:      project.title,
          user:       req.session.user,
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
};


exports.add = function (req, res) {
  if (!req.user) res.redirect('/login');
  
  // add idea only if it has a title and description
  // TODO: check if type is known
  if (req.body.repo && req.body.title)
    new Projects({
      repo:         req.body.repo,
      uid :         req.user.github.id,
      user_name :   req.user.github.login,
      size:         req.body.size,
      title:        req.body.title,
      type:         req.body.type,
      description:  req.body.description,
      date_post:    Date.now()
      
    }).save(function (err, todo, count) {
      console.log("* " + req.user.github.login + " added project.");
      res.redirect('/projects');
    });
  else
    res.redirect('/projects');
};


exports.comment = function(req, res) {
  if (!req.user) res.redirect('/login');
  
  // increment comments number
  var conditions = { _id: req.query.id };
  var update = {$inc: {comments_num: 1}};
  Projects.update(conditions, update, callback);

  function callback (err, num) {
    new ProjectComments({
      uid:        req.user.github.id,
      user_name:  req.user.github.login,
      project:    req.query.id,
      content:    req.body.content,
      date:       Date.now()
      
    }).save(function(err, comm, count) {
			console.log("* " + req.user.github.login + " commented on " + req.query.id);
			res.redirect('/project?id=' + req.query.id);
 		});
  };
};


exports.follow = function(req, res) {
	if (!req.user) res.redirect('/login');
  
  var conditions = {user_id: req.user.github.id};
  var update = {$push: {followed: req.query.id}};
  Users.update(conditions, update, callback);

  function callback (err, num) {
		res.json({success: true});
  }
};


exports.unfollow = function(req, res) {
	if (!req.user) res.redirect('/login');
  
  var conditions = {user_id: req.user.github.id};
  var update = {$pop: {followed: req.query.id}};
  Users.update(conditions, update, callback);

  function callback (err, num) {
		res.json({success: true});
  }
};


exports.upvote = function(req, res) {
  if (!req.user) res.json({success: false});
  else {
    // increment upvotes number
    var conditions = {_id: req.query.id};
    var update = {$addToSet: {upvotes: req.user.github.id}};
    ProjectComments.update(conditions, update, callback);
    function callback (err, num) {
      console.log("* " + req.user.github.login + " upvoted on " + req.query.id);
      res.json({success: true});
    };
  }
};


exports.flag = function(req, res) {
  if (!req.user) res.json({success: false});
  else {
    // increment flags number
    var conditions = {_id: req.query.id};
    var update = {$addToSet: {flags: req.user.github.id}};
    ProjectComments.update(conditions, update, callback);
    function callback (err, num) {
      console.log("* " + req.user.github.login + " flagged " + req.query.id);
      res.json({success: true});
    };
  }
};