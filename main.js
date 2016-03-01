$( ".learn_more_container" ).click(function() {
	$(".faq").css("display", "inherit");
	$(this).smoothScroll();
});