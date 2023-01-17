const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const GoalBlock = goals.GoalBlock;
const vec3 = require('vec3')
const WeaponManager = require('./WeaponManager');

// --- bot server and login information
const PORT_NUMBER = 57183; // CHANGEME the port number of minecraft server
const BOT_USERNAME = "Crit_Grinder"; // CHANGEME the in game name of the bot
const settings = {
	host: "localhost",
	port: PORT_NUMBER,
	username: BOT_USERNAME,
};

const bot = mineflayer.createBot(settings);
const ENTITIES_TO_HIT = ["animal", "hostile"]; // The entities the bot should hit
const NUM_OF_TICKS_JUMP = 25 // The number of in-game ticks to complete a jump
const GRIND_RADIUS = 3.5 // The hit radius of the bot
const JUMP_FALLING_VELOCITY = -0.1 // The y velocity of the bot when it is falling from a jump
// The durability in percentage in which the bot will stop grinding and chat a warning message
const STOP_DURABILITY = 0.05 ;
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

let botIsGrinding = false;
let weaponManager = null;

function stopGrind() {
    botIsGrinding = false;
}

async function startGrind() {
    if (botIsGrinding) return;

    botIsGrinding = true;

    while (botIsGrinding) {
        await critGrind();
    }
}

async function critGrind() {
    // jump when a mob is detected
    const targetDetected = bot.nearestEntity(entity => ENTITIES_TO_HIT.includes(entity.type));
    if (targetDetected && (bot.entity.position.distanceTo(targetDetected.position) < GRIND_RADIUS)) {
        bot.setControlState("jump", true);
        bot.setControlState("jump", false);
        bot.on("move", attackIfFalling);
    }

    // called when the bot detects a target and is falling
    async function attackIfFalling() {
        if ((bot.entity.velocity.y < JUMP_FALLING_VELOCITY)) {
            bot.removeListener("move", attackIfFalling);
            const target = bot.nearestEntity(entity => ENTITIES_TO_HIT.includes(entity.type));
            bot.attack(target);
            weaponManager.updateCurrentWeapon(bot.heldItem);
            checkDurability();
        }
    }

    await bot.waitForTicks(NUM_OF_TICKS_JUMP);
}

// --- Make the bot equip a weapon if the bot only has one weapon in its inventory
async function equipWeapon() {
    const botItems = bot.inventory.items(); 
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

async function goto(x, y, z) {
    try {
        const goal = new GoalBlock(x, y, z);
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
        await bot.lookAt(botPosition.offset(...offset[direction]).offset(0, 1.5, 0));
    } catch(e) {
        console.log("faceDirection() failed, invalid direction entered");
    }
}

// --- bot event listeners
bot.once('spawn', () => {
    console.log(`${BOT_USERNAME} spawned`);
    bot.loadPlugin(pathfinder);
    weaponManager = new WeaponManager(bot.version);
    const mcData = require("minecraft-data")(bot.version);
    const movements = new Movements(bot, mcData);
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

async function onFace(tokens) {
    if (tokens.length == 1) {
        await faceDirection(tokens[0]);
    }
}

async function onStart() {
    if (!await equipWeapon()) return;
    await startGrind();
}

async function onGoto(tokens) {
    if (tokens.length != 3) return; 
    await goto(tokens[0], tokens[1], tokens[2]);
}

function onStop() {
    stopGrind();
}

// --- bot command listener
bot.on("chat", async (username, message) => {
	if ((username == BOT_USERNAME) || !message.startsWith("critGrind")) return;

	const tokens = message.split(' ').slice(1);

    switch(tokens[0]) {
        case "face":
            await onFace(tokens.slice(1));
            break;
        case "start":
            await onStart();
            break;
        case "goto":
            await onGoto(tokens.slice(1));
            break;
        case "stop":
            onStop();
            break;
    }
});