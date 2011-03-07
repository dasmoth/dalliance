---
layout: default
title: CORS explained
---
Dalliance is dependent on [the Cross Origin Resource Sharing standard
(CORS)](http://www.w3.org/TR/cors/) for its normal operation.  This is
because Javascript web applications like Dalliance are normally limited
to downloading data from the same origin that the webapp itself came
from (origin, in this context, means the "server" part of a URL, e.g.
"http://www.biodalliance.org").  This is clearly not helpful for webapps
which perform data integration!  CORS is a mechanism for bypassing the
"same origin" policy in a controlled manner.

CORS allows any web server to declare that some or all of the resources
it serves are fair game for cross-origin requests; that is, requests where
the origin of the requested resource does not match the origin of the
code or webpage which initiated the request.  Servers may either permit
arbitrary cross-origin requests, or limit them to specific trusted webapps.
Recent versions of most popular DAS middleware including
[Proserver](http://www.sanger.ac.uk/resources/software/proserver/),
[Dazzle](http://www.biojava.org/wiki/Dazzle), [MyDAS](http://www.biojava.org/wiki/Dazzle), and [easyDAS](http://www.ebi.ac.uk/panda-srv/easydas/)) implement
CORS by default.  If you are providing data by DAS, you will quite
probably get a CORS implementation for free by using standard DAS middleware,
but if you are interested in the details, read on.

If you are browsing data with Dalliance, you may occasionally wish to
access a datasource which doesn't implement CORS.  You could try
contacting the server owner with a link to this page.

How it works
------------

CORS is implemented as a set of extra headers on HTTP requests and responses.
The most important part of the system is the `Access-Control-Allow-Origin`
header.  Including this on any HTTP response marks the resource
as a potential target for a cross-origin request.  To make a *publically
visible* DAS source CORS-compliant and accessible from Dalliance (and
potentially other Javascript-based DAS clients), the simplest solution
is to include the following on every response:

         Access-Control-Allow-Origin: *

Alternatively, you can specify an origin URI, *e.g.*:

         Access-Control-Allow-Origin: http://www.biodalliance.org

There are other CORS headers to fine-tune the handling of more advanced
HTTP features (headers, cookies, passwords).  Everything is documented
in the [CORS spec](http://www.w3.org/TR/cors/) if you are curious.

Password-protected sources
--------------------------

It is possible to combine CORS with password-protection using standard
HTTP authentication mechanisms.  Password protected DAS sources might be
a good solution if you want to use DAS and Dalliance to share some data
with collaborators without making it public.  However, there are two caveats.
First, you must add an extra header.

          Access-Control-Allow-Credentials: true

Second, you are **not** allowed to use wildcards in the `Access-Control-Allow-Origin`
headers of a password-protected resource.  If you want to allow arbitrary clients to
access such a resource, you must echo back the value of the `Origin` header included
in the request.  This behaviour is offered by default by the ProServer middleware.

Dalliance can automatically detect password-protected DAS tracks when using the
'Add track' interface.