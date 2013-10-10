MOLGENIS Fork specific README (Find Dalliance orginal readme below)
===================================================================
1.	Fork Dalliance on github and clone on your machine
		https://github.com/dasmoth/dalliance 
		git clone https://github.com/yourname/dalliance.git
2.	Pull regularly from Dalliance master and from the MOLGENIS fork
		git remote add blessed https://github.com/dasmoth/dalliance.git
		git remote add molgenisBlessed https://github.com/molgenis/dalliance.git
3.	Git submodule init
	Git submodule update 
		(switch to WiFi if it fails, UMCG network blocks a port which is causing an error)
4.	Create javascript project with dalliance git directory as project directory
5.	Download compiler.jar and place it in your dalliance folder
		https://developers.google.com/closure/compiler/docs/gettingstarted_app
6.	Compile dalliance (run build.sh in the dalliance directory)
7.	Use compiled js file in the genome-browser module (manual copy action)
8.	Pull regularly from both molgenisBlessed and blessed!

NOTES:
•	Create any pull request from your fork to the MOLGENIS fork, NOT to the MASTER!
•	Do not check in dalliance-compiled.js and dalliance-all.js

Original Dalliance README:
Dalliance Genome Explorer
=========================

Dalliance is a genome viewing tool that aims to offer a high
level of interactivity while working entirely within your web
browser. It currently supports recent versions of Firefox, Google
Chrome, and Safari.

To try it, visit [http://www.biodalliance.org/human/ncbi36/](http://www.biodalliance.org/human/ncbi36/).

Development
-----------

You should be able to run Dalliance directly from a git checkout.  You
first need to download a couple of dependencies using:

          git submodule init
          git submodule update

Then point your web browser at the file `test.html`.  Once you've
confirmed this is working, you can customize your display by editing
the block of configuration javascript within the HTML file.

Adding extra data
-----------------

Dalliance loads data via the [DAS](http://biodas.org/) protocol.
There's a button to click that will let you add DAS sources.  If what
you're after is in the registry, you should just be able to select and
add, otherwise you'll need to type a URL.

You can also add data directly from indexed binary files (currently
bigwig, bigbed and BAM, probably other formats in the future).  Binary files
can either be hosted on a web server or loaded from local disk.

However, there is one caveat.  Since Dalliance is a pure Javascript
program running in your web browser, it is normally subject to the
"same origin policy", which only permits Javascript code to access
resources on the same server.  To get round this, DAS servers need to
support the W3C [CORS](http://www.w3.org/TR/cors/) extension.  The
latest versions of Dazzle, Proserver and MyDAS should implement this by
default.

Reporting bugs
--------------

Dalliance is under active development and we welcome your suggestions.
Right now, probably the best place for bug reports or feature requests
is the [Github issue tracker](http://github.com/dasmoth/dalliance).