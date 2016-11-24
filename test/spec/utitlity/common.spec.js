var utilities = require('../../../lib/utility/common'),
    chai = require('chai');

describe('/utility', function () {
    describe('/common.js', function () {
        describe('.object', function () {
            describe('.overwrite', function () {
                it('should not use prototype in overwrite', function () {
                    var prototype = {y: 3},
                        source = Object.create(prototype),
                        overwritten = {w: 12, x: 45};

                    source.x = 32;
                    source.z = 12;

                    utilities.object.overwrite(overwritten, source, false);

                    chai.expect(source).to.have.property('x');
                    chai.expect(overwritten).to.have.property('w', 12);
                    chai.expect(overwritten).to.have.property('x', 32);
                    chai.expect(overwritten).to.not.have.property('y');
                    chai.expect(overwritten).to.have.property('z', 12);
                });
            });
        });
    });
});