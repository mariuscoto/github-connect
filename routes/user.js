var express = require('express');
var mongoose = require('mongoose');
var Users = mongoose.model('Users');
var app = express();


exports.profile = function(req, res) {
    Users.findOne ({ 'user_id': global.id }, function (err, user) {
	if (err) return handleError(err);
	res.render('profile', {
	    title: "User profile",
	    user: user
	});
    });
};
