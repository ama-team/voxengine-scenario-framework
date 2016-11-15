var TriggerType = {
    Call: 'Call',
    Http: 'Http'
};

function expand(scenario) {

}

function validate(scenario) {

}

function runInternal(scenario) {

}

function run(scenario) {
    if (scenario.type.toLowerCase() === TRIGGER_TYPE.Call.toLowerCase()) {
        VoxEngine.addEventListener(AppEvents.CallAlerting, function () {
            runInternal(scenario);
        });
    } else {
        runInternal(scenario);
    }
}

exports = module.exports = {
    run: run,
    validate: validate,
    expand: expand,
    TriggerType: TriggerType
};