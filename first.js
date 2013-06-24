var express = require('express');
var multipart = require('multipart');
var fs = require('fs');
var http = require('http');
var https = require('https');
var everyauth = require('everyauth');
var MemoryStore = require('connect').session.MemoryStore;

var app = express();

app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({secret: 'zennon', store: MemoryStore( {
    reapInterval: 60000 * 10
  })}));
});

function requiresLogin(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/nologin');
  }
};

app.get('/', function(req, res) {
  res.send('Hello');
});

app.get('/products', requiresLogin, function(req, res) {
  res.send('you found the gold');
});

app.get('/nologin', function(req, res) {
  res.send('go away');
});


app.listen(4000);
