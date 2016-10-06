var gulp = require('gulp'),
        prettify = require('gulp-jsbeautifier'),
        uglify = require('gulp-uglify'),
        cleancss = require('gulp-clean-css'),
        htmlmin = require('gulp-htmlmin'),
        open = require('gulp-open');


//copyfiles on root
gulp.task('copy', function () {
    gulp.src(['./install/**/*', '!./install/**/gulpfile.js', '!./install/**/LICENSE.md' '!./install/**/package.json', '!./install/**/*.zip'])
            .pipe(gulp.dest('test'));
});



//-----------------------------------//

//minify JS
gulp.task('minifyjs', function () {
    return gulp.src('./**/*.js') // path to your files
            .pipe(uglify())
            .pipe(gulp.dest('test'));
});


//minify CSS
gulp.task('minifycss', function () {
    return gulp.src('./**/*.css') // path to your file
            .pipe(cleancss())
            .pipe(gulp.dest('test'));
});


//minify HTML
gulp.task('minifyhtml', function () {
    return gulp.src('./**/*.html') // path to your files
            .pipe(htmlmin({collapseWhitespace: true}))
            .pipe(gulp.dest('test'));
});

//-----------------------------------//

//task default gulp open help
gulp.task('readme', function () {
    var options = {
        uri: 'localhost:3000',
        app: 'firefox'
    };
    gulp.src('./index.html')
            .pipe(open(options));
});

// Tâche par défaut
//gulp.task('default', ['readme']);
gulp.task('allminify', ['minifycss', 'minifyhtml', 'minifyjs']);
gulp.task('install', ['copy']);
