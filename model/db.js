var mongoose = require( 'mongoose' );
var Schema   = mongoose.Schema;
 
var Users = new Schema({
    user_id:	    String,
    user_name:	    String,
    user_fullname:  String,
    user_email:	    String,
    user_first:	    Date
});

var Ideas = new Schema({
    uid:	    Number,
    title:	    String,
    description:    String,
    plan:	    String,
    date_post:	    Date
});

var IdeaComments = new Schema({
    uid:	Number,
    idea:	String,
    content:	String,
    date:	Date
});
 
mongoose.model( 'Users', Users );
mongoose.model( 'Ideas', Ideas );
mongoose.model( 'IdeaComments', IdeaComments );
 
mongoose.connect( 'mongodb://localhost/express-u' );
