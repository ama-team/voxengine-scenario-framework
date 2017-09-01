/**
 * @typedef {TOperationResult} TRunResult
 *
 * @property {Error|*} [error]
 * @property {object} stages
 * @property {TOperationResult} stages.initialization
 * @property {TScenarioStageResult} stages.scenario
 * @property {TOperationResult} stages.termination
 */
