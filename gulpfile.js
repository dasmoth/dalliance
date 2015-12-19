var gulp = require('gulp');
var source = require('vinyl-source-stream');
var browserify = require('browserify');
var rename = require('gulp-rename');
var buffer = require('vinyl-buffer');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');


gulp.task('build-worker', function() {
    browserify({
        entries: 'js/fetchworker.js',
        debug: true,
        nobuiltins: true
    })
        .bundle()
        .pipe(source('worker-all.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('build/'));
});


gulp.task('build-main', function() {
    browserify({
        entries: 'js/exports.js',
        debug: true,
        nobuiltins: true
    })
        .bundle()
        .pipe(source('dalliance-all.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('build/'));
});

gulp.task('compile-worker', function() {
    browserify({
        entries: 'js/fetchworker.js',
        debug: true,
        nobuiltins: true
    })
        .bundle()
        .pipe(source('worker-all.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(uglify())
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('build/'));
});

gulp.task('compile-main', function() {
    browserify({
        entries: 'js/exports.js',
        debug: true,
        nobuiltins: true
    })
        .bundle()
        .pipe(source('dalliance-all.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(uglify())
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('build/'));
});

gulp.task('watch', function() {
  gulp.watch('js/*.js', ['default']);
});

gulp.task('default', ['build-main', 'build-worker']);
gulp.task('compile', ['compile-main', 'compile-worker']);
