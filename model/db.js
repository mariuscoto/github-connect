var mongoose = require( 'mongoose' );
var Schema   = mongoose.Schema;
 
var Users = new Schema({
    user_id:	    String,
    user_name:	    String,
    user_fullname:  String,
    user_email:	    String,
    favorites:	    [String],
    user_first:	    Date
});

var Ideas = new Schema({
    uid:            Number,
    user_name:      String,
    title:          String,
    description:    String,
    lang:           String,
    plan:           String,
    date_post:      Date,
    team:           [Users],
    comments_num:   {type: Number, default: 0}
});

var IdeaComments = new Schema({
    uid:        Number,
    user_name:  String,
    idea:       String,
    content:	String,
    date:       Date
});
 
mongoose.model( 'Users', Users );
mongoose.model( 'Ideas', Ideas );
mongoose.model( 'IdeaComments', IdeaComments );
 
mongoose.connect('mongodb://marius:marius@troup.mongohq.com:10059/github-connect' );
//mongoose.connect('mongodb://marius:marius@dharma.mongohq.com:10006/app17218548' );
//mongoose.connect( 'mongodb://localhost/expresaa' );
