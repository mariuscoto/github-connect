var mongoose = require( 'mongoose' );
var Schema   = mongoose.Schema;
 
var Users = new Schema({
    user_id:	    String,
    user_name:	    String,
    user_fullname:  String,
    user_email:	    String,
    avatar_url:     String,
    location:       String,
    favorites:	    [String],
    join_github:    String,
    join_us:	    Date,
    repos:          [Repo],
    points_repos:   Number
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

var Repo = new Schema({
    name:           String,
    description:    String,
    html_url:       String,
    fork:           Boolean,
    forks:          Number,
    points:         Number
});
 
mongoose.model( 'Users', Users );
mongoose.model( 'Ideas', Ideas );
mongoose.model( 'IdeaComments', IdeaComments );
mongoose.model( 'Repo', Repo );
 
mongoose.connect('mongodb://marius:marius@troup.mongohq.com:10059/github-connect' );
//mongoose.connect('mongodb://marius:marius@dharma.mongohq.com:10006/app17218548' );
//mongoose.connect( 'mongodb://localhost/expresaa' );
