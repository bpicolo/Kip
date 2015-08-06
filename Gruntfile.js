module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        babel: {
            options: {
                sourceMap: false
            },
            dist: {
                files: [{
                    expand: true,
                    src: '**/*.js',
                    dest: 'dist/',
                    cwd: 'src'
                }]
            }
        },
        copy: {
            main: {
                files: [
                    {src: ['index.html'], dest: 'dist/'},
                    {src: ['config.js'], dest: 'dist/'}
                ]
            }
        },
        watch: {
            scripts: {
                files: ['Gruntfile.js', 'src/**/*.js', 'index.html', 'config.js'],
                tasks: ['babel', 'copy'],
                options: {
                    spawn: false,
                },
            },
        }
    });

}
