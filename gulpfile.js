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



gulp.task('build-worker', function() {
    return browserify({
        entries: 'js/fetchworker.js',
        extensions: ['.js', '.es6'],
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
    return browserify({
        entries: 'js/exports.js',
        extensions: ['.js', '.es6'],
        debug: true,
        nobuiltins: true
    })
        .transform("babelify", {presets: ["es2015"],
                                extensions: [".js", ".es6"]})
        .bundle()
        .pipe(source('dalliance-all.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('build/'));
});

gulp.task('compile-worker', function() {
    return browserify({
        entries: 'js/fetchworker.js',
        extensions: ['.js', '.es6'],
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
    return browserify({
        entries: 'js/exports.js',
        extensions: ['.js', '.es6'],
        debug: true,
        nobuiltins: true
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

gulp.task('default', gulp.series('build-main', 'build-worker'));
gulp.task('compile', gulp.series('compile-main', 'compile-worker'));

gulp.task('lint-es6', function() {
    return gulp.src('js/*.es6')
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failOnError());
});
