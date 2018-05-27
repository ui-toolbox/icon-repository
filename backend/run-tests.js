require('source-map-support').install();
const Jasmine = require('jasmine');

var jasmine = new Jasmine();
jasmine.loadConfig({
    spec_files: [
        'build/**/*.spec.js'
    ]
});
jasmine.execute();
