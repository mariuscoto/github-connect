
function ideaDelete(input) {
    if(confirm("Are you sure you want to remove this idea?")) {
	return true;
    } else {
	return false;
    }
}
</script>

<script>

function checkdate(input){
var validformat=/^\d{2}\/\d{2}\/\d{4}$/ //Basic check for format validity
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

</script>
<script>
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
</script>

<script>
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
</script>

<script>
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
</script>

<script>
$('.show_comment').click(function () {
    var id = $(this).attr("id");
    $('#' + id + '_com').attr("class", "hidden_comment");
    $('#' + id + '_comm').attr("class", "comment");
    return false;
});
</script>

<script>
$('.idea-title-fav').click(function () {
  // click just once
  if (this.className == "idea-title-fav") {
    var id = this.id;
    $.ajax({
     url: 'idea/fav?id=' + this.id,
     type: "POST",
     success: function(response) {
       if (response.success)
         document.getElementById(id).setAttribute("class", "idea-title-fav-selected");
     }
    });
  }
});

$('.idea-title-fav-selected').click(function () {
  // click just once
  if (this.className == "idea-title-fav-selected") {
    var id = this.id;
    $.ajax({
     url: 'idea/unfav?id=' + this.id,
     type: "POST",
     success: function(response) {
       if (response.success)
	{
        document.getElementById(id).setAttribute("class", "idea-title-fav");

	}
     }
    });
  }
});
</script>

<script>
$('.project-title-fav').click(function () {
  // click just once
  if (this.className == "project-title-fav") {
    var id = this.id;
    $.ajax({
     url: 'projects/follow?id=' + this.id,
     type: "POST",
     success: function(response) {
       if (response.success)
         document.getElementById(id).setAttribute("class", "project-title-fav-selected");
     }
    });
  }
});

$('.project-title-fav-selected').click(function () {
  // click just once
  if (this.className == "project-title-fav-selected") {
    var id = this.id;
    $.ajax({
     url: 'projects/unfollow?id=' + this.id,
     type: "POST",
     success: function(response) {
       if (response.success)
         document.getElementById(id).setAttribute("class", "project-title-fav");
     }
    });
  }
});
</script>

<script>
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


<script>
    var regex = "";
    var defaultType = "-Type-";
    var defaultSize = "-Size-";
    var defaultLang = "-Language-";

    function filterByText(idea) {
        if($('#search_box').val() === undefined) {return true;}
        else if(idea.text().search(regex) >= 0) {return true;}
        return false;
    }

    function filterByLang(idea) {

        var selected = $('#select-lang :selected');
        if(selected.text() === defaultLang) {return true;}
        if(idea.find('.lang').text().toUpperCase() === selected.text().toUpperCase()) {return true;}
        return false;
    }

    function filterByType(idea) {

        var selected = $('#select-type :selected');
        if(selected.text() === defaultType) {return true;}
        if(idea.find('.type').text().toUpperCase() === selected.text().toUpperCase()) {return true;}
        return false;
    }

    function filterBySize(idea) {

        var selected = $('#select-size :selected');
        if(selected.text() === defaultSize) {return true;}
        if(idea.find('.size').text().toUpperCase() === selected.text().toUpperCase()) {return true;}
        return false;
    }

    $('#search_box').keyup(function() {
        var search_term = $(this).val();
        if(search_term) {
           regex = new RegExp(search_term, "i");
            $('.idea').each(function() {
                if(!filterByText($(this)) || !filterByType($(this)) || !filterBySize($(this)) || !filterByLang($(this))) {
                    $(this).hide();
                } else {
                    $(this).show();
                }
            })
        } else {
            $('.idea').each(function() {
                if(!filterByType($(this)) || !filterBySize($(this)) || !filterByLang($(this))) {
                    $(this).hide();
                } else {
                    $(this).show();
                }
            })
        }
    });

    $('.projects-search-fields').change(function() {
        $('.idea').each(function() {
            if(!filterByText($(this)) || !filterByType($(this)) || !filterBySize($(this))) {
                $(this).hide();
            } else {
                $(this).show();
            }
        })
    });

    $('.ideas-search-fields').change(function() {
        $('.idea').each(function() {
            if(!filterByText($(this)) || !filterByLang($(this)) || !filterBySize($(this))) {
                $(this).hide();
            } else {
                $(this).show();
            }
        })
    });

</script>
