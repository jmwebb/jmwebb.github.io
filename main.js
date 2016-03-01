$( ".learn_more_container" ).click(function(e) {
	e.preventDefault();
	$(".faq").css("display", "inherit");
	$('html, body').delay(400).animate({
         scrollTop: $('.faq').offset().top
    }, 1500, "swing"); 
});