config = require('./lib/config')

var express = require('express');
var engines = require('consolidate');
var multipart = require('multipart');
var fs = require('fs');
var http = require('http');
var https = require('https');
var everyauth = require('everyauth');
var MemoryStore = require('connect').session.MemoryStore;
var redis = require('connect-redis')(express);

var app = express();
var sesh = new redis();


everyauth.github
  .appId(config.gh_clientId)
  .appSecret(config.gh_secret)
  .findOrCreateUser( function (session, accessToken, accessTokenExtra,
githubUserMetadata) {
    session.oauth = accessToken;
    return session.uid = githubUserMetadata.login;
  })
  .redirectPath('/');
 everyauth.everymodule.handleLogout( function (req, res) {
  req.logout(); 
  req.session.uid = null;
  res.writeHead(303, { 'Location': this.logoutRedirectPath() });
  res.end();
});


app.configure(function() {
  app.set('view engine', 'jade');
  app.set('views', __dirname + '/views');
  app.engine('.html', require('jqtpl').render);
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({store: sesh, secret: config.redis_secret}));
  app.use(everyauth.middleware());

//  app.use(express.session({secret: 'zennon', store: MemoryStore( {
//    reapInterval: 60000 * 10
//  })}));

});

app.get('/', function(req, res) {
  if (req.session && req.session.uid) {
    return res.redirect('/board');
  }
  res.render('login');
});

app.get('/board',function(req,res) {
    if (typeof req.session === 'undefined') {
        return res.redirect('/');
    }
    var repos,
        opts = {
      host: "api.github.com",
      path: '/user/repos?access_token=' + req.session.oauth,
      method: "GET"
    },
      request = https.request(opts, function(resp) {
	var data = "";
	resp.setEncoding('utf8');
    resp.on('data', function (chunk) {
      data += chunk;
    });
    resp.on('end', function () {
      repos = JSON.parse(data); 
      res.render('board',{username: req.session.uid, repos: repos});
    });
      });
    request.end();
});

//function requiresLogin(req, res, next) {
//  if (req.session.user) {
//    next();
//  } else {
//    res.redirect('/nologin');
//  }
//};

//app.get('/', function(req, res) {
//  res.send('Hello');
//});

//app.get('/products', requiresLogin, function(req, res) {
//  res.send('you found the gold');
//});

//app.get('/nologin', function(req, res) {
//  res.send('go away');
//});

app.listen(process.env.PORT || 4000);
