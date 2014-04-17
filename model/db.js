var mongoose = require( 'mongoose' );
var Schema   = mongoose.Schema;

var Users = new Schema({
	user_id:         String,
	user_name:       String,
	user_fullname:   String,
	user_email:	    String,
	avatar_url:      String,
	location:        String,
	favorites:	     [String],
  followed:        [String],
	join_github:     String,
	join_us:	    	 Date,
  last_seen:       Date,
	repos:           [Repo],
	points_repos:    {type: Number, default: 0},
	points_ideas:    {type: Number, default: 0},
	tentacles:			 {type: Number, default: 0}
});

var Projects = new Schema({
	uid:						Number,
  user_name:      String,
  repo:           String,
  title:          String,
  type:           String,
  description:    String,
  size:           String,
	date_post:      Date,
  comments_num:   {type: Number, default: 0}
});

var Ideas = new Schema({
	uid:            Number,
	user_name:      String,
	title:          String,
	description:    String,
	lang:           String,
	plan:           String,
	date_post:      Date,
	team:           [Number],
	points:         {type: Number, default: 0},
	comments_num:   {type: Number, default: 0}
});

var IdeaComments = new Schema({
	uid:        Number,
	user_name:  String,
	idea:       String,
	content:		String,
	date:       Date,
  upvotes:    [Number],
  flags:      [Number]
});

var ProjectComments = new Schema({
	uid:        Number,
	user_name:  String,
	project:    String,
	content:		String,
	date:       Date,
  upvotes:    [Number],
  flags:      [Number]
});

var Repo = new Schema({
	name:           String,
	description:    String,
	html_url:       String,
	fork:           Boolean,
	forks_count:    Number,
	points:         {type: Number, default: 0},
	size:					 Number,
	watchers_count: Number,
	owner:					String,
	closed_pulls:	 Number
});

var Notifications = new Schema({
	src:   Number,
	dest:  Number,
	type:  String,
	seen:  Boolean,
	date:  Date,
	link:  String
});

mongoose.model( 'Users', Users );
mongoose.model( 'Projects', Projects );
mongoose.model( 'Ideas', Ideas );
mongoose.model( 'IdeaComments', IdeaComments );
mongoose.model( 'ProjectComments', ProjectComments );
mongoose.model( 'Repo', Repo );
mongoose.model( 'Notifications', Notifications );


if (global.config.status == 'dev')
	mongoose.connect( 'mongodb://localhost/github-connect' );
else
	mongoose.connect('mongodb://'+global.config.db_name+':'+global.config.db_pass+'@troup.mongohq.com:10059/github-connect');
