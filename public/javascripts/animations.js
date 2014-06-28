
$('#remove_idea').on("click", function () {
  if (confirm("Are you sure you want to remove your your idea?")) {

    // Compose URL
    var index = window.location.pathname.indexOf('?')
    var id_arg = window.location.pathname.substring(index)
    window.location.replace('../idea/remove' + id_arg)

  } else {
    return false
  }
});

$('#remove_project').on("click", function () {
  if (confirm("Are you sure you want to remove your your project?")) {

    // Compose URL
    var index = window.location.pathname.indexOf('?')
    var id_arg = window.location.pathname.substring(index)
    window.location.replace('../project/remove' + id_arg)

  } else {
    return false
  }
});

$('#remove_account').on("click", function () {
  if (confirm("Are you sure you want to remove your account and all associated"
              + " content? This action cannot be undone.")) {

    // Compose 
    var index = window.location.pathname.indexOf('/', 1)
    var win_url = window.location.pathname.substring(1, index)
    window.location.replace('../' + win_url + '/remove')

  } else {
    return false
  }
});
</script>

<script>

function checkdate(input){
  var validformat=/^\d{2}\/\d{2}\/\d{4}$/
  var returnval=false

  if (!validformat.test(input.value))
    alert("Invalid Date Format. Make sure the format is dd/mm/yyyy.")
  else{
    //Detailed check for valid date ranges
    var dayfield=input.value.split("/")[0]
    var monthfield=input.value.split("/")[1]
    var yearfield=input.value.split("/")[2]
    var dayobj = new Date(yearfield, monthfield-1, dayfield)
    if ((dayobj.getDate()!=dayfield)||(dayobj.getMonth()+1!=monthfield)||(dayobj.getFullYear()!=yearfield))
      alert("Invalid Day, Month, or Year range detected. Please correct and submit again.")
    else
      returnval=true
    }

    if (returnval==false) input.select()
      return returnval
}


var hidden = 1;
$('#idt').click(function () {
  if(hidden === 1) {
    $('#idea-new').animate({height: '500px'}, 250);
    $('.left-mini').show();
    $('.right-mini').show();
    $('.center-mini').show();
    hidden = 0;
  }
});


$('.upvote').click(function () {
  // click just once
  if (this.className == "upvote") {
    var id = this.id;
    $.ajax({
     url: window.location.pathname + '/upvote?id=' + this.id,
     type: "POST",
     success: function(response) {
       if (response.success) {
         document.getElementById(id).setAttribute("class", "upvoted");
         document.getElementById(id + '#').innerHTML = parseInt(document.getElementById(id + '#').innerHTML) + 1;
       }
     }
    });
  }
});


$('.flag').click(function () {
  // click just once
  if (this.className == "flag") {
    var fid = this.id;
    $.ajax({
     url: window.location.pathname + '/flag?id=' + this.id.substring(0, this.id.length-1),
     type: "POST",
     success: function(response) {
       if (response.success)
         document.getElementById(fid).setAttribute("class", "flagged");
     }
    });
  }
});

// Show flagged comment on request
$('.show_comment').click(function () {
    var id = $(this).attr("id");
    $('#' + id + '_com').attr("class", "hidden_comment");
    $('#' + id + '_comm').attr("class", "comment");
    return false;
});


// Fav idea
$('.idea-title-fav').on("click", fav_idea);
function fav_idea() {
  var id = this.id;

  $.ajax({
   url: 'idea/fav?id=' + this.id,
   type: "POST",
   success: function(response) {
     if (response.success) {
        // Clear and bind new class and event
        $('#' + id).off();
        $('#' + id).addClass('idea-title-fav-selected');
        $('#' + id).removeClass('idea-title-fav');
        $('#' + id).on("click", unfav_idea);
      }
   }
  });
}

// Unfav idea
$('.idea-title-fav-selected').on("click", unfav_idea);
function unfav_idea() {
  var id = this.id;

  $.ajax({
    url: 'idea/unfav?id=' + this.id,
    type: "POST",
    success: function(response) {
      if (response.success) {
        // Clear and ind new class and event
        $('#' + id).off();
        $('#' + id).addClass('idea-title-fav');
        $('#' + id).removeClass('idea-title-fav-selected');
        $('#' + id).on("click", fav_idea);

        // If user views favorites, remove div once idea is unfav
        if (window.location.pathname == "/ideas_fav") {
          document.getElementById(id).parentNode.parentNode.style.display = "none";
        }
      }
   }
  });
}

// Follow project
$('.project-title-fav').on("click", follow_project);
function follow_project() {
  var id = this.id;

  $.ajax({
    url: 'projects/follow?id=' + this.id,
    type: "POST",
    success: function(response) {
      if (response.success) {
        // Clear and ind new class and event
        $('#' + id).off();
        $('#' + id).addClass('project-title-fav-selected');
        $('#' + id).removeClass('project-title-fav');
        $('#' + id).on("click", unfollow_project);
      }
   }
  });
}

// Unfollow project
$('.project-title-fav-selected').on("click", unfollow_project);
function unfollow_project() {
  var id = this.id;

  $.ajax({
    url: 'projects/unfollow?id=' + this.id,
    type: "POST",
    success: function(response) {
      if (response.success) {
        // Clear and ind new class and event
        $('#' + id).off();
        $('#' + id).addClass('project-title-fav');
        $('#' + id).removeClass('project-title-fav-selected');
        $('#' + id).on("click", follow_project);

        // If user views followed projects, remove div once project is unfollowed
        if (window.location.pathname == "/projects_fav") {
          document.getElementById(id).parentNode.parentNode.style.display = "none";
        }
      }
   }
  });
}

// Bug -- feature project switch
$('#bug').live('click', function () {
  $(this).addClass("active");
  $('#feature').removeClass("active");
  $('#type').val("bug");
});
$('#feature').live('click', function () {
  $(this).addClass("active");
  $('#bug').removeClass("active");
  $('#type').val("feature");
});
</script>