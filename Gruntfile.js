module.exports = function(grunt) {

    var conf = grunt.file.readJSON('package.json');

    // comment banner
    var comment = [
        '/**',
        'jQuery.fn.' + conf.name + ' v' + conf.version + ' | ' + grunt.template.today("yyyy-mm-dd"),
        conf.description,
        'by ' + conf.author,
        conf.license,
    ].join('\n* ') + '\n**/';

    var config = {

        _conf: conf,

        _filename: '<%= _conf.name %>',

        clean: {
            'dest': 'js/*'
        },

        copy: {

            orig: {
                src: 'src/<%= _filename %>.js',
                dest: 'js/<%= _filename %>.js',
                options: {
                    process: function(content) {
                        var ret = [comment, content].join('\n\n');
                        return ret;
                    }
                }
            }

        },

        jshint: {

            build: {

                options: grunt.file.readJSON('.jshintrc'),
                expand: true,
                src: ['src/**.js']

            }

        },

        uglify: {

            original: {

                options: {
                    mangle: true,
                    banner: comment + '\n'
                },
                expand: true,
                files: {
                    'js/<%= _filename %>.min.js': 'src/<%= _filename %>.js'
                }

            }

        }

    };

    // load npm's
    require("matchdep").filterDev("grunt-*").forEach(grunt.loadNpmTasks);

    grunt.registerTask('default', ['clean', 'jshint', 'copy', 'uglify']);

    grunt.initConfig(config);

};