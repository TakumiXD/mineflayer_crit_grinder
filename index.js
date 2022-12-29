const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const GoalBlock = goals.GoalBlock;
const vec3 = require('vec3')
const WeaponManager = require('./WeaponManager');

// --- bot server and login information
const PORT_NUMBER = 57636; // CHANGEME the port number of minecraft server
const BOT_USERNAME = "Crit_Grinder"; // CHANGEME the in game name of the bot
const settings = {
	host: "localhost",
	port: PORT_NUMBER,
	username: BOT_USERNAME,
};

const bot = mineflayer.createBot(settings);
const ENTITIES_TO_HIT = ["animal", "hostile"]; // The entities the bot should hit
const NUM_OF_TICKS_JUMP = 18 // The number of in-game ticks to complete a jump
const NUM_OF_TICKS_CRIT_AFTER_JUMP = 8
const GRIND_RADIUS = 3.5 // The hit radius of the bot
const JUMP_FALLING_VELOCITY = -0.1 // The y velocity of the bot when it is falling from a jump
// The durability in percentage in which the bot will stop grinding and chat a warning message
const STOP_DURABILITY = 0.05 
const offset = {
    N: [0, 0, -1],
    S: [0, 0, 1],
    W: [-1, 0, 0],
    E: [1, 0, 0],
    NW: [-1, 0, -1],
    NE: [1, 0, -1],
    SW: [-1, 0, 1],
    SE: [1, 0, 1]
}

var grindPosition = null;
var botIsGrinding = false;
var onCooldown = false; // jump cooldown
var weaponManager = null;

function stopGrind() {
    botIsGrinding = false;
}

async function critGrind() {
    if (botIsGrinding) {
        return
    }
    if (!grindPosition) {
        bot.chat("Failed, you need to assign me a spot to grind");
        console.log("critGrind() failed becayse grindPosition was not set");
    }
    bot.on("move", () => {
        if ((bot.entity.position.y > grindPosition.y) && 
            (bot.entity.velocity.y < JUMP_FALLING_VELOCITY) && (!onCooldown)) {
            let target = bot.nearestEntity(entity => ENTITIES_TO_HIT.includes(entity.type));
            bot.attack(target);
            weaponManager.updateCurrentWeapon(bot.heldItem);
            checkDurability();
            // account for the small time between jumps
            onCooldown = true;
        }
    });

    botIsGrinding = true;
    while (botIsGrinding) {
        // jump when a mob is detected, which calls the bot.on("move")
        let targetDetected = bot.nearestEntity(entity => ENTITIES_TO_HIT.includes(entity.type));
        if (targetDetected && (grindPosition.distanceTo(targetDetected.position) < GRIND_RADIUS)) {
            await jump();
        }
        else {
            await bot.waitForTicks(NUM_OF_TICKS_JUMP);
        }
    }
}

// --- Makes the bot jump
async function jump() {
    bot.setControlState("jump", true);
    bot.setControlState("jump", false);
    await bot.waitForTicks(NUM_OF_TICKS_CRIT_AFTER_JUMP);
    onCooldown = true;
    await bot.waitForTicks(NUM_OF_TICKS_JUMP - NUM_OF_TICKS_CRIT_AFTER_JUMP);
    onCooldown = false;
}

async function setGrindPosition() {
    if (botIsGrinding) return;
    grindPosition = bot.entity.position;
}

// --- Make the bot equip a weapon if the bot only has one weapon in its inventory
async function equipWeapon() {
    let botItems = bot.inventory.items(); 
    weaponManager.setWeapon(botItems);
    if (weaponManager.getCurrentWeapon() != null) {
        await bot.equip(weaponManager.getCurrentWeapon(), "hand");
        return true;
    }
    else {
        bot.chat("Failed, I either have no weapons or too many weapons");
        console.log(`Equip weapon failed, ${BOT_USERNAME} has invalid number of weapons`);
        return false;
    }
}

// --- Check if the weapon has sufficient durability
function checkDurability() {
    if (weaponManager.getCurrentWeaponDurability() <= STOP_DURABILITY) {
        stopGrind();
        bot.chat("The weapon is low durability so I will stop grinding.");
        console.log(`${BOT_USERNAME} stopped grinding due to insufficient durability`);
    }
}

async function goToCoordinates(x, y, z) {
    try {
        let goal = new GoalBlock(x, y, z);
        await bot.pathfinder.goto(goal);
        return true;
    } catch(e) {
        console.log("Invalid coordinates entered");
        return false;
    }
}

async function faceDirection(direction) {
    try {
        botPosition = bot.entity.position;
        console.log(direction);
        await bot.lookAt(botPosition.offset(...offset[direction]).offset(0, 1.5, 0));
    } catch(e) {
        console.log(e);
        console.log("Invalid direction entered");
    }
}

// --- bot event listeners
bot.once('spawn', () => {
    console.log(`${BOT_USERNAME} spawned`);
    bot.loadPlugin(pathfinder);
    weaponManager = new WeaponManager(bot.version);
    let mcData = require("minecraft-data")(bot.version);
    let movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);
    movements.canDig = false;
});

bot.on("death", () => {
    console.log(`${BOT_USERNAME} died`);
    stopGrind();
});

bot.on("kicked", (reason, loggedIn) => {
    console.log(reason, loggedIn);
    stopGrind();
});

bot.on("error", err => {
    console.log(err);
    stopGrind();
});

// --- bot command listener
bot.on("chat", async (username, message) => {
	if (username == BOT_USERNAME) return;

	let tokens = message.split(' ');

    if (tokens[0] == "critGrind") {
        switch(tokens[1]) {
            case "face":
                if (tokens.length == 3) {
                    await faceDirection(tokens[2]);
                }
                break;
            case "start":
                await critGrind();
                break;
            case "spot":
                if (!await equipWeapon()) return;
                if (tokens.length >= 5) {
                    await goToCoordinates(tokens[2], tokens[3], tokens[4]);
                }
                await setGrindPosition();
                break;
            case "stop":
                stopGrind();
                break;
        }
    }
});