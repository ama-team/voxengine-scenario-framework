var concurrent = require('../../lib/utility/concurrent');
    chai = require('chai');

chai.should();

describe('utility', function () {
   describe('concurrent', function () {
       describe('.timeout', function () {
           it('should successfully timeout', function () {
               var promise = concurrent.timeout(new Promise(function () {}), 1);
               return promise.then(function (value) {
                   throw {
                       name: 'UnexpectedPathException',
                       message: 'This should have not executed'
                   }
               }, function (rejection) {
                   rejection.should.be.instanceof(concurrent.TimeoutException);
               });
           });
       });

       describe('.ControlledPromise', function () {
           it('should resolve externally', function () {
               var promise = new concurrent.ControlledPromise();
               promise.resolve(12);
               return promise.then(function (value) {
                   value.should.be.equal(12);
               });
           });

           it('should reject externally', function () {
               var promise = new concurrent.ControlledPromise();
               promise.reject(12);
               return promise.then(function (value) {
                   throw {
                       name: 'UnexpectedPathException',
                       message: 'This should have not executed'
                   }
               }, function (value) {
                   value.should.be.equal(12);
               });
           });

           it('should resolve once', function () {
               var promise = new concurrent.ControlledPromise();
               promise.resolve(12);
               promise.resolve(42);
               return promise.then(function (value) {
                   value.should.be.equal(12);
               });
           });
       });
   });
});
