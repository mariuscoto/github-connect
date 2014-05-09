var mongoose = require( 'mongoose' );
var Schema   = mongoose.Schema;

var Users = new Schema({
  user_id:         String,
  user_name:       String,
  user_fullname:   String,
  user_email:      String,
  email_pub:       {type: Boolean, default: true},
  avatar_url:      String,
  location:        String,
  location_pub:    {type: Boolean, default: true},
  favorites:       {type: [String], default: []},
  followed:        {type: [String], default: []},
  followers_no:    {type: Number, default: 0},
  following_no:    {type: Number, default: 0},
  join_github:     {type: String, default: Date.now},
  join_us:         {type: Date, default: Date.now},
  last_seen:       {type: Date, default: Date.now},
  repos:           {type: [Repo], default: []},
  unread:          {type: Boolean, default: false},
  points_repos:    {type: Number, default: 0},
  points_ideas:    {type: Number, default: 0},
  points_projects: {type: Number, default: 0},
  tentacles:       {type: Number, default: 0}
});

var Projects = new Schema({
  user_name:      String,
  repo:           String,
  title:          String,
  lang:           String,
  type:           String,
  description:    String,
  size:           String,
  date_post:      {type: Date, default: Date.now},
  points:         {type: Number, default: 0},
  comments_num:   {type: Number, default: 0}
});

var Ideas = new Schema({
  user_name:      String,
  title:          String,
  description:    String,
  lang:           String,
  plan:           String,
  size:           String,
  eta:            String,
  date_post:      {type: Date, default: Date.now},
  team:           [String],
  points:         {type: Number, default: 0},
  comments_num:   {type: Number, default: 0}
});

var IdeaComments = new Schema({
  user_name:  String,
  idea:       String,
  content:    String,
  date:       {type: Date, default: Date.now},
  upvotes:    [Number],
  flags:      [Number]
});

var ProjectComments = new Schema({
  user_name:  String,
  project:    String,
  content:    String,
  date:       {type: Date, default: Date.now},
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
  size:           Number,
  watchers_count: Number,
  owner:          {type: String, default: null},
  closed_pulls:   {type: Number, default: 0}
});

var Notifications = new Schema({
  src:  String,
  dest: String,
  type: String,
  seen: {type: Boolean, default: false},
  date: {type: Date, default: Date.now},
  link: {type: String, default: null},
  msg:  {type: String, default: null}
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
