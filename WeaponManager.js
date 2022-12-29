class WeaponManager {
    constructor(version) {
        this.mcData = require("minecraft-data")(version);
        this.currentWeapon = null;
    }

    getCurrentWeapon() {
        return this.currentWeapon;
    }

    updateCurrentWeapon(currentWeapon) {
        this.currentWeapon = currentWeapon;
    }

    getCurrentWeaponDurability() {
        let usedDurability = this.currentWeapon.durabilityUsed;
        let maxDurability = this.mcData.itemsByName[this.currentWeapon.name].maxDurability;
        return (maxDurability - usedDurability) / parseFloat(maxDurability)
    }

    // --- Given name of item returns whether or not the item is a weapon
    isWeapon(itemName) {
        itemName = itemName.toString();
        return (itemName.endsWith("sword")) || (itemName.endsWith("axe"));
    }

    // --- Given list of items returns a list of weapons within original list
    getWeapons(botItems) {
        const res = []
        for (let i = 0; i < botItems.length; ++i) {
            if (this.isWeapon(botItems[i].name)) {
                res.push(botItems[i]);
            }
        }
        return res
    }

    // --- Given a list of items, if there is only one weapon set it to this.currentWeapon
    setWeapon(botItems) {
        let weapons = this.getWeapons(botItems);
        if ((weapons.length == 0) || (weapons.length > 1)){
            this.currentWeapon = null;
        }
        else {
            // let weaponName = weapons[0].name;
            // let weapon = (this.mcData).itemsByName[weaponName].id;
            // this.currentWeapon = weapon;
            this.currentWeapon = weapons[0];
        }
    }
}

module.exports = WeaponManager;