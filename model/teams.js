var mongoose = require('mongoose');

exports.teamlist = function teamlist(gname,callback){
 var Team = mongoose.model( 'Team' );
 Team.find({'GroupName':gname}, function (err, teams) {
  if(err){
   console.log(err);
  }else{
   console.log(teams);
   callback("",teams);
  }
 })// end Team.find
}// end exports.teamlist


