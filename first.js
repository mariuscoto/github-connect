config = require('./lib/config')

var express = require('express');
var fs = require('fs');
var http = require('http');
var https = require('https');
var everyauth = require('everyauth');

var app = module.exports = express();

// Everyauth
everyauth.github
  .appId(config.gh_clientId)
  .appSecret(config.gh_secret)
  .findOrCreateUser( function (sess, accessToken, accessTokenExtra, ghUser) {
    console.log('find user')
    // return usersByGhId[ghUser.id] || (usersByGhId[ghUser.id] = addUser('github', ghUser));
})
  .redirectPath('/board');

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
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

app.get('/', function(req, res) {
  res.render('login');
});

app.get('/board', function(req, res) {
  if (everyauth.loggedIn) {
    res.render('board');
  }
    res.render('login');
});

app.listen(process.env.PORT || 4000);
