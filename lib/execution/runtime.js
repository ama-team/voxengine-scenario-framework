/**
 * @class
 *
 * @param {object} arguments Scenario arguments (i.e. parsed custom data)
 * @param {object} data Scenario runtime data (used by user functions)
 * @param {object} container Dependency injection container
 * @param {Slf4jAlikeLogger} container.logger Logger instance
 *
 * @property {object} arguments
 * @property {object} data
 * @property {object} container
 * @property {StateDeclaration} scenarioState Current scenario state
 * @property {ExecutionStatus} executionStatus Current execution status
 */
function ExecutionRuntime(arguments, data, container) {
    this.arguments = arguments || {};
    this.data = data || {};
    this.container = container || {};
    this.scenarioState = null;
    this.executionStatus = null;

    function log(level, message) {
        //noinspection JSPotentiallyInvalidUsageOfThis
        return this.container.logger[level].apply(Array.prototype.slice.call(arguments, 1));
    }

    /**
     * @function ExecutionRuntime#debug
     * @param {string} message
     * @param {object...} [parameters]
     */

    /**
     * @function ExecutionRuntime#info
     * @param {string} message
     * @param {object...} [parameters]
     */

    /**
     * @function ExecutionRuntime#warn
     * @param {string} message
     * @param {object...} [parameters]
     */

    /**
     * @function ExecutionRuntime#error
     * @param {string} message
     * @param {object...} [parameters]
     */

    ['debug', 'info', 'warn', 'error'].map(function (level) {
        this[level] = function () {
            log.apply(this, [level].concat(arguments));
        }
    });
}

exports = module.exports = {
    ExecutionRuntime: ExecutionRuntime
};