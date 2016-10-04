The rendering system of BD now supports multiple renderers, and can be easily
extended. A renderer is a Javascript module that exports at least the following
two functions: renderTier(status, tier) and drawTier(tier). See
default-renderer.es6, which is the module used by default and has the same
functionality as the old BD renderer, for details on what these functions do.

The new rendering system has been put to use in adding a multi-tier renderer,
that is, it is possible to have multiple tiers be drawn in the same canvas,
overlapping one another. This makes it easier to have control over the looks of
the browser. For an example, see multi.html in the example browsers folder.
There is also the possibility of using tier-wise rendering callbacks, for
further customization and simpler additions to the look of a track. The
horizontal ruler found in multi.html is an example of that.

Multitiers are easily used, but require some additional configuration. Their
source configuration must include a 'multi' object, containing at least a
"multi_id". The renderer must also be set to 'multi', of course. An example:
```javascript
{
 name: 'Multi-tier',
 tier_type: 'qtl',
 uri: '',
 renderer: 'multi',
 multi: {
     multi_id: "multi_1",
     grid: true,
     grid_offset: 0,
     grid_spacing: 10,
     quant: { min: 0, max: 100 }
 }
}
```
This defines a multi-tier with id "multi_1", an evenly spaced horizontal grid
starting at the top of the canvas, as well as a vertical ruler from 0 to 100.
Only multi_id is required - if grid and/or quant are not supplied, those
functionalies simply aren't used.

(The tier_type is 'qtl' and the uri empty just because there must be a
 functional tier_type for drawTier to be called - a dummy tier_type would be
 handy but hasn't been implemented yet)

Subtiers also require some extra configuration. They should be configured like
any regular tier in BD, but with the renderer set to 'sub' and a 'sub' object
supplied, containing the id of the corresponding multi-tier, as well as the
vertical offset and z-index of the subtier. See the following example:
```javascript
{
 name: 'Genes',
 desc: 'Gene structures from GENCODE M2',
 bwgURI: 'http://www.biodalliance.org/datasets/GRCm38/gencodeM2.bb',
 stylesheet_uri: 'http://localhost:8000/gencode.xml',
 collapseSuperGroups: true,
 trixURI: 'http://www.biodalliance.org/datasets/GRCm38/gencodeM2.ix',
 renderer: 'sub',
 sub: {
     multi_id: "multi_1",
     offset: 100,
     z: 2
 }
}
```
This would define a subtier that's to be rendered in the multi-tier with id
"multi_1", with the top of the subtier at 100 pixels and at z-index 2.