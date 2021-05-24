module.exports = function(dirs, helpers){

    const autoprefixer = require('gulp-autoprefixer');
    const cached = require('gulp-cached');
    const cleancss = require('gulp-clean-css');
    const dependents = require('gulp-dependents');
    const gulp = require('gulp');
    const mergeStream = require('merge-stream');
    const notify = require('gulp-notify');
    const rename = require('gulp-rename');
    const sass = require('gulp-sass');
    const sourcemaps = require('gulp-sourcemaps');
    const watch = require('gulp-watch');

    const tasks = {

        default: function(){
            this.compile();
        },

        watch: function(){
            this.default();
            watch(helpers.getMergedInputs(['scss', 'scss-compile']), this.compile.bind(this));
        },

        compile: function(){
            const paths = helpers.getPaths(['scss', 'scss-compile']);
            const processes = mergeStream();

            paths.forEach(path => {
                let process = gulp.src(path.input)
                    // filter out any unchanged files
                    .pipe(cached('scss-compile'))
                    .pipe(dependents())
                    // compile
                    .pipe(sourcemaps.init())
                    .pipe(
                        sass({
                            includePaths: [
                                dirs.nodeModules,
                                dirs.themes
                            ],
                            outputStyle: 'expanded'
                        })
                        .on('error', sass.logError)
                    )
                    // .on('error', error => helpers.notifyError(error, 'error')) 
                    .pipe( autoprefixer() )
                    .pipe(sourcemaps.write())
                    .pipe(gulp.dest(path.output))
                    // minify
                    .pipe(cleancss())
                    // save minified output
                    .pipe(rename(rename => rename.extname = '.min.css'))
                    .pipe(gulp.dest(path.output))
                    // show success notification
                    // .pipe(notify({
                    //     title: 'File Compiled',
                    //     message: '<%= file.relative %>'
                    // }));

                processes.add(process);
            });
            // ignore errors on merged stream (should be handled in individual stream)
            processes.on('error', error => {});
            // show success notification
            // processes.pipe(notify({
            //     title: 'Compiling Complete',
            //     message: 'All files compiled',
            //     onLast: true
            // }));
        }

    }

    return tasks;

}