Dalliance Genome Explorer
=========================

Dalliance is an experimental genome browser that aims to offer a high level of interactivity while working entirely within your web browser. It currently supports recent versions of Firefox, Google Chrome, and Safari.

To try it, visit http://www.biodalliance.org/human/ncbi36/

Development
-----------

You should be able to run Dalliance directly from a git checkout by pointing your web browser at the file `test.html`.  Once you've confirmed this is working, you can customize your display by editing the block of configuration javascript within the HTML file.

Adding extra data
-----------------

Dalliance loads data via the [DAS](http://biodas.org/) protocol, and aims towards full DAS/1.53 support, with some DAS/1.6 support -- which will hopefully improve in the future!  There's a button to click that will let you add DAS sources.  If what you're after is in the registry, you should just be able to select and add, otherwise you'll need to 

However, there is one caveat.  Since Dalliance is a pure Javascript program running in your web browser, it is normally subject to the "same origin policy", which only permits Javascript code to access resources on the same server.  To get round this, DAS servers need to support the W3C [CORS](http://www.w3.org/TR/cors/) extension.  The latest versions of Dazzle and ProServer should implement this by default.

Dalliance has a nearly-complete implementation of the DAS/1.53 and DAS/1.6 stylesheet system, but is currently a little bit fussy about exactly how it interprets DAS stylesheets, so if your data doesn't appear, it's worth taking a careful look at your stylesheet and/or temporarily replacing it with something simple.

Reporting bugs
--------------

Dalliance is under active development and we welcome your suggestions.  Right now, probably the best place for bug reports or feature requests is the [Github issue tracker](http://github.com/dasmoth/dalliance).