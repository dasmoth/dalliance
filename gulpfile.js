var gulp = require('gulp');
var gconcat = require('gulp-concat');
var closure = require('gulp-closure-compiler');
var browserify = require('gulp-browserify');

var mainSrc = [
  'bam',
  'bigwig',
  'bin',
  'cbrowser',
  'feature-popup',
  'chainset',
  'color',
  'das',
  'domui',
  'feature-draw',
  'sequence-draw',
  'features',
  'feature-popup',
  'kspace',
  'sample',
  'sha1',
  'svg-export',
  'spans',
  'thub',
  'tier',
  'track-adder',
  'twoBit',
  'utils',
  'version',
  'browser-ui',
  'glyphs',
  'session',
  'sourceadapters',
  'jbjson',
  'ensembljson',
  'overlay',
  'tier-actions',
  'search',
  'tier-edit',
  'trix',
  'tabix',
  'tabix-source',
  'memstore',
  'vcf',
  'bedwig',
  'probe',
  'export-ui',
  'export-config'].map(function(n) {return "js/" + n + ".js"});

gulp.task('dalliance-compiled', function() {
   return gulp.src(mainSrc.concat(['jszlib/js/inflate.js', 'polyfills/html5slider.js']))
     .pipe(gconcat('dalliance-all.js'))
     .pipe(gulp.dest('build/'))
     .pipe(closure())
     .pipe(gulp.dest('build/')); 
});

gulp.task('dalliance-worker', function() {
  gulp.src('js/fetchworker.js')
  .pipe(browserify({
    debug: true,
    nobuiltins: true,
    shim: {
      jszlib: {
        path: 'jszlib/js/inflate.js',
        exports: 'jszlib_inflate_buffer'
      }
    }
  }))
  .pipe(gulp.dest('build/'));
});

gulp.task('default', ['dalliance-compiled']);