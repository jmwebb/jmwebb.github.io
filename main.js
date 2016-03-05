$( ".learn_more_container" ).click(function(e) {
	e.preventDefault();
	$(".faq").css("display", "inherit");
	$('html, body').delay(400).animate({
         scrollTop: $('.faq').offset().top
    }, 1500, "swing"); 
});

$('#countdown').countdown('2016/03/06', function(event) {
	console.log(event.offset);
	$("#days").html(event.offset.days);
	$("#hours").html(event.offset.hours);
	$("#minutes").html(event.offset.minutes);
	$("#seconds").html(event.offset.seconds);
});
