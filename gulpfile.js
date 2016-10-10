var gulp = require('gulp'),
        rename = require('gulp-rename'),
        prettify = require('gulp-jsbeautifier'),
        uglify = require('gulp-uglify'),
        cleancss = require('gulp-clean-css'),
        htmlmin = require('gulp-htmlmin'),
        open = require('gulp-open');


//copyfiles on root
gulp.task('copy', function () {
    var json = require('./package.json');

    gulp.src('./controllers/*.js')
            .pipe(rename(function (path) {

                if (path.extname === ".js")
                    if (path.basename[0] !== '_')
                        path.basename = "_" + path.basename;

            }))
            .pipe(gulp.dest('../../controllers/.'));

    gulp.src('./latex/*.tex')
            .pipe(rename(function (path) {

                if (path.extname === ".tex")
                    if (path.basename[0] !== '_')
                        path.basename = "_" + path.basename;

            }))
            .pipe(gulp.dest('../../latex/.'));

    gulp.src('./app/**/*', {nodir: true})
            .pipe(rename(function (path) {
                //console.log(path);
                var ext = ['.js', '.css'];

                if (ext.indexOf(path.extname) !== -1)
                    if (path.basename[0] !== '_')
                        path.basename = "_" + path.basename;

                if (path.extname === ".html")
                    path.dirname = path.dirname.replace(new RegExp(json.name, 'gi'), "_" + json.name);
            }))
            .pipe(gulp.dest('../../app/.'));

    gulp.src('package.json')
            .pipe(rename(function (path) {
                path.basename = "_" + json.name;

            }))
            .pipe(gulp.dest('../../json/.'));
});

gulp.task('dev', function () {
    gulp.start('copy');

    return gulp.watch('./**/*', function (obj) {

        if (obj.type === 'changed') {
            console.log(obj.path, " changed");
            gulp.start('copy');
        }
    });
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
    gulp.src("./index.html")
            .pipe(open());
});

// Tâche par défaut
gulp.task('default', ['readme']);
gulp.task('allminify', ['minifycss', 'minifyhtml', 'minifyjs']);
gulp.task('install', ['copy']);
