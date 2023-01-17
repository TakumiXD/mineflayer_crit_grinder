const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const GoalBlock = goals.GoalBlock;
const WeaponManager = require('./WeaponManager');

const GRIND_RADIUS = 3.5 // The hit radius of the bot
const JUMP_FALLING_VELOCITY = -0.1 // The y velocity of the bot when it is falling from a jump
const offsets = {
    N: [0, 0, -1],
    S: [0, 0, 1],
    W: [-1, 0, 0],
    E: [1, 0, 0],
    NW: [-1, 0, -1],
    NE: [1, 0, -1],
    SW: [-1, 0, 1],
    SE: [1, 0, 1]
}

class CritGrinder {
    constructor(port, username, version, entitiesToGrind, 
        numOfTicksBetweenJumps, durabilityToStopGrinding) {
        this.bot = mineflayer.createBot({
            host: "localhost",
            port: port,
            username: username,
            version: version
        });
        this.entitiesToGrind = entitiesToGrind;
        this.numOfTicksBetweenJumps = numOfTicksBetweenJumps;
        this.durabilityToStopGrinding = durabilityToStopGrinding;

        this.weaponManager = null;
        this.isGrinding = false;

        this.initEventListeners();
        this.initCommandListener();
    }

    initEventListeners() {
        // --- bot event listeners
        this.bot.once('spawn', () => {
            console.log(`${this.bot.username} spawned`);
            this.bot.loadPlugin(pathfinder);
            const mcData = require("minecraft-data")(this.bot.version);
            this.weaponManager = new WeaponManager(mcData);
            const movements = new Movements(this.bot, mcData);
            this.bot.pathfinder.setMovements(movements);
            movements.canDig = false;
        });

        this.bot.on("death", () => {
            console.log(`${this.bot.username} died`);
            this.stopGrind();
        });

        this.bot.on("kicked", (reason, loggedIn) => {
            console.log(reason, loggedIn);
            this.stopGrind();
        });

        this.bot.on("error", err => {
            console.log(err);
            this.stopGrind();
        });
    }

    initCommandListener() {
        this.bot.on("chat", async (username, message) => {
            if ((username == this.bot.username) || !message.startsWith("critGrind")) return;

            const tokens = message.split(' ').slice(1);

            switch(tokens[0]) {
                case "face":
                    await this.onFace(tokens.slice(1));
                    break;
                case "start":
                    await this.onStart();
                    break;
                case "goto":
                    await this.onGoto(tokens.slice(1));
                    break;
                case "stop":
                    this.onStop();
                    break;
            }
        });
    }

    async onFace(tokens) {
        if ((tokens.length != 1) || (this.isGrinding)) return;

        await this.faceDirection(tokens[0]);
    }
    
    async onStart() {
        if (!await this.equipWeapon()) return;

        await this.startGrind();
    }
    
    async onGoto(tokens) {
        if ((tokens.length != 3) || (this.isGrinding)) return; 

        await this.goto(tokens[0], tokens[1], tokens[2]);
    }
    
    onStop() {
        this.stopGrind();
    }

    stopGrind() {
        this.isGrinding = false;
    }

    async startGrind() {
        if (this.isGrinding) return;
    
        this.isGrinding = true;

        while (this.isGrinding) {
            await this.critGrind();
        }
    }
    
    async critGrind() {
        // jump when a mob is detected
        const targetDetected = 
            this.bot.nearestEntity(entity => this.entitiesToGrind.includes(entity.type));
        
        if ((!targetDetected) || 
            (this.bot.entity.position.distanceTo(targetDetected.position) > GRIND_RADIUS)) {
            await this.bot.waitForTicks(1);
            return;
        }

        this.bot.setControlState("jump", true);
        this.bot.setControlState("jump", false);
        this.bot.on("move", attackIfFalling);
    
        const self = this;
        // called when the bot detects a target and is falling
        async function attackIfFalling() {
            if (self.bot.entity.velocity.y < JUMP_FALLING_VELOCITY) {
                self.bot.removeListener("move", attackIfFalling);
                self.bot.attack(targetDetected);
                self.weaponManager.updateCurrentWeapon(self.bot.heldItem);
                self.checkDurability();
            }
        }
    
        await this.bot.waitForTicks(this.numOfTicksBetweenJumps);
    }

    // --- Make the bot equip a weapon if the bot only has one weapon in its inventory
    async equipWeapon() {
        const botItems = this.bot.inventory.items(); 
        this.weaponManager.setWeapon(botItems);

        if (this.weaponManager.getCurrentWeapon() != null) {
            await this.bot.equip(this.weaponManager.getCurrentWeapon(), "hand");
            return true;
        }
        else {
            this.bot.chat("Failed, I either have no weapons or too many weapons");
            console.log(`eqipWeapon() failed`);
            console.log(`${this.bot.username} has invalid number of weapons`);
            return false;
        }
    }

    // --- Check if the weapon has sufficient durability
    checkDurability() {
        if (this.weaponManager.getCurrentWeaponDurability() <= this.durabilityToStopGrinding) {
            this.stopGrind();
            this.bot.chat("The weapon is low durability so I will stop grinding.");
            console.log(`${this.bot.username} stopped grinding due to insufficient durability`);
        }
    }

    async goto(x, y, z) {
        try {
            const goal = new GoalBlock(x, y, z);
            await this.bot.pathfinder.goto(goal);
            return true;
        } catch(e) {
            console.log(`goto() failed`);
            console.log("Invalid coordinates entered");
            return false;
        }
    }

    async faceDirection(direction) {
        try {
            const botPosition = this.bot.entity.position;
            await this.bot.lookAt(botPosition.offset(...offsets[direction]).offset(0, 1.5, 0));
        } catch(e) {
            console.log("faceDirection() failed, invalid direction entered");
        }
    }

}

class Singleton {
    constructor(args) {
        if (!Singleton.instance) {
            Singleton.instance = new CritGrinder(...args);
        }
        return Singleton.instance
    }
}

module.exports = Singleton;