var gulp = require('gulp');
var source = require('vinyl-source-stream');
var browserify = require('browserify');
var rename = require('gulp-rename');
var buffer = require('vinyl-buffer');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var babel = require('gulp-babel');
var babelify = require('babelify');
var eslint = require('gulp-eslint');
var addsrc = require('gulp-add-src');
var concat = require('gulp-concat');

gulp.task('build-worker', function() {
    browserify({
        entries: 'js/fetchworker.js',
        debug: true,
        nobuiltins: true
    })
        .transform("babelify", {presets: ["es2015"],
                                extensions: [".js", ".es6"]})
        .bundle()
        .pipe(source('worker-all.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('build/'));
});


gulp.task('build-main', function() {
    browserify({
        entries: 'js/exports-standalone.js',
        debug: true,
        nobuiltins: true,
        standalone: 'biodalliance'
    })
        .transform("babelify", {presets: ["es2015"],
                                extensions: [".js", ".es6"]})
        .bundle()
        .pipe(source('dalliance-all.js'))
        .pipe(buffer())
        .pipe(addsrc.append('shim13.js'))
        .pipe(concat('dalliance-all.js'))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('build/'));
});

gulp.task('build-module', function() {
    browserify({
        entries: 'js/exports-standalone.js',
        debug: true,
        nobuiltins: true,
        standalone: 'biodalliance'
    })
        .transform("babelify", {presets: ["es2015"],
                                extensions: [".js", ".es6"]})
        .bundle()
        .pipe(source('dalliance-all.js'))
        .pipe(buffer())
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('build/'));
});


gulp.task('compile-worker', function() {
    browserify({
        entries: 'js/fetchworker.js',
        debug: true,
        nobuiltins: true
    })
        .transform("babelify", {presets: ["es2015"],
                                extensions: [".js", ".es6"]})
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
        entries: 'js/exports-standalone.js',
        debug: true,
        nobuiltins: true,
        standalone: 'biodalliance'
    })
        .transform("babelify", {presets: ["es2015"],
                                extensions: [".js", ".es6"]})
        .bundle()
        .pipe(source('dalliance-all.js'))
        .pipe(buffer())
        .pipe(addsrc.append('shim13.js'))
        .pipe(concat('dalliance-all.js'))
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(uglify())
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('build/'));
});

gulp.task('compile-module', function() {
    browserify({
        entries: 'js/exports-standalone.js',
        debug: true,
        nobuiltins: true,
        standalone: 'biodalliance'
    })
        .transform("babelify", {presets: ["es2015"],
                                extensions: [".js", ".es6"]})
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
gulp.task('module', ['compile-module', 'compile-worker'])

gulp.task('lint-es6', function() {
    return gulp.src('js/*.es6')
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failOnError());
});
