---
layout: default
title: Adding your own data
---
Dalliance is a [DAS](http://biodas.org/) client.  The best (and currently
only...) way to add data is to set up a new DAS server.  There are a number
of tools to help you do this.  Perl users will probably prefer
[Proserver](http://www.sanger.ac.uk/resources/software/proserver/)
while Java-ish people might like [Dazzle](http://www.biojava.org/wiki/Dazzle)

Once your server is set up, you can either add the track directly
using the Add track -> Custom option, or you can add it to the
[DAS Registry](http://www.dasregistry.org/), in which case it should
show up in the track browser directly.

Dalliance includes an almost-complete implementation of the DAS/1.53
stylesheet system (including most of the extensions in the current
DAS/1.6 draft).

High-throughput sequencing data
-------------------------------

Currently the best way to view the results of HTS experiments is to use
the BAM -> DAS adaptor, available from [here](http://github.com/dasmoth/das-sources/).
(Pre-packaged builds coming soon, send Thomas a nagging e-mail!)

Convert your alignment to BAM using [samtools](http://samtools.sf.net/).

{% highlight xml %}
<datasource id="bamtestPE" jclass="das.bam.BAMMappingFeatureSource">
    <string name="name" value="bamtestPE" />
    <string name="bamPath" value="/Users/thomas/chr22testPE.bam" />
    <boolean name="groupPairs" value="true" />
    <string name="stylesheet" value="bamtest.style" />
</datasource>
{% endhighlight %}
