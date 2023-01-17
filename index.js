const CritGrinder = require("./src/CritGrinder");
const config = require("./config.json");

const args = [
    config.settings.portNumber, 
    config.settings.username, 
    config.settings.version, 
    config.settings.entitiesToGrind, 
    config.settings.numOfTicksBetweenJumps, 
    config.settingsdurabilityToStopGrinding
];

const bot = new CritGrinder(args);