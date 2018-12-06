const util = require('util');

require('source-map-support').install();
const Jasmine = require('jasmine');
const { InstantJasmineReporter } = require('./jasmine-reporters');

var jasmine = new Jasmine();
jasmine.loadConfig({
    spec_files: [
        'build/**/*.spec.js'
    ]
});
jasmine.env.addReporter(new InstantJasmineReporter());
jasmine.execute();
